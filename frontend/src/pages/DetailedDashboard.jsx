import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DetailedDashboard = () => {
  const [overall, setOverall] = useState({});
  const [topBottom, setTopBottom] = useState({ top5: [], bottom5: [] });
  const [locations, setLocations] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const fetchData = async () => {
    const params = startDate && endDate ? `?start=${startDate.toISOString().split('T')[0]}&end=${endDate.toISOString().split('T')[0]}` : '';
    try {
      const [o, t, l] = await Promise.all([
        axios.get(`https://attandance-managment-system-1.onrender.com/attendance/overall${params}`),
        axios.get(`https://attandance-managment-system-1.onrender.com/attendance/topbottom${params}`),
        axios.get(`https://attandance-managment-system-1.onrender.com/attendance/locations${params}`)
      ]);
      setOverall(o.data);
      setTopBottom(t.data);
      setLocations(l.data);
    } catch { toast.error('Failed to load analytics'); }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const searchStudents = async () => {
    if (!searchTerm.trim()) return setStudents([]);
    try {
      const res = await axios.get(`https://attandance-managment-system-1.onrender.com/students/search?q=${encodeURIComponent(searchTerm)}`);
      setStudents(res.data);
    } catch { toast.error('Search failed'); }
  };

  const fetchHistory = async (regno) => {
    const params = startDate && endDate ? `?start=${startDate.toISOString().split('T')[0]}&end=${endDate.toISOString().split('T')[0]}` : '';
    try {
      const { data } = await axios.get(`https://attandance-managment-system-1.onrender.com/attendance/history/${regno}${params}`);
      setHistory(data);
    } catch { toast.error('Failed to load history'); }
  };

  const handleSelect = (s) => {
    setSelectedStudent(s);
    fetchHistory(s.RegNo);
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
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-fluid py-5 px-4" style={{ background: '#f8f9ff' }}>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5">
        <h1 className="h2 fw-bold text-primary">Detailed Attendance Analytics</h1>
        <div className="d-flex gap-2 mt-3 mt-md-0">
          <DatePicker selected={startDate} onChange={setStartDate} className="form-control form-control-sm rounded-pill" placeholderText="From" />
          <DatePicker selected={endDate} onChange={setEndDate} className="form-control form-control-sm rounded-pill" placeholderText="To" />
          <button onClick={() => { setStartDate(null); setEndDate(null); }} className="btn btn-outline-secondary btn-sm rounded-pill">Clear</button>
        </div>
      </div>

      {/* Top & Bottom 5 */}
      <div className="row g-4 mb-5">
        <div className="col-lg-6">
          <div className="card shadow-lg border-0 h-100 bg-white hover-lift">
            <div className="card-body">
              <h5 className="text-success fw-bold mb-4">Top 5 Attendees</h5>
              <Bar data={{ labels: topBottom.top5?.map(s => s.Name) || [], datasets: [{ data: topBottom.top5?.map(s => s.percentage) || [], backgroundColor: '#635eff' }] }} />
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-lg border-0 h-100 bg-white hover-lift">
            <div className="card-body">
              <h5 className="text-danger fw-bold mb-4">Bottom 5 Attendees</h5>
              <Bar data={{ labels: topBottom.bottom5?.map(s => s.Name) || [], datasets: [{ data: topBottom.bottom5?.map(s => s.percentage) || [], backgroundColor: '#ff6b6b' }] }} />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Student Detail */}
      <div className="card shadow-lg border-0 mb-4 hover-lift">
        <div className="card-body">
          <div className="input-group">
            <input
              type="text"
              className="form-control rounded-pill"
              placeholder="Search by Name or RegNo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyUp={searchStudents}
            />
            <button className="btn btn-primary rounded-pill ms-2" onClick={searchStudents}>Search</button>
          </div>
          {students.length > 0 && (
            <div className="list-group mt-3">
              {students.map(s => (
                <button key={s.id} className="list-group-item list-group-item-action d-flex align-items-center p-3" onClick={() => handleSelect(s)}>
                  <img src={s.photo || 'https://via.placeholder.com/50'} className="rounded-circle me-3" width={50} height={50} alt="" />
                  <div className="text-start">
                    <div className="fw-bold text-primary">{s.Name}</div>
                    <small className="text-muted">{s.RegNo} • {s.Department}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="card shadow-lg border-primary hover-lift">
          <div className="card-body">
            <div className="row align-items-center mb-4">
              <div className="col-md-3 text-center">
                <img src={selectedStudent.photo || 'https://via.placeholder.com/150'} className="rounded-circle border border-primary border-5" style={{ width: 140, height: 140, objectFit: 'cover' }} alt="" />
              </div>
              <div className="col-md-9">
                <h4 className="text-primary fw-bold">{selectedStudent.Name}</h4>
                <p><strong>RegNo:</strong> {selectedStudent.RegNo}</p>
                <p><strong>Department:</strong> {selectedStudent.Department || '—'}</p>
                <p><strong>Phone:</strong> {selectedStudent.Phone || '—'}</p>
                <button className="btn btn-primary btn-sm rounded-pill" onClick={downloadCSV}>Download CSV</button>
              </div>
            </div>
            <h5 className="text-primary fw-bold">Attendance History</h5>
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="bg-primary text-white">
                  <tr><th>Date</th><th>Status</th><th>Reason</th><th>Time In</th><th>Time Out</th></tr>
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
          </div>
        </div>
      )}

      <style jsx>{`
        .hover-lift { transition: all 0.4s ease; }
        .hover-lift:hover { transform: translateY(-10px); box-shadow: 0 25px 50px rgba(99,94,255,0.25) !important; }
      `}</style>
      <ToastContainer />
    </div>
  );
};


export default DetailedDashboard;
