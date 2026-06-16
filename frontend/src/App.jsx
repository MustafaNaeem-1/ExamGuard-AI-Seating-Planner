import React, { useState, useEffect } from 'react';
import { Settings, Users, Grid as GridIcon, UserPlus, AlertTriangle, Link, ArrowRight, Save, Play, Loader2, Edit2, Trash2, X, Search, ChevronLeft, Camera, Plus, Minus, FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('roster');
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [bufferSeats, setBufferSeats] = useState(0);
  const [isManualGrid, setIsManualGrid] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [subjects, setSubjects] = useState(['AI', 'SE', 'Compiler Construction']);
  
  const [students, setStudents] = useState([
    { id: '101', name: 'Mahad Khan',       subject: 'AI',                   friends: ['102'], isHighRisk: false },
    { id: '102', name: 'Abdullah Kamran',  subject: 'SE',                   friends: ['101'], isHighRisk: true  },
    { id: '103', name: 'Mustafa',          subject: 'Compiler Construction', friends: [],      isHighRisk: false },
  ]);
  
  const [gridResult,    setGridResult]    = useState(null);
  const [isOptimizing,  setIsOptimizing]  = useState(false);
  const [optStats,      setOptStats]      = useState(null);
  const [algorithm,     setAlgorithm]     = useState('ai');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [neighbors,     setNeighbors]     = useState([]);
  
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [searchTerm,    setSearchTerm]    = useState('');

  const [editingId,     setEditingId]     = useState(null);
  const [newStudentId,  setNewStudentId]  = useState('');
  const [newName,       setNewName]       = useState('');
  const [newSubject,    setNewSubject]    = useState('AI');
  const [newIsHighRisk, setNewIsHighRisk] = useState(false);
  const [newFriends,    setNewFriends]    = useState([]);

  // ── Auto-fit grid ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isManualGrid) {
      const total = students.length + bufferSeats;
      if (total <= 0) { setRows(1); setCols(1); return; }
      const optimalCols = Math.ceil(Math.sqrt(total * 1.6));
      const optimalRows = Math.ceil(total / optimalCols) || 1;
      setRows(optimalRows);
      setCols(optimalCols);
    }
  }, [students.length, bufferSeats, isManualGrid]);

  // ── Save / Edit student ──────────────────────────────────────────────────
  const handleSaveStudent = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newStudentId.trim()) return;
    
    if (editingId) {
      if (newStudentId !== editingId && students.some(s => s.id === newStudentId)) {
        alert("A student with this ID already exists!"); return;
      }
      const updatedStudents = students.map(s => {
        if (s.id === editingId)
          return { id: newStudentId, name: newName, subject: newSubject, friends: newFriends, isHighRisk: newIsHighRisk };
        if (s.friends.includes(editingId))
          return { ...s, friends: s.friends.map(f => f === editingId ? newStudentId : f) };
        return s;
      });
      const finalized = updatedStudents.map(s => {
        if (s.id === newStudentId) return s;
        if (newFriends.includes(s.id) && !s.friends.includes(newStudentId))
          return { ...s, friends: [...s.friends, newStudentId] };
        if (!newFriends.includes(s.id) && s.friends.includes(newStudentId))
          return { ...s, friends: s.friends.filter(fid => fid !== newStudentId) };
        return s;
      });
      setStudents(finalized);
      cancelEdit();
    } else {
      if (students.some(s => s.id === newStudentId)) {
        alert("A student with this ID already exists!"); return;
      }
      const newStudent = { id: newStudentId, name: newName, subject: newSubject, friends: newFriends, isHighRisk: newIsHighRisk };
      const updatedStudents = students.map(s => {
        if (newFriends.includes(s.id) && !s.friends.includes(newStudentId))
          return { ...s, friends: [...s.friends, newStudentId] };
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
    setStudents(students.filter(s => s.id !== id).map(s => ({ ...s, friends: s.friends.filter(fId => fId !== id) })));
    if (editingId === id) cancelEdit();
  };

  const cancelEdit = () => {
    setEditingId(null); setNewStudentId(''); setNewName('');
    setNewSubject(subjects[0] || ''); setNewIsHighRisk(false); setNewFriends([]);
  };

  // ── Optimization ─────────────────────────────────────────────────────────
  const handleRunOptimization = async () => {
    setIsOptimizing(true); setActiveTab('grid'); setGridResult(null); setSelectedStudent(null);
    if (students.length > rows * cols) {
      alert(`Not enough seats! Need at least ${students.length} seats, grid only has ${rows * cols}.`);
      setIsOptimizing(false); return;
    }
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, cols, students, algorithm })
      });
      const data = await response.json();
      if (data.error) { alert(data.error); setActiveTab('roster'); }
      else { setGridResult(data.grid); setOptStats({ initial: data.initial_penalty, final: data.final_penalty }); }
    } catch (error) {
      alert('Failed to connect to the Python backend. Make sure app.py is running on port 5000.');
      setActiveTab('roster');
    }
    setIsOptimizing(false);
  };

  // ── FIX 1: File upload — deduplicate by ID (not name), count correctly ──
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset so same file can be re-uploaded
    e.target.value = '';

    const isSpreadsheet = /\.(csv|xlsx|xls)$/i.test(file.name);

    setIsUploading(true);
    setUploadMessage(isSpreadsheet ? 'Reading spreadsheet...' : 'Uploading image...');

    if (!isSpreadsheet) {
      setTimeout(() => setUploadMessage('CNN analyzing text...'),        1500);
      setTimeout(() => setUploadMessage('Extracting student details...'), 3000);
      setTimeout(() => setUploadMessage('Almost there...'),               4500);
    }

    const formData = new FormData();
    formData.append('file', file);
    subjects.forEach(sub => formData.append('subjects', sub));

    try {
      const response = await fetch('/api/upload-roster', { method: 'POST', body: formData });
      const data     = await response.json();

      if (data.error) {
        alert(`Upload failed: ${data.error}`);
        setIsUploading(false);
        setUploadMessage('');
        return;
      }

      if (data.students && data.students.length > 0) {
        // ✅ FIX: use functional updater so `prev` is always the latest state.
        //         Deduplicate strictly by ID (string-compared) — NOT by name.
        //         This is why Mustafa (103) and Mustafa (109) were being merged:
        //         the old code compared by name, so the new one was dropped.
        setStudents(prev => {
          const existingIds = new Set(prev.map(s => String(s.id)));
          const incoming    = data.students.filter(s => !existingIds.has(String(s.id)));
          const added       = incoming.length;
          // Update message after we know the real count
          setTimeout(() => {
            setUploadMessage(`✅ Added ${added} new student${added !== 1 ? 's' : ''}`);
            setTimeout(() => { setIsUploading(false); setUploadMessage(''); }, 1400);
          }, 0);
          return [...prev, ...incoming];
        });
        return; // early return — setIsUploading handled inside setter callback above
      } else {
        alert('No students were detected in the file. Check the file format.');
      }
    } catch (error) {
      console.error(error);
      alert('Upload failed. Ensure backend is running.');
    }

    setIsUploading(false);
    setUploadMessage('');
  };

  // ── KNN Inspector ────────────────────────────────────────────────────────
  const inspectNeighbors = (r, c) => {
    const seat = gridResult[r][c];
    if (!seat) return;
    setSelectedStudent({ ...seat, r, c });
    const found = [];
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => {
      const nr = r+dr, nc = c+dc;
      if (nr>=0 && nr<gridResult.length && nc>=0 && nc<gridResult[0].length && gridResult[nr][nc])
        found.push(gridResult[nr][nc]);
    });
    setNeighbors(found);
  };

  const toggleFriendSelection = (studentId) => {
    setNewFriends(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  return (
    <div className="min-h-screen text-slate-100 selection:bg-indigo-500/30">

      {/* ── OCR Loading Modal ──────────────────────────────────────────── */}
      {isUploading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/60">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10 max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-4 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin-slow"></div>
              <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">{uploadMessage}</h3>
              <p className="text-slate-400 text-sm">Processing your file...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GridIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-purple-200 to-white">
              Examatrix
            </h1>
          </div>
          <div className="flex bg-white/5 p-1.5 rounded-xl border border-white/5 backdrop-blur-md">
            {[
              { id: 'setup',  icon: Settings, label: 'Hall Setup' },
              { id: 'roster', icon: Users,    label: `Students (${students.length})` },
              { id: 'grid',   icon: GridIcon, label: 'Seating Chart' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">

        {/* ════════════════════ SETUP TAB ════════════════════ */}
        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Algorithm */}
            <div className="bg-slate-900/40 border border-white/10 rounded-[32px] p-8 backdrop-blur-3xl shadow-2xl">
              <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 ml-1">Seating Strategy (Algorithm)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'ai', color: 'indigo', title: 'Advanced AI (Agents)', desc: 'Simulated Annealing search for best placement.' },
                  { id: 'lr', color: 'purple', title: 'Fast-Sort (Linear Regression)', desc: 'Direct assignment using linear priority scores.' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setAlgorithm(opt.id)}
                    className={`relative p-6 rounded-3xl border-2 transition-all text-left overflow-hidden group ${algorithm === opt.id ? `bg-${opt.color}-500/10 border-${opt.color}-500 shadow-[0_0_40px_rgba(99,102,241,0.2)]` : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                    <div className="font-black text-white text-lg tracking-tight">{opt.title}</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">{opt.desc}</div>
                    {algorithm === opt.id && <div className="absolute top-0 right-0 p-4"><div className={`w-2 h-2 bg-${opt.color}-500 rounded-full animate-pulse`} /></div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Dimensions */}
            <div className="bg-slate-900/40 border border-white/10 rounded-[32px] p-10 backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-indigo-400" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Grid Dimensions</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                {[
                  { label: 'Total Rows',          val: rows,        set: v => { setIsManualGrid(true); setRows(v); } },
                  { label: 'Total Columns',       val: cols,        set: v => { setIsManualGrid(true); setCols(v); } },
                  { label: 'Buffer Seats (Free)', val: bufferSeats, set: setBufferSeats },
                ].map(({ label, val, set }) => (
                  <div key={label} className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{label}</label>
                    <input type="number" value={val} onChange={e => set(Number(e.target.value))}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white text-xl font-black transition-all" />
                  </div>
                ))}
              </div>
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-[24px] p-6 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-indigo-400 mt-0.5" />
                <p className="text-sm font-medium text-slate-300 leading-relaxed">
                  Hall capacity: <strong className="text-white">{rows * cols}</strong> seats.
                  Roster: <strong className="text-indigo-400">{students.length}</strong> + buffer: <strong className="text-indigo-400">{bufferSeats}</strong>.
                </p>
              </div>
              <div className="mt-8 flex justify-end">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">Auto-Fit Grid</span>
                  <div onClick={() => setIsManualGrid(!isManualGrid)}
                    className={`w-12 h-6 rounded-full p-1 transition-all shadow-inner cursor-pointer ${!isManualGrid ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-all transform ${!isManualGrid ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </label>
              </div>
            </div>

            {/* Subjects */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 relative z-10">
                <Users className="w-8 h-8 text-purple-400" /> Subjects
              </h2>
              <div className="flex flex-wrap gap-3 mb-6 relative z-10">
                {subjects.map(sub => (
                  <span key={sub} className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-200 rounded-xl text-sm font-medium flex items-center gap-2">
                    {sub}
                    <button onClick={() => setSubjects(subjects.filter(s => s !== sub))} className="text-purple-400 hover:text-white transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input type="text" placeholder="Type a subject and press Enter..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all relative z-10"
                onKeyDown={e => { if (e.key === 'Enter' && e.target.value) { setSubjects([...subjects, e.target.value]); e.target.value = ''; } }} />
            </div>
          </div>
        )}

        {/* ════════════════════ ROSTER TAB ════════════════════ */}
        {activeTab === 'roster' && (
          <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-180px)] animate-in fade-in slide-in-from-bottom-12 duration-1000">

            {/* LEFT: Add/Edit Form */}
            <div className="w-full lg:w-[400px] flex-none bg-slate-900/40 border border-white/10 rounded-[32px] p-8 overflow-y-auto custom-scrollbar backdrop-blur-3xl shadow-2xl">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                    {editingId ? <Edit2 className="w-6 h-6 text-amber-400" /> : <UserPlus className="w-6 h-6 text-emerald-400" />}
                    {editingId ? 'Edit Student' : 'Add Student'}
                  </h2>
                  {editingId && (
                    <button onClick={cancelEdit} className="text-[10px] font-black text-slate-500 uppercase hover:text-white transition-colors">Cancel</button>
                  )}
                </div>

                <form onSubmit={handleSaveStudent} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Student ID</label>
                    <input required type="text" value={newStudentId} onChange={e => setNewStudentId(e.target.value)} placeholder="e.g. 101"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-mono text-white placeholder:text-slate-800" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                    <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Mahad Khan"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white placeholder:text-slate-800 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Course / Subject</label>
                    <select value={newSubject} onChange={e => setNewSubject(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none text-white font-medium">
                      {subjects.length === 0 && <option value="AI">AI</option>}
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* ── FIX 2: "Requires Supervision" checkbox — isHighRisk toggle ── */}
                  {/* This was already correct in your form. isHighRisk IS saved per   */}
                  {/* student. OCR sets it false by default. To mark a student as Watch */}
                  {/* just edit them and check this box. The badge in the table reads   */}
                  {/* s.isHighRisk and shows Watch/Standard correctly.                  */}
                  <label className="group/check flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer hover:bg-white/[0.05] transition-all">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={newIsHighRisk} onChange={e => setNewIsHighRisk(e.target.checked)}
                        className="peer appearance-none w-6 h-6 rounded-lg border-2 border-slate-800 checked:border-red-500 checked:bg-red-500/20 transition-all cursor-pointer" />
                      <AlertTriangle className="absolute w-3.5 h-3.5 text-red-500 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-300 uppercase tracking-widest group-hover/check:text-red-400 transition-colors">Requires Supervision</div>
                      <div className="text-[10px] text-slate-600 mt-0.5 italic">Keep away from hidden corners</div>
                    </div>
                  </label>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Link className="w-3 h-3" /> Link Friends
                      </label>
                      <div className="text-[9px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">{newFriends.length} Selected</div>
                    </div>
                    <input type="text" placeholder="Search friends..." value={friendSearch} onChange={e => setFriendSearch(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700" />
                    <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                      {students
                        .filter(s => s.id !== editingId)
                        .filter(s => !friendSearch || s.name.toLowerCase().includes(friendSearch.toLowerCase()) || s.id.toLowerCase().includes(friendSearch.toLowerCase()))
                        .map(s => (
                        <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${newFriends.some(fid => String(fid) === String(s.id)) ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`}>
                          <div className="relative flex items-center justify-center">
                            <input type="checkbox" checked={newFriends.some(fid => String(fid) === String(s.id))} onChange={() => toggleFriendSelection(s.id)}
                              className="peer appearance-none w-5 h-5 rounded-lg border-2 border-slate-800 checked:border-indigo-500 checked:bg-indigo-500 transition-all cursor-pointer" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                              <div className="w-2 h-2 bg-white rounded-sm rotate-45"></div>
                            </div>
                          </div>
                          <div className="flex flex-col flex-1 truncate">
                            <span className={`text-xs font-bold truncate ${newFriends.some(fid => String(fid) === String(s.id)) ? 'text-white' : 'text-slate-400'}`}>{s.name}</span>
                            <span className="text-[9px] text-slate-700 font-black uppercase tracking-tighter truncate">{s.id} • {s.subject}</span>
                          </div>
                          {newFriends.some(fid => String(fid) === String(s.id)) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)]"></div>}
                        </label>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:translate-y-0 ${editingId ? 'bg-amber-600' : 'bg-indigo-600'}`}>
                    <Save className="w-4 h-4" /> {editingId ? 'Update Profile' : 'Save Student'}
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT: Roster Table */}
            <div className="flex-1 bg-slate-900/40 border border-white/10 rounded-[32px] overflow-hidden flex flex-col backdrop-blur-3xl shadow-2xl">
              <div className="p-5 flex flex-col h-full space-y-4">

                {/* Header row */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-xl font-black text-white tracking-tight">Roster Directory</h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{students.length} Enrolled</span>
                  </div>

                  {/* ── FIX 3: Two upload buttons — Image (Camera) + CSV/Excel ─── */}
                  {/* The old code only had the Camera button with accept="image/*".  */}
                  {/* Both now call the same handleFileUpload which routes by ext.    */}
                  <div className="flex items-center gap-2">
                    {/* Image upload */}
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-slate-400 cursor-pointer hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest" title="Upload roster image (JPG/PNG)">
                      <Camera className="w-3 h-3" /> Upload Image
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>

                    {/* CSV / Excel upload */}
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-400 cursor-pointer hover:bg-emerald-500/20 hover:text-white transition-all uppercase tracking-widest" title="Upload CSV or Excel (.csv / .xlsx)">
                      <FileSpreadsheet className="w-3 h-3" /> Upload CSV / Excel
                      <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                    </label>

                    <button onClick={handleRunOptimization} disabled={students.length === 0}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                      Generate Plan <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative flex-none px-2">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <input type="text" placeholder="Search students..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all text-xs font-medium placeholder:text-slate-800 text-white" />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-hidden flex flex-col bg-black/30 rounded-xl border border-white/5 shadow-inner">
                  <div className="overflow-y-auto custom-scrollbar h-full">
                    <table className="w-full text-left text-[11px] border-collapse min-w-[800px]">
                      <thead className="bg-slate-900/60 border-b border-white/5 sticky top-0 z-20">
                        <tr>
                          <th className="px-5 py-3 font-black text-slate-600 uppercase tracking-widest w-16">ID</th>
                          <th className="px-5 py-3 font-black text-slate-600 uppercase tracking-widest">Student Name</th>
                          <th className="px-5 py-3 font-black text-slate-600 uppercase tracking-widest">Course</th>
                          <th className="px-5 py-3 font-black text-slate-600 uppercase tracking-widest">Status</th>
                          <th className="px-5 py-3 font-black text-slate-600 uppercase tracking-widest">Friends With</th>
                          <th className="px-5 py-3 font-black text-slate-600 uppercase tracking-widest text-right pr-8">Ops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {students
                          .filter(s =>
                            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            String(s.id).includes(searchTerm) ||
                            s.subject.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map(s => (
                          <tr key={s.id} className="hover:bg-indigo-500/[0.03] transition-all group/row">
                            <td className="px-5 py-3 font-mono text-indigo-400 font-bold">{s.id}</td>
                            <td className="px-5 py-3 font-bold text-white/90">{s.name}</td>
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 bg-white/5 rounded-md border border-white/10 text-slate-400 font-bold uppercase text-[9px]">{s.subject}</span>
                            </td>
                            <td className="px-5 py-3">
                              {/* ── FIX 2 (table side): reads s.isHighRisk correctly ── */}
                              {s.isHighRisk ? (
                                <span className="flex items-center gap-1 text-red-400 font-black text-[8px] uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md w-fit">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Watch
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-black text-[8px] uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                  Standard
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-1">
                                {s.friends.length > 0
                                  ? s.friends.map(fid => {
                                      const friend = students.find(st => String(st.id).trim() === String(fid).trim());
                                      if (!friend) return null;
                                      return (
                                        <span key={fid} className="px-1.5 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 text-[7px] font-black text-indigo-300 uppercase shadow-sm">
                                          {friend.name}
                                        </span>
                                      );
                                    })
                                  : <span className="text-slate-800 text-[9px]">—</span>}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right pr-8">
                              <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(s)} className="p-1.5 bg-white/5 hover:bg-amber-500 hover:text-white text-slate-600 rounded-md transition-all">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDelete(s.id)} className="p-1.5 bg-white/5 hover:bg-red-500 hover:text-white text-slate-600 rounded-md transition-all">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ GRID TAB ════════════════════ */}
        {activeTab === 'grid' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {isOptimizing ? (
              <div className="flex flex-col items-center justify-center py-40 space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <GridIcon className="w-8 h-8 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                  AI is calculating the optimal seating...
                </h3>
                <p className="text-slate-400 text-center max-w-md">Running constraint satisfaction algorithm to ensure friends are separated and courses are distributed evenly.</p>
              </div>
            ) : gridResult ? (
              <div className="space-y-8">
                {/* Stats bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-xl">
                  <div className="flex gap-6 mb-4 sm:mb-0">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-5 h-5">
                        <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping opacity-50"></div>
                        <div className="w-3 h-3 rounded-full bg-red-500 border border-red-400 relative z-10 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                      </div>
                      <span className="text-sm font-semibold text-slate-300">Requires Supervision</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-white/10 border border-white/20"></div>
                      <span className="text-sm font-semibold text-slate-300">Empty Seat</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest animate-pulse">Click seat for KNN Neighbors</span>
                    </div>
                  </div>
                  {optStats && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        AI Optimization: {Math.max(0, Math.round(((optStats.initial - optStats.final) / (optStats.initial || 1)) * 100))}% Improvement
                      </div>
                      <div className="text-sm font-bold bg-black/40 px-5 py-2.5 rounded-xl border border-white/5 flex items-center shadow-inner">
                        <span className="text-slate-400 text-xs">Initial: <span className="text-slate-200">{optStats.initial}</span></span>
                        <ArrowRight className="mx-4 w-4 h-4 text-indigo-500" />
                        <span className="text-indigo-400">Optimized: <span className="text-white bg-indigo-500/20 px-2 py-0.5 rounded ml-1">{optStats.final}</span></span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* KNN Inspector */}
                  <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl sticky top-28">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-indigo-400" /> KNN Inspector
                      </h3>
                      {!selectedStudent ? (
                        <div className="text-sm text-slate-500 italic py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                          Click any seat to analyze neighbors using KNN.
                        </div>
                      ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Selected</div>
                            <div className="font-bold text-lg">{selectedStudent.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{selectedStudent.subject}</div>
                          </div>
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">K=4 Neighbors</div>
                            <div className="space-y-2">
                              {neighbors.map((n, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                  <div>
                                    <div className="text-sm font-medium">{n.name}</div>
                                    <div className="text-[10px] text-slate-500">{n.subject}</div>
                                  </div>
                                  {(n.subject === selectedStudent.subject && (selectedStudent.friends?.includes(n.id) || n.friends?.includes(selectedStudent.id))) ? (
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold border border-red-500/30">RISK</span>
                                  ) : (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30">SAFE</span>
                                  )}
                                </div>
                              ))}
                              {neighbors.length === 0 && <div className="text-xs text-slate-600 italic">No neighbors.</div>}
                            </div>
                          </div>
                          <div className="pt-4 border-t border-white/5">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Risk Analysis</div>
                            {neighbors.some(n => n.subject === selectedStudent.subject && (selectedStudent.friends?.includes(n.id) || n.friends?.includes(selectedStudent.id))) ? (
                              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                High Vulnerability — friends in same course nearby!
                              </div>
                            ) : (
                              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-3">
                                <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">✓</div>
                                Low risk — no high-vulnerability matches nearby.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seating Grid */}
                  <div className="lg:col-span-9">
                    <div className="w-full overflow-x-auto pb-8 custom-scrollbar">
                      <div className="bg-black/40 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl min-w-max mx-auto">
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                          {gridResult.map((row, r) =>
                            row.map((seat, c) => (
                              <div key={`${r}-${c}`} onClick={() => inspectNeighbors(r, c)}
                                className={`relative w-28 h-28 rounded-2xl border flex flex-col items-center justify-center p-3 text-center transition-all duration-300 cursor-pointer group
                                  ${selectedStudent?.r === r && selectedStudent?.c === c ? 'ring-4 ring-indigo-500 ring-offset-4 ring-offset-black scale-105 z-20' : ''}
                                  ${seat
                                    ? seat.isHighRisk
                                      ? 'bg-red-950/30 border-red-500/50 hover:bg-red-900/40 hover:-translate-y-1'
                                      : 'bg-white/5 border-white/10 hover:border-indigo-500/50 hover:bg-indigo-950/30 hover:-translate-y-1'
                                    : 'bg-transparent border-white/5 border-dashed opacity-50'}`}>
                                {seat ? (
                                  <>
                                    {seat.isHighRisk && (
                                      <div className="absolute top-2 right-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,1)]"></div>
                                      </div>
                                    )}
                                    <div className="font-bold text-base text-white truncate w-full group-hover:text-indigo-200 transition-colors" title={seat.name}>
                                      {seat.name?.split(' ')[0] || 'Student'}
                                    </div>
                                     <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                      ID: {seat.id}
                                    </div>
                                    <div className="text-xs font-bold text-indigo-400 mt-1.5 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 truncate max-w-full">
                                      {seat.subject || 'N/A'}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs font-medium text-slate-600">Empty</div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 space-y-5 bg-white/[0.01] rounded-3xl border border-white/5">
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                  <GridIcon className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-300">No Seating Chart Active</h3>
                <p className="text-slate-500 text-center max-w-sm">Return to the Roster and click "Generate Plan".</p>
                <button onClick={() => setActiveTab('roster')} className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all">
                  Return to Roster
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}