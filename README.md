# ExamGuard

ExamGuard is an AI-powered examination seating intelligence system built to create safer, more organized, and more cheat-resistant exam hall layouts.

It combines OCR-based roster extraction, spreadsheet imports, student relationship tracking, and seating optimization to generate smart seating plans for academic environments.

## Overview

ExamGuard is a web-based academic project with a React frontend and Flask backend. It supports:

- manual student entry
- roster import from image, CSV, and Excel files
- friend linking between students
- supervision flags for high-risk students
- hall setup with configurable rows, columns, and buffer seats
- two seating strategies:
  `Advanced AI (Agents)` and `Fast-Sort (Linear Regression)`
- seating plan generation with optimization scoring
- seating chart review with neighbor-based risk inspection

The main goal is to reduce cheating risk by separating friends, improving subject distribution, and highlighting risky seat placements before an exam begins.

## Key Features

- `OCR roster upload`
  Upload a photo or screenshot of a student list and extract student records automatically using EasyOCR.

- `CSV / XLSX import`
  Import student data in bulk from spreadsheet files.

- `Student registry management`
  Add, edit, delete, search, and organize students with subject, supervision, and friend-link data.

- `Hall configuration`
  Define rows, columns, buffer seats, and subject groups before generating the plan.

- `AI seating optimization`
  Generate exam seating layouts using a penalty-based optimization approach designed to reduce risky adjacency patterns.

- `KNN-style inspector`
  Inspect selected students and their nearby neighbors on the seating chart for a quick risk review.

- `Exam integrity dashboard UI`
  The frontend is presented as a modern dashboard under the `ExamGuard` brand.

## How It Works

1. Add students manually or import them from an image or spreadsheet.
2. Configure hall size and subject groups.
3. Choose a seating strategy.
4. Generate the seating plan.
5. Review the chart and inspect nearby neighbors for risk analysis.

The backend penalizes patterns such as:

- friends sitting next to each other
- friends from the same subject sitting too close
- high-risk students being placed in weak supervision spots
- multiple high-risk students sitting too close together

## Tech Stack

### Frontend

- React
- Vite
- Tailwind tooling
- Lucide React

### Backend

- Python
- Flask
- Flask-CORS
- EasyOCR
- OpenCV
- NumPy
- OpenPyXL for Excel parsing

## Project Structure

```text
.
|-- backend/
|   |-- app.py
|   |-- agent.py
|   |-- environment.py
|   `-- models.py
|-- frontend/
|   |-- src/
|   |-- public/
|   `-- package.json
|-- main.py
|-- students.csv
|-- students_full.csv
`-- optimized_seating.csv
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### Backend Setup

Install the required Python packages:

```bash
pip install flask flask-cors easyocr opencv-python numpy openpyxl
```

Run the backend:

```bash
cd backend
python app.py
```

The backend runs on `http://127.0.0.1:5000`.

### Frontend Setup

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on `http://127.0.0.1:5173`.

### Run Both Together

You can also start both services from the project root with:

```bash
python main.py
```

## API Endpoints

### `POST /api/upload-roster`

Accepts:

- image files for OCR parsing
- `.csv`
- `.xlsx`
- `.xls`

Returns parsed student records in JSON format.

### `POST /api/optimize`

Accepts hall dimensions, selected algorithm, and student data.

Returns:

- initial penalty
- final penalty
- generated seating grid

## Sample Data

The repository already includes sample files for testing:

- [students.csv](students.csv)
- [students_full.csv](students_full.csv)
- [Project.png](Project.png)

## Use Cases

- university exam seating management
- fair and systematic student distribution
- cheating-risk reduction in physical exam halls
- academic project demonstrations for AI, HCI, and software engineering courses

## Limitations

- OCR accuracy depends on image quality and formatting
- Excel import requires `openpyxl`
- the optimization is heuristic-based, not a full constraint solver
- authentication and deployment are not included in this academic prototype

## Future Improvements

- export seating charts as PDF
- multi-hall support
- invigilator allocation
- stronger analytics and reporting
- role-based access control
- cloud deployment

## Author

Built as an academic AI project focused on exam integrity, seating optimization, and safer hall planning.
