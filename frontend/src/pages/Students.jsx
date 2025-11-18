import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Pie, Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const Students = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const fileInputRef = useRef(null);

  const initialForm = { Name: '', Gender: '', RegNo: '', Phone: '', Email: '', BloodGroup: '', Department: '', DOB: '' };
  const [formData, setFormData] = useState(initialForm);

  const fetchStudents = async () => {
    try {
      const { data } = await axios.get('http://localhost:3000/students');
      setStudents(data.sort((a, b) => a.RegNo.localeCompare(b.RegNo)));
    } catch { toast.error('Failed to load students'); }
  };

  useEffect(() => { fetchStudents(); }, []);

  const fetchHistory = async (regno) => {
    const params = startDate && endDate ? `?start=${startDate.toISOString().split('T')[0]}&end=${endDate.toISOString().split('T')[0]}` : '';
    try {
      const { data } = await axios.get(`http://localhost:3000/attendance/history/${regno}${params}`);
      setHistory(data);
    } catch { toast.error('Failed to load history'); }
  };

  const handleCardClick = (student) => {
    setSelectedStudent(student);
    setActiveTab('profile');
    setStartDate(null); setEndDate(null);
    fetchHistory(student.RegNo);
  };

  const handleEdit = () => {
    setFormData({ ...selectedStudent });
    setEditingId(selectedStudent.id);
    setPhotoPreview(selectedStudent.photo || '');
    setSelectedStudent(null);
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));
    if (photoFile) data.append('photo', photoFile);

    try {
      editingId
        ? await axios.put(`http://localhost:3000/students/${editingId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await axios.post('http://localhost:3000/students', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(editingId ? 'Updated!' : 'Added!');
      resetForm();
      fetchStudents();
    } catch { toast.error('Operation failed'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this student?')) return;
    await axios.delete(`http://localhost:3000/students/${selectedStudent.id}`);
    toast.success('Deleted');
    fetchStudents();
    setSelectedStudent(null);
  };

  const downloadCSV = () => {
    const csv = ['Date,Status,Reason,TimeIn,TimeOut'].concat(
      history.map(r => `${r.Date},${r.Status},${r.Reason || ''},${r.TimeIn || ''},${r.TimeOut || ''}`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedStudent.RegNo}_attendance.csv`;
    a.click();
  };

  const present = history.filter(r => r.Status === 'Present').length;
  const total = history.length;
  const rate = total ? ((present / total) * 100).toFixed(1) : 0;

  const pieData = {
    labels: ['Present', 'Absent'],
    datasets: [{
      data: [present, total - present],
      backgroundColor: ['#635eff', '#e0e7ff'],
      borderColor: '#fff',
      borderWidth: 3
    }]
  };

  return (
    <div className="container-fluid py-5 px-4" style={{ background: '#f8f9ff', minHeight: '100vh' }}>
      <h1 className="text-center mb-5 text-primary fw-bold display-5">Student Management System</h1>

      {/* Add/Edit Form */}
      <div className="card border-0 shadow-lg mb-5 hover-lift">
        <div className="card-body bg-white">
          <h4 className="text-primary mb-4">{editingId ? 'Update Student' : 'Add New Student'}</h4>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {['Name', 'RegNo', 'Department', 'Gender', 'Phone', 'Email', 'BloodGroup'].map(field => (
                <div className="col-md-6 col-lg-4" key={field}>
                  <input
                    type="text"
                    className="form-control rounded-pill border-primary"
                    placeholder={field}
                    value={formData[field]}
                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                    required={['Name', 'RegNo'].includes(field)}
                  />
                </div>
              ))}
              <div className="col-md-6 col-lg-4">
                <input type="date" className="form-control rounded-pill border-primary" value={formData.DOB} onChange={e => setFormData({ ...formData, DOB: e.target.value })} />
              </div>
              <div className="col-md-6 col-lg-4">
                <input ref={fileInputRef} type="file" accept="image/*" className="form-control" onChange={e => {
                  const file = e.target.files[0];
                  setPhotoFile(file);
                  if (file) setPhotoPreview(URL.createObjectURL(file));
                }} />
              </div>
              {photoPreview && (
                <div className="col-12 text-center">
                  <img src={photoPreview} alt="preview" className="rounded-circle border border-primary border-4" style={{ width: 130, height: 130, objectFit: 'cover' }} />
                </div>
              )}
            </div>
            <div className="mt-4 d-flex gap-3">
              <button type="submit" className="btn btn-primary rounded-pill px-5 shadow-lg">{editingId ? 'Update' : 'Add Student'}</button>
              {editingId && <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        </div>
      </div>

      {/* Students Grid */}
      <div className="row g-4">
        {students.map(s => (
          <div key={s.id} className="col-md-6 col-lg-4 col-xl-3">
            <div
              className="card h-100 shadow-lg border-0 text-center p-4 bg-white hover-lift cursor-pointer"
              onClick={() => handleCardClick(s)}
            >
              <img
                src={s.photo || 'https://via.placeholder.com/120'}
                className="rounded-circle border border-primary border-4 mb-3"
                style={{ width: 100, height: 100, objectFit: 'cover' }}
                alt={s.Name}
              />
              <h6 className="fw-bold text-primary">{s.Name}</h6>
              <p className="text-primary mb-1">{s.RegNo}</p>
              <small className="text-muted">{s.Department || '—'}</small>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedStudent && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setSelectedStudent(null)}></div>
          <div className="modal show d-block">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header bg-primary text-white">
                  <h5 className="mb-0">{selectedStudent.Name} ({selectedStudent.RegNo})</h5>
                  <button className="btn-close btn-close-white" onClick={() => setSelectedStudent(null)}></button>
                </div>
                <div className="modal-body">
                  <ul className="nav nav-tabs mb-4 border-bottom border-primary">
                    {['profile', 'history', 'analytics'].map(tab => (
                      <li className="nav-item" key={tab}>
                        <button
                          className={`nav-link fw-bold text-uppercase ${activeTab === tab ? 'active text-primary bg-light' : 'text-primary'}`}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab === 'analytics' ? 'Analytics' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* All tabs preserved with blue theme */}
                  {activeTab === 'profile' && (
                    <div className="row">
                      <div className="col-md-4 text-center">
                        <img src={selectedStudent.photo || 'https://via.placeholder.com/200'} className="rounded-circle border border-primary border-5" style={{ width: 180, height: 180 }} alt="" />
                      </div>
                      <div className="col-md-8">
                        <table className="table table-borderless">
                          <tbody>
                            {Object.keys(selectedStudent).filter(k => k !== 'id' && k !== 'photo').map(k => (
                              <tr key={k}><td><strong>{k}</strong></td><td>{selectedStudent[k] || '—'}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-4">
                          <button className="btn btn-outline-primary me-2" onClick={handleEdit}>Edit</button>
                          <button className="btn btn-outline-danger me-2" onClick={handleDelete}>Delete</button>
                          <button className="btn btn-primary" onClick={downloadCSV}>Download CSV</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="table-responsive" style={{ maxHeight: '500px' }}>
                      <table className="table table-striped table-hover">
                        <thead className="bg-primary text-white">
                          <tr><th>Date</th><th>Status</th><th>Reason</th><th>In</th><th>Out</th></tr>
                        </thead>
                        <tbody>
                          {history.map(r => (
                            <tr key={r.id}>
                              <td>{r.Date}</td>
                              <td><span className={`badge ${r.Status === 'Present' ? 'bg-success' : 'bg-danger'}`}>{r.Status}</span></td>
                              <td>{r.Reason || '—'}</td>
                              <td>{r.TimeIn || '—'}</td>
                              <td>{r.TimeOut || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'analytics' && (
                    <div className="text-center">
                      <div className="d-flex justify-content-center gap-2 mb-4">
                        <DatePicker selected={startDate} onChange={setStartDate} className="form-control form-control-sm rounded-pill" placeholderText="From" />
                        <DatePicker selected={endDate} onChange={setEndDate} className="form-control form-control-sm rounded-pill" placeholderText="To" />
                        <button className="btn btn-primary btn-sm rounded-pill" onClick={() => fetchHistory(selectedStudent.RegNo)}>Apply</button>
                      </div>
                      <h3 className="text-primary display-4 fw-bold">{rate}%</h3>
                      <p className="text-muted">Attendance Rate</p>
                      <div className="row g-4 mt-3">
                        <div className="col-md-6"><Pie data={pieData} /></div>
                        <div className="col-md-6"><Bar data={{ labels: ['Present', 'Absent'], datasets: [{ data: [present, total - present], backgroundColor: '#635eff' }] }} /></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .hover-lift { transition: all 0.4s ease; }
        .hover-lift:hover { transform: translateY(-12px); box-shadow: 0 25px 50px rgba(99,94,255,0.25) !important; }
        .cursor-pointer { cursor: pointer; }
        .form-control:focus { border-color: #635eff; box-shadow: 0 0 0 0.2rem rgba(99,94,255,0.25); }
      `}</style>
      <ToastContainer position="top-right" theme="light" />
    </div>
  );
};

export default Students;