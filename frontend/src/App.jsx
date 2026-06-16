import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Camera,
  Edit2,
  FileSpreadsheet,
  Grid as GridIcon,
  Link,
  LockKeyhole,
  Play,
  Save,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import './App.css';

const TABS = [
  { id: 'setup', icon: Settings, label: 'Hall Setup' },
  { id: 'roster', icon: Users, label: 'Students' },
  { id: 'grid', icon: GridIcon, label: 'Seating Chart' },
];

const STRATEGIES = [
  {
    id: 'ai',
    icon: BrainCircuit,
    title: 'Advanced AI (Agents)',
    desc: 'Risk-aware simulated annealing for stronger separation between friends and matching courses.',
  },
  {
    id: 'lr',
    icon: Activity,
    title: 'Fast-Sort (Linear Regression)',
    desc: 'Fast priority scoring for quick hall layouts when time matters more than deep optimization.',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('roster');
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [bufferSeats, setBufferSeats] = useState(0);
  const [isManualGrid, setIsManualGrid] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [subjects, setSubjects] = useState(['AI', 'SE', 'Compiler Construction']);

  const [students, setStudents] = useState([
    { id: '101', name: 'Mahad Khan', subject: 'AI', friends: ['102'], isHighRisk: false },
    { id: '102', name: 'Abdullah Kamran', subject: 'SE', friends: ['101'], isHighRisk: true },
    { id: '103', name: 'Mustafa', subject: 'Compiler Construction', friends: [], isHighRisk: false },
  ]);

  const [gridResult, setGridResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optStats, setOptStats] = useState(null);
  const [algorithm, setAlgorithm] = useState('ai');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [neighbors, setNeighbors] = useState([]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [newStudentId, setNewStudentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('AI');
  const [newIsHighRisk, setNewIsHighRisk] = useState(false);
  const [newFriends, setNewFriends] = useState([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isManualGrid) {
      const total = students.length + bufferSeats;
      if (total <= 0) {
        setRows(1);
        setCols(1);
        return;
      }
      const optimalCols = Math.ceil(Math.sqrt(total * 1.6));
      const optimalRows = Math.ceil(total / optimalCols) || 1;
      setRows(optimalRows);
      setCols(optimalCols);
    }
  }, [students.length, bufferSeats, isManualGrid]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        String(s.id).includes(term) ||
        s.subject.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const capacity = rows * cols;
  const requiredSeats = students.length + bufferSeats;
  const watchedCount = students.filter((s) => s.isHighRisk).length;
  const optimizationLift = optStats
    ? Math.max(0, Math.round(((optStats.initial - optStats.final) / (optStats.initial || 1)) * 100))
    : 0;

  const handleSaveStudent = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newStudentId.trim()) return;

    if (editingId) {
      if (newStudentId !== editingId && students.some((s) => s.id === newStudentId)) {
        alert('A student with this ID already exists!');
        return;
      }
      const updatedStudents = students.map((s) => {
        if (s.id === editingId) {
          return {
            id: newStudentId,
            name: newName,
            subject: newSubject,
            friends: newFriends,
            isHighRisk: newIsHighRisk,
          };
        }
        if (s.friends.includes(editingId)) {
          return { ...s, friends: s.friends.map((f) => (f === editingId ? newStudentId : f)) };
        }
        return s;
      });
      const finalized = updatedStudents.map((s) => {
        if (s.id === newStudentId) return s;
        if (newFriends.includes(s.id) && !s.friends.includes(newStudentId)) {
          return { ...s, friends: [...s.friends, newStudentId] };
        }
        if (!newFriends.includes(s.id) && s.friends.includes(newStudentId)) {
          return { ...s, friends: s.friends.filter((fid) => fid !== newStudentId) };
        }
        return s;
      });
      setStudents(finalized);
      cancelEdit();
    } else {
      if (students.some((s) => s.id === newStudentId)) {
        alert('A student with this ID already exists!');
        return;
      }
      const newStudent = {
        id: newStudentId,
        name: newName,
        subject: newSubject,
        friends: newFriends,
        isHighRisk: newIsHighRisk,
      };
      const updatedStudents = students.map((s) => {
        if (newFriends.includes(s.id) && !s.friends.includes(newStudentId)) {
          return { ...s, friends: [...s.friends, newStudentId] };
        }
        return s;
      });
      setStudents([...updatedStudents, newStudent]);
      cancelEdit();
    }
  };

  const handleEdit = (student) => {
    setEditingId(student.id);
    setNewStudentId(student.id);
    setNewName(student.name);
    setNewSubject(student.subject);
    setNewIsHighRisk(student.isHighRisk);
    setNewFriends(student.friends);
  };

  const handleDelete = (id) => {
    setStudents(students.filter((s) => s.id !== id).map((s) => ({ ...s, friends: s.friends.filter((fId) => fId !== id) })));
    if (editingId === id) cancelEdit();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewStudentId('');
    setNewName('');
    setNewSubject(subjects[0] || '');
    setNewIsHighRisk(false);
    setNewFriends([]);
  };

  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    setActiveTab('grid');
    setGridResult(null);
    setSelectedStudent(null);
    if (students.length > rows * cols) {
      alert(`Not enough seats! Need at least ${students.length} seats, grid only has ${rows * cols}.`);
      setIsOptimizing(false);
      return;
    }
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, cols, students, algorithm }),
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
        setActiveTab('roster');
      } else {
        const rosterById = new Map(students.map((student) => [String(student.id), student]));
        const enrichedGrid = data.grid.map((row) =>
          row.map((seat) => {
            if (!seat) return null;
            const source = rosterById.get(String(seat.id));
            return {
              ...seat,
              friends: source?.friends || [],
              isHighRisk: Boolean(source?.isHighRisk),
            };
          })
        );
        setGridResult(enrichedGrid);
        setOptStats({ initial: data.initial_penalty, final: data.final_penalty });
      }
    } catch {
      alert('Failed to connect to the Python backend. Make sure app.py is running on port 5000.');
      setActiveTab('roster');
    }
    setIsOptimizing(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = '';
    const isSpreadsheet = /\.(csv|xlsx|xls)$/i.test(file.name);

    setIsUploading(true);
    setUploadMessage(isSpreadsheet ? 'Reading spreadsheet...' : 'Uploading image...');

    if (!isSpreadsheet) {
      setTimeout(() => setUploadMessage('CNN analyzing text...'), 1500);
      setTimeout(() => setUploadMessage('Extracting student details...'), 3000);
      setTimeout(() => setUploadMessage('Almost there...'), 4500);
    }

    const formData = new FormData();
    formData.append('file', file);
    subjects.forEach((sub) => formData.append('subjects', sub));

    try {
      const response = await fetch('/api/upload-roster', { method: 'POST', body: formData });
      const data = await response.json();

      if (data.error) {
        alert(`Upload failed: ${data.error}`);
        setIsUploading(false);
        setUploadMessage('');
        return;
      }

      if (data.students && data.students.length > 0) {
        setStudents((prev) => {
          const existingIds = new Set(prev.map((s) => String(s.id)));
          const incoming = data.students.filter((s) => !existingIds.has(String(s.id)));
          const added = incoming.length;
          setTimeout(() => {
            setUploadMessage(`Added ${added} new student${added !== 1 ? 's' : ''}`);
            setTimeout(() => {
              setIsUploading(false);
              setUploadMessage('');
            }, 1400);
          }, 0);
          return [...prev, ...incoming];
        });
        return;
      }
      alert('No students were detected in the file. Check the file format.');
    } catch (error) {
      console.error(error);
      alert('Upload failed. Ensure backend is running.');
    }

    setIsUploading(false);
    setUploadMessage('');
  };

  const inspectNeighbors = (r, c) => {
    const seat = gridResult[r][c];
    if (!seat) return;
    setSelectedStudent({ ...seat, r, c });
    const found = [];
    [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < gridResult.length && nc >= 0 && nc < gridResult[0].length && gridResult[nr][nc]) {
        found.push(gridResult[nr][nc]);
      }
    });
    setNeighbors(found);
  };

  const toggleFriendSelection = (studentId) => {
    setNewFriends((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const addSubject = (e) => {
    if (e.key !== 'Enter') return;
    const nextSubject = e.target.value.trim();
    if (!nextSubject || subjects.some((subject) => subject.toLowerCase() === nextSubject.toLowerCase())) return;
    setSubjects([...subjects, nextSubject]);
    e.target.value = '';
  };

  const hasNeighborRisk = selectedStudent
    ? neighbors.some(
        (n) =>
          n.subject === selectedStudent.subject &&
          (selectedStudent.friends?.includes(n.id) || n.friends?.includes(selectedStudent.id))
      )
    : false;

  return (
    <div className="app-shell">
      {isUploading && (
        <div className="upload-overlay">
          <div className="upload-modal">
            <div className="scanner-orbit">
              <ScanLine className="scanner-icon" />
            </div>
            <h3>{uploadMessage}</h3>
            <p>Securing the roster pipeline and extracting candidate records.</p>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand-lockup" onClick={() => setActiveTab('roster')} aria-label="Go to Students">
            <span className="brand-mark">
              <ShieldCheck />
            </span>
            <span>
              <span className="brand-name">ExamGuard</span>
              <span className="brand-tagline">AI-powered examination seating intelligence</span>
            </span>
          </button>

          <nav className="tab-nav" aria-label="Primary navigation">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const label = tab.id === 'roster' ? `${tab.label} (${students.length})` : tab.label;
              return (
                <button key={tab.id} className={`tab-button ${activeTab === tab.id ? 'is-active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="engine-badge">
            <LockKeyhole size={14} />
            <span>Integrity Mode</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'setup' && (
          <section className="setup-page page-stack">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Hall Configuration</p>
                <h1>Build a risk-aware exam hall.</h1>
              </div>
              <p>Balance capacity, subject groups, and algorithm strategy before generating the seating plan.</p>
            </div>

            <div className="panel strategy-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Seating Strategy</p>
                  <h2>Optimization engine</h2>
                </div>
                <span className="status-chip status-chip-info">Risk-Aware Planner</span>
              </div>

              <div className="strategy-grid">
                {STRATEGIES.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.id} className={`strategy-card ${algorithm === opt.id ? 'is-selected' : ''}`} onClick={() => setAlgorithm(opt.id)}>
                      <span className="strategy-icon">
                        <Icon size={22} />
                      </span>
                      <span className="strategy-copy">
                        <strong>{opt.title}</strong>
                        <span>{opt.desc}</span>
                      </span>
                      <span className="strategy-signal" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Grid Dimensions</p>
                  <h2>Room capacity model</h2>
                </div>
                <label className="toggle-control">
                  <input type="checkbox" checked={!isManualGrid} onChange={() => setIsManualGrid(!isManualGrid)} />
                  <span className="toggle-track" />
                  <span>Auto-fit grid</span>
                </label>
              </div>

              <div className="input-grid">
                {[
                  { label: 'Total rows', value: rows, set: (v) => { setIsManualGrid(true); setRows(v); } },
                  { label: 'Total columns', value: cols, set: (v) => { setIsManualGrid(true); setCols(v); } },
                  { label: 'Buffer seats', value: bufferSeats, set: setBufferSeats },
                ].map(({ label, value, set }) => (
                  <label key={label} className="field">
                    <span>{label}</span>
                    <input type="number" min="0" value={value} onChange={(e) => set(Number(e.target.value))} />
                  </label>
                ))}
              </div>

              <div className={`capacity-card ${capacity >= requiredSeats ? 'is-safe' : 'is-risk'}`}>
                <div>
                  <p>Hall capacity</p>
                  <strong>{capacity}</strong>
                </div>
                <div>
                  <p>Roster + buffer</p>
                  <strong>{requiredSeats}</strong>
                </div>
                <div>
                  <p>Security margin</p>
                  <strong>{capacity - requiredSeats}</strong>
                </div>
              </div>
            </div>

            <div className="panel subject-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Subject Groups</p>
                  <h2>Course separation tags</h2>
                </div>
              </div>
              <div className="chip-row">
                {subjects.map((sub) => (
                  <span key={sub} className="subject-chip">
                    {sub}
                    <button onClick={() => setSubjects(subjects.filter((s) => s !== sub))} aria-label={`Remove ${sub}`}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <input className="text-input" type="text" placeholder="Type a subject and press Enter..." onKeyDown={addSubject} />
            </div>
          </section>
        )}

        {activeTab === 'roster' && (
          <section className="roster-layout">
            <aside className="panel intake-panel">
              <div className="section-title compact">
                <div>
                  <p className="eyebrow">{editingId ? 'Student Profile' : 'Secure Intake'}</p>
                  <h2>
                    {editingId ? <Edit2 size={20} /> : <UserPlus size={20} />}
                    {editingId ? 'Edit Student' : 'Add Student'}
                  </h2>
                </div>
                {editingId && (
                  <button className="ghost-action" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveStudent} className="student-form">
                <label className="field">
                  <span>Student ID</span>
                  <input required type="text" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} placeholder="e.g. 101" />
                </label>
                <label className="field">
                  <span>Full name</span>
                  <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Mahad Khan" />
                </label>
                <label className="field">
                  <span>Course / Subject</span>
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>
                    {subjects.length === 0 && <option value="AI">AI</option>}
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="supervision-card">
                  <input type="checkbox" checked={newIsHighRisk} onChange={(e) => setNewIsHighRisk(e.target.checked)} />
                  <span className="check-visual">
                    <AlertTriangle size={14} />
                  </span>
                  <span>
                    <strong>Requires Supervision</strong>
                    <small>Mark as watch status for stricter seating visibility.</small>
                  </span>
                </label>

                <div className="friend-section">
                  <div className="friend-section-head">
                    <span>
                      <Link size={14} />
                      Link Friends
                    </span>
                    <strong>{newFriends.length} selected</strong>
                  </div>
                  <input className="text-input small" type="text" placeholder="Search friends..." value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} />
                  <div className="friend-list">
                    {students
                      .filter((s) => s.id !== editingId)
                      .filter(
                        (s) =>
                          !friendSearch ||
                          s.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
                          String(s.id).toLowerCase().includes(friendSearch.toLowerCase())
                      )
                      .map((s) => {
                        const checked = newFriends.some((fid) => String(fid) === String(s.id));
                        return (
                          <label key={s.id} className={`friend-option ${checked ? 'is-checked' : ''}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleFriendSelection(s.id)} />
                            <span className="check-dot" />
                            <span>
                              <strong>{s.name}</strong>
                              <small>{s.id} / {s.subject}</small>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <button type="submit" className={`primary-button full ${editingId ? 'is-editing' : ''}`}>
                  <Save size={17} />
                  {editingId ? 'Update Profile' : 'Save Student'}
                </button>
              </form>
            </aside>

            <section className="panel roster-panel">
              <div className="roster-toolbar">
                <div>
                  <p className="eyebrow">Roster Directory</p>
                  <h1>Student security registry</h1>
                  <div className="mini-metrics">
                    <span>{students.length} enrolled</span>
                    <span>{watchedCount} watchlisted</span>
                    <span>{subjects.length} subjects</span>
                  </div>
                </div>

                <div className="action-row">
                  <label className="secondary-button">
                    <Camera size={16} />
                    Upload Image
                    <input type="file" className="hidden-input" accept="image/*" onChange={handleFileUpload} />
                  </label>
                  <label className="secondary-button accent">
                    <FileSpreadsheet size={16} />
                    Upload CSV / Excel
                    <input type="file" className="hidden-input" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                  </label>
                  <button className="primary-button" onClick={handleRunOptimization} disabled={students.length === 0}>
                    Generate Plan
                    <Play size={15} fill="currentColor" />
                  </button>
                </div>
              </div>

              <div className="search-wrap">
                <Search size={17} />
                <input type="text" placeholder="Search by name, ID, or course..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>

              <div className="table-shell">
                {filteredStudents.length > 0 ? (
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Student name</th>
                        <th>Course</th>
                        <th>Status</th>
                        <th>Friends with</th>
                        <th className="right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr key={s.id}>
                          <td className="student-id">{s.id}</td>
                          <td>
                            <strong className="student-name">{s.name}</strong>
                          </td>
                          <td>
                            <span className="course-badge">{s.subject}</span>
                          </td>
                          <td>
                            {s.isHighRisk ? (
                              <span className="status-badge watch">
                                <AlertTriangle size={12} />
                                Watch
                              </span>
                            ) : (
                              <span className="status-badge standard">
                                <ShieldCheck size={12} />
                                Standard
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="friend-badges">
                              {s.friends.length > 0 ? (
                                s.friends.map((fid) => {
                                  const friend = students.find((st) => String(st.id).trim() === String(fid).trim());
                                  if (!friend) return null;
                                  return (
                                    <span key={fid} className="friend-badge">
                                      {friend.name}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="muted-text">None linked</span>
                              )}
                            </div>
                          </td>
                          <td className="right">
                            <div className="row-actions">
                              <button onClick={() => handleEdit(s)} aria-label={`Edit ${s.name}`}>
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => handleDelete(s.id)} aria-label={`Delete ${s.name}`}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state">
                    <Users size={36} />
                    <h3>No students found</h3>
                    <p>Adjust your search or add a new student to the roster.</p>
                  </div>
                )}
              </div>
            </section>
          </section>
        )}

        {activeTab === 'grid' && (
          <section className="chart-page">
            {isOptimizing ? (
              <div className="loading-state">
                <div className="scanner-orbit large">
                  <GridIcon className="scanner-icon" />
                </div>
                <h2>AI is calculating the optimal seating plan...</h2>
                <p>ExamGuard is separating linked students, balancing courses, and checking supervision visibility.</p>
              </div>
            ) : gridResult ? (
              <div className="page-stack">
                <div className="chart-summary">
                  <div className="legend-panel">
                    <span>
                      <i className="legend-dot risk" />
                      Requires Supervision
                    </span>
                    <span>
                      <i className="legend-dot empty" />
                      Empty Seat
                    </span>
                    <span className="interaction-hint">Click a seat for KNN neighbors</span>
                  </div>

                  {optStats && (
                    <div className="metric-strip">
                      <div>
                        <p>Initial score</p>
                        <strong>{optStats.initial}</strong>
                      </div>
                      <ArrowRight size={20} />
                      <div>
                        <p>Optimized score</p>
                        <strong>{optStats.final}</strong>
                      </div>
                      <div className="improvement-pill">{optimizationLift}% improved</div>
                    </div>
                  )}
                </div>

                <div className="chart-layout">
                  <aside className="panel inspector-panel">
                    <div className="section-title compact">
                      <div>
                        <p className="eyebrow">KNN Inspector</p>
                        <h2>
                          <ScanLine size={19} />
                          Neighbor scan
                        </h2>
                      </div>
                    </div>

                    {!selectedStudent ? (
                      <div className="inspector-empty">
                        <GridIcon size={30} />
                        <p>Select a seat to inspect nearby students and cheating-risk signals.</p>
                      </div>
                    ) : (
                      <div className="inspector-content">
                        <div className="selected-card">
                          <span>Selected student</span>
                          <strong>{selectedStudent.name}</strong>
                          <small>ID {selectedStudent.id} / {selectedStudent.subject}</small>
                        </div>

                        <div className="neighbor-list">
                          <div className="list-title">K=4 neighbors</div>
                          {neighbors.length > 0 ? (
                            neighbors.map((n, idx) => {
                              const risky =
                                n.subject === selectedStudent.subject &&
                                (selectedStudent.friends?.includes(n.id) || n.friends?.includes(selectedStudent.id));
                              return (
                                <div key={`${n.id}-${idx}`} className="neighbor-card">
                                  <div>
                                    <strong>{n.name}</strong>
                                    <small>{n.subject}</small>
                                  </div>
                                  <span className={`status-badge ${risky ? 'watch' : 'standard'}`}>{risky ? 'Risk' : 'Safe'}</span>
                                </div>
                              );
                            })
                          ) : (
                            <p className="muted-text">No occupied neighbors around this seat.</p>
                          )}
                        </div>

                        <div className={`risk-result ${hasNeighborRisk ? 'is-risk' : 'is-safe'}`}>
                          {hasNeighborRisk ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
                          <div>
                            <strong>{hasNeighborRisk ? 'High vulnerability' : 'Low risk'}</strong>
                            <span>
                              {hasNeighborRisk
                                ? 'Friends from the same course are nearby.'
                                : 'No high-vulnerability matches detected nearby.'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </aside>

                  <section className="hall-panel">
                    <div className="hall-header">
                      <div>
                        <p className="eyebrow">Seating Chart</p>
                        <h1>Live hall plan</h1>
                      </div>
                      <span>{rows} rows x {cols} columns</span>
                    </div>

                    <div className="hall-scroll">
                      <div className="hall-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(96px, 1fr))` }}>
                        {gridResult.map((row, r) =>
                          row.map((seat, c) => (
                            <button
                              key={`${r}-${c}`}
                              onClick={() => inspectNeighbors(r, c)}
                              className={`seat-card ${!seat ? 'is-empty' : ''} ${seat?.isHighRisk ? 'is-watch' : ''} ${
                                selectedStudent?.r === r && selectedStudent?.c === c ? 'is-selected' : ''
                              }`}
                              disabled={!seat}
                            >
                              {seat ? (
                                <>
                                  <span className="seat-index">{String.fromCharCode(65 + r)}{c + 1}</span>
                                  {seat.isHighRisk && <span className="risk-light" />}
                                  <strong title={seat.name}>{seat.name}</strong>
                                  <small>ID {seat.id}</small>
                                  <span className="seat-course">{seat.subject || 'N/A'}</span>
                                </>
                              ) : (
                                <>
                                  <span className="seat-index">{String.fromCharCode(65 + r)}{c + 1}</span>
                                  <small>Empty Seat</small>
                                </>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="empty-chart">
                <GridIcon size={42} />
                <h2>No seating chart active</h2>
                <p>Generate a plan from the Students screen to preview the secured exam hall.</p>
                <button className="primary-button" onClick={() => setActiveTab('roster')}>
                  Return to Roster
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
