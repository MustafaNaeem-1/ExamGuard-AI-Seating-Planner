import os
import re
import time
import warnings
import easyocr
import numpy as np
import cv2
import sys
import io

warnings.filterwarnings("ignore")

# openpyxl is optional — only needed for .xlsx
try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False
    print("⚠️  openpyxl not installed — Excel upload disabled. Run: pip install openpyxl")

import csv
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import Student
from environment import ExamHall
from agent import SeatingPlanner

app = Flask(__name__)
CORS(app)

reader = None

# ---------------------------------------------------------------------------
# KNOWN SUBJECTS  (longest first so regex matches greedily)
# ---------------------------------------------------------------------------
DEFAULT_SUBJECTS = [
    'Artificial Intelligence',
    'Compiler Construction',
    'Software Engineering',
    'Data Structures and Algorithms',
    'Operating Systems',
    'Computer Networks',
    'Database Systems',
    'Machine Learning',
    'Deep Learning',
    'Math', 'English', 'Science', 'DSA', 'AI', 'SE', 'OOP', 'HCI',
]


def _build_subject_regex(subjects):
    ordered = sorted(subjects, key=len, reverse=True)
    return [(s, re.compile(rf'\b{re.escape(s)}\b', re.IGNORECASE)) for s in ordered]


def extract_course(text, subject_regexes):
    for label, pattern in subject_regexes:
        if pattern.search(text):
            cleaned = pattern.sub('', text).strip()
            return label, cleaned
    return None, text


def strip_all_courses(text, subject_regexes):
    for _, pattern in subject_regexes:
        text = pattern.sub('', text)
    return re.sub(r'\s+', ' ', text).strip()


# ---------------------------------------------------------------------------
# PREPROCESSING — resize only, no destructive filters
# ---------------------------------------------------------------------------
def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print("❌ OpenCV failed to read image")
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    if w < 1000:
        scale = 1000 / w
        gray  = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    elif w > 1800:
        scale = 1800 / w
        gray  = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    out = os.path.join("uploads", f"proc_{os.path.basename(image_path)}")
    cv2.imwrite(out, gray)
    return out


# ---------------------------------------------------------------------------
# ROW CLUSTERING — the critical fix
# ---------------------------------------------------------------------------
def cluster_into_rows(ocr_results):
    """
    Group OCR tokens into visual rows using the MEDIAN token height
    as the clustering threshold — not each token's own height.
    This prevents tall tokens from inflating the threshold and merging rows.
    """
    if not ocr_results:
        return []

    # Sort top-to-bottom
    ocr_results.sort(key=lambda x: (int(x[0][0][1]) + int(x[0][2][1])) / 2)

    # Compute median token height across ALL tokens
    heights = [abs(int(r[0][2][1]) - int(r[0][0][1])) for r in ocr_results]
    heights.sort()
    median_h  = heights[len(heights) // 2]
    threshold = max(median_h * 0.55, 8)   # ~55% of median row height
    print(f"📐 Row-cluster threshold: {threshold:.1f}px  (median_h={median_h}px)")

    rows    = []
    current = [ocr_results[0]]

    for i in range(1, len(ocr_results)):
        prev_mid = (int(ocr_results[i-1][0][0][1]) + int(ocr_results[i-1][0][2][1])) / 2
        curr_mid = (int(ocr_results[i][0][0][1])   + int(ocr_results[i][0][2][1]))   / 2
        if abs(curr_mid - prev_mid) < threshold:
            current.append(ocr_results[i])
        else:
            rows.append(sorted(current, key=lambda r: int(r[0][0][0])))
            current = [ocr_results[i]]

    rows.append(sorted(current, key=lambda r: int(r[0][0][0])))
    return rows


# ---------------------------------------------------------------------------
# INTELLIGENT PARSER
# ---------------------------------------------------------------------------
def intelligent_parse(ocr_results, known_subjects=None):
    if not ocr_results:
        print("⚠️  No OCR results to parse")
        return []

    all_subs   = list(dict.fromkeys((known_subjects or []) + DEFAULT_SUBJECTS))
    subject_re = _build_subject_regex(all_subs)

    os.makedirs("uploads", exist_ok=True)
    with open(os.path.join("uploads", "ocr_debug.txt"), "w", encoding="utf-8") as f:
        f.write("--- RAW OCR RESULTS ---\n")
        for r in ocr_results:
            f.write(f"XY:{r[0][0]}  conf:{r[2]:.2f}  '{r[1]}'\n")
    print(f"📄 OCR tokens to parse: {len(ocr_results)}")

    # ── 1. Cluster into rows using median-height threshold ─────────────────
    rows = cluster_into_rows(ocr_results)
    print(f"📊 Visual rows: {len(rows)}")

    # ── 2. Detect header row ───────────────────────────────────────────────
    col_bounds  = {}
    data_start  = 0
    has_sno_col = False

    for i, row in enumerate(rows):
        joined = " ".join(r[1].lower() for r in row)
        if 'name' in joined and (
            'id' in joined or 'no' in joined or
            'course' in joined or 'subject' in joined
        ):
            for res in row:
                box, text, _ = res
                t  = text.lower().strip()
                lx = int(box[0][0])
                if re.search(r's\.?no\b|serial|sno', t):
                    col_bounds['sno']     = lx
                    has_sno_col           = True
                elif re.search(r'\bid\b|\broll\b', t):
                    col_bounds['id']      = lx
                elif re.search(r'\bname\b', t):
                    col_bounds['name']    = lx
                elif re.search(r'course|subject|assigned', t):
                    col_bounds['course']  = lx
                elif 'friend' in t:
                    col_bounds['friends'] = lx
            data_start = i + 1
            print(f"✅ Header at row {i}: {col_bounds}")
            break

    # Positional fallback
    if not col_bounds:
        print("⚠️  No header — positional fallback")
        all_xs = sorted(set(int(r[0][0][0]) for row in rows for r in row))
        if all_xs:
            mn, mx = all_xs[0], all_xs[-1]
            sp = max(mx - mn, 1)
            col_bounds  = {
                'sno':     mn,
                'id':      mn + sp * 0.10,
                'name':    mn + sp * 0.20,
                'course':  mn + sp * 0.44,
                'friends': mn + sp * 0.68,
            }
            has_sno_col = True

    sorted_cols = sorted(col_bounds.items(), key=lambda x: x[1])

    SKIP = re.compile(
        r'^(s\.?no|id|name|course|subject|friend|assigned|roll|serial|\d{1,2}\.?)$',
        re.IGNORECASE
    )

    # ── 3. Parse each data row ─────────────────────────────────────────────
    parsed = []

    for row_idx, row in enumerate(rows[data_start:], start=1):
        buckets = {k: [] for k in col_bounds}

        for box, text, _ in row:
            x        = int(box[0][0])
            assigned = sorted_cols[0][0]
            for col_name, col_x in sorted_cols:
                if x >= col_x - 30:
                    assigned = col_name
            buckets[assigned].append(text.strip())

        # ── ID ──────────────────────────────────────────────────────────────
        student_id = ""
        for t in buckets.get('id', []):
            nums = re.sub(r'\D', '', t)
            if 3 <= len(nums) <= 8:
                student_id = nums
                break
        if not student_id and has_sno_col:
            for t in buckets.get('sno', []):
                nums = re.sub(r'\D', '', t)
                if 3 <= len(nums) <= 8:
                    student_id = nums
                    break
        if not student_id:
            for bk, tokens in buckets.items():
                if bk == 'sno':
                    continue
                for t in tokens:
                    nums = re.sub(r'\D', '', t)
                    if 3 <= len(nums) <= 8:
                        student_id = nums
                        break
                if student_id:
                    break

        # ── COURSE ──────────────────────────────────────────────────────────
        course = None
        for t in buckets.get('course', []):
            lbl, _ = extract_course(t, subject_re)
            if lbl:
                course = lbl
                break
        if not course:
            lbl, _ = extract_course(" ".join(buckets.get('name', [])), subject_re)
            if lbl:
                course = lbl
        if not course:
            course = "Unknown"

        # ── NAME ────────────────────────────────────────────────────────────
        raw_name = " ".join(buckets.get('name', []))
        raw_name = strip_all_courses(raw_name, subject_re)
        raw_name = re.sub(r'\b\d+\.?\b', '', raw_name)
        full_name = re.sub(r"^[^a-zA-Z]+", "", raw_name)
        full_name = re.sub(r'\s+', ' ', full_name).strip(' ;:,|.')

        if SKIP.match(full_name.strip()):
            continue

        # ── FRIENDS ─────────────────────────────────────────────────────────
        friends_raw     = " ".join(buckets.get('friends', []))
        friends_raw     = strip_all_courses(friends_raw, subject_re)
        friends_raw     = re.sub(r'\b\d+\b', '', friends_raw)
        friend_names    = [
            f.strip().title()
            for f in re.split(r'[,;]+', friends_raw)
            if f.strip() and f.strip().lower() not in ('', '-', 'none', 'n/a')
            and len(f.strip()) >= 2
        ]

        if student_id and len(full_name) >= 2:
            parsed.append({
                "id":           student_id,
                "name":         full_name.title(),
                "subject":      course,
                "temp_friends": friend_names,
                "friends":      [],
                "isHighRisk":   False,
            })
            print(f"  ✔ [{row_idx}] id={student_id} | name={full_name.title()!r} | course={course} | friends={friend_names}")

    # ── 4. Resolve friend names → IDs ─────────────────────────────────────
    name_to_id = {s['name'].lower(): s['id'] for s in parsed}

    for s in parsed:
        resolved = []
        for fname in s['temp_friends']:
            fl = fname.lower().strip()
            if len(fl) < 2:
                continue
            if fl in name_to_id:
                resolved.append(name_to_id[fl])
                continue
            for nk, fid in name_to_id.items():
                if len(fl) >= 3 and (nk.startswith(fl) or fl.startswith(nk) or fl in nk):
                    resolved.append(fid)
                    break
        s['friends'] = list({fid for fid in resolved if fid != s['id']})
        del s['temp_friends']

    print(f"✅ Parsed students: {len(parsed)}")
    return parsed


# ---------------------------------------------------------------------------
# EXCEL / CSV PARSER
# ---------------------------------------------------------------------------
def parse_spreadsheet(file_bytes, filename, known_subjects=None):
    all_subs   = list(dict.fromkeys((known_subjects or []) + DEFAULT_SUBJECTS))
    subject_re = _build_subject_regex(all_subs)
    rows       = []

    ext = os.path.splitext(filename)[1].lower()

    if ext == '.csv':
        text = file_bytes.decode('utf-8-sig', errors='replace')
        rows = list(csv.reader(io.StringIO(text)))
    elif ext in ('.xlsx', '.xls'):
        if not HAS_OPENPYXL:
            raise RuntimeError("openpyxl not installed. Run: pip install openpyxl")
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            rows.append([str(c).strip() if c is not None else '' for c in row])
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    if not rows:
        return []

    # Detect header
    col_map    = {}
    header_idx = 0

    for hi, row in enumerate(rows):
        rl = [str(c).lower().strip() for c in row]
        if not any('name' in c for c in rl):
            continue
        for i, c in enumerate(rl):
            if re.search(r'\bid\b|\broll\b', c):
                col_map['id']      = i
            elif re.search(r's\.?no|serial', c):
                col_map['sno']     = i
            elif re.search(r'\bname\b', c):
                col_map['name']    = i
            elif re.search(r'course|subject|assigned', c):
                col_map['course']  = i
            elif 'friend' in c:
                col_map['friends'] = i
        header_idx = hi + 1
        break

    if 'name' not in col_map:
        print("⚠️  Spreadsheet: no 'name' column found — trying row 0 as data")
        # treat whole file as data with fixed column order: sno, id, name, course, friends
        col_map    = {'sno': 0, 'id': 1, 'name': 2, 'course': 3, 'friends': 4}
        header_idx = 0

    print(f"📋 Spreadsheet col map: {col_map}")

    parsed = []
    for row_idx, row in enumerate(rows[header_idx:], start=1):
        row = [str(c).strip() for c in row]
        if all(c == '' for c in row):
            continue

        def cell(key):
            idx = col_map.get(key)
            return row[idx] if idx is not None and idx < len(row) else ''

        # ID
        student_id = re.sub(r'\D', '', cell('id') or cell('sno'))
        if not (3 <= len(student_id) <= 8):
            for c in row:
                nums = re.sub(r'\D', '', c)
                if 3 <= len(nums) <= 8:
                    student_id = nums
                    break

        # Name
        raw_name  = strip_all_courses(cell('name'), subject_re)
        raw_name  = re.sub(r'\b\d+\b', '', raw_name).strip(' ;:,|.')
        full_name = re.sub(r'\s+', ' ', raw_name).strip()

        # Course
        lbl, _ = extract_course(cell('course'), subject_re)
        if not lbl:
            lbl, _ = extract_course(cell('name'), subject_re)
        course = lbl or (cell('course').title() if cell('course') else "Unknown")

        # Friends
        fr_text      = strip_all_courses(cell('friends'), subject_re)
        fr_text      = re.sub(r'\b\d+\b', '', fr_text)
        friend_names = [
            f.strip().title()
            for f in re.split(r'[,;|]+', fr_text)
            if f.strip() and len(f.strip()) >= 2
            and f.strip().lower() not in ('', '-', 'none', 'n/a')
        ]

        if student_id and len(full_name) >= 2:
            parsed.append({
                "id":           student_id,
                "name":         full_name.title(),
                "subject":      course,
                "temp_friends": friend_names,
                "friends":      [],
                "isHighRisk":   False,
            })
            print(f"  ✔ Sheet row {row_idx}: id={student_id} | name={full_name.title()!r} | course={course}")

    # Resolve friends
    name_to_id = {s['name'].lower(): s['id'] for s in parsed}
    for s in parsed:
        resolved = []
        for fname in s['temp_friends']:
            fl = fname.lower().strip()
            if len(fl) < 2:
                continue
            if fl in name_to_id:
                resolved.append(name_to_id[fl])
                continue
            for nk, fid in name_to_id.items():
                if len(fl) >= 3 and (nk.startswith(fl) or fl.startswith(nk) or fl in nk):
                    resolved.append(fid)
                    break
        s['friends'] = list({fid for fid in resolved if fid != s['id']})
        del s['temp_friends']

    print(f"✅ Spreadsheet parsed: {len(parsed)} students")
    return parsed


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def _cleanup(*paths):
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass


def _get_reader():
    global reader
    if reader is None:
        try:
            print("🔄 Initializing OCR reader (this may take a minute on the first run to download models)...")
            # Set verbose=True to see download progress in the terminal
            reader = easyocr.Reader(['en'], gpu=False, verbose=True)
            print("✅ OCR reader ready.")
        except Exception as e:
            print(f"❌ OCR Initialization Failed: {e}")
            raise RuntimeError(f"OCR Engine failed to start. Check internet connection for model download. Error: {e}")
    return reader


# ---------------------------------------------------------------------------
# ROUTE: upload roster  (image  OR  xlsx / csv)
# ---------------------------------------------------------------------------
@app.route('/api/upload-roster', methods=['POST'])
def upload_roster():
    temp_path = None
    proc_path = None

    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files['file']
        if not file or not file.filename:
            return jsonify({"error": "Empty filename"}), 400

        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        if file_size > 15 * 1024 * 1024:
            return jsonify({"error": "File too large (max 15 MB)"}), 400

        sent_subjects = request.form.getlist('subjects')
        ext           = os.path.splitext(file.filename)[1].lower()

        # ── Spreadsheet branch ────────────────────────────────────────────
        if ext in ('.xlsx', '.xls', '.csv'):
            file_bytes = file.read()
            try:
                students = parse_spreadsheet(file_bytes, file.filename, known_subjects=sent_subjects)
            except Exception as e:
                return jsonify({"error": f"Spreadsheet parse failed: {str(e)}"}), 500
            print(f"🎓 Spreadsheet final: {len(students)}")
            return jsonify({"students": students})

        # ── Image OCR branch ──────────────────────────────────────────────
        try:
            ocr = _get_reader()
        except Exception as e:
            return jsonify({"error": f"OCR init failed: {str(e)}"}), 500

        os.makedirs("uploads", exist_ok=True)
        safe_name = re.sub(r'[^\w.\-]', '_', file.filename)
        temp_path = os.path.join("uploads", f"temp_{safe_name}")
        file.save(temp_path)
        print(f"📁 Saved: {temp_path} ({file_size // 1024} KB)")

        proc_path = preprocess_image(temp_path)
        read_path = proc_path if proc_path else temp_path

        print(f"🔍 OCR on: {read_path}")
        try:
            t0          = time.time()
            raw_results = ocr.readtext(read_path, detail=1, paragraph=False)
            print(f"⏱ OCR: {time.time() - t0:.2f}s — {len(raw_results)} tokens")
        except Exception as e:
            return jsonify({"error": f"OCR failed: {str(e)}"}), 500

        print("--- RAW TOKENS ---")
        for r in raw_results:
            print(f"  {r[2]:.2f}  '{r[1]}'")

        results  = [r for r in raw_results if r[2] > 0.15]
        students = intelligent_parse(results, known_subjects=sent_subjects)

        # Fallback: retry on original image
        if len(students) == 0 and proc_path:
            print("⚠️  Fallback: original image")
            try:
                t0 = time.time()
                fb = ocr.readtext(temp_path, detail=1, paragraph=False)
                print(f"⏱ Fallback: {time.time() - t0:.2f}s — {len(fb)} tokens")
            except Exception as e:
                return jsonify({"error": f"Fallback OCR failed: {str(e)}"}), 500
            fb_f = [r for r in fb if r[2] > 0.15]
            fb_s = intelligent_parse(fb_f, known_subjects=sent_subjects)
            if len(fb_s) > len(students):
                students = fb_s

        print(f"🎓 Final: {len(students)} students")
        return jsonify({"students": students})

    except Exception as e:
        print(f"❌ upload_roster: {e}", file=sys.stderr)
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        _cleanup(temp_path, proc_path)


# ---------------------------------------------------------------------------
# ROUTE: optimize seating
# ---------------------------------------------------------------------------
@app.route('/api/optimize', methods=['POST'])
def optimize_seating():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON body"}), 400

        rows          = data.get('rows', 10)
        cols          = data.get('cols', 10)
        students_data = data.get('students', [])
        if not students_data:
            return jsonify({"error": "No students provided"}), 400

        hall     = ExamHall(rows, cols)
        students = [
            Student(
                s['id'], s['name'], s['subject'],
                s.get('friends', []),
                9 if s.get('isHighRisk') else 3,
            )
            for s in students_data
        ]

        planner = SeatingPlanner(hall, students)
        planner.place_randomly()
        initial_penalty = planner.calculate_penalty()
        planner.optimize_seating(iterations=10000)
        final_penalty = planner.calculate_penalty()

        grid = []
        for r in range(hall.rows):
            row = []
            for c in range(hall.cols):
                st = hall.get_student(r, c)
                row.append(
                    {"id": st.student_id, "name": st.name, "subject": st.subject}
                    if st else None
                )
            grid.append(row)

        return jsonify({
            "initial_penalty": initial_penalty,
            "final_penalty":   final_penalty,
            "grid":            grid,
        })

    except Exception as e:
        print(f"❌ optimize_seating: {e}", file=sys.stderr)
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
