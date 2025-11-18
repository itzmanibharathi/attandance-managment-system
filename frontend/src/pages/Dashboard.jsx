import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const [data, setData] = useState({
    totalStudents: 0,
    totalAcademicDays: 0,
    totalDaysPresent: 0,
    totalDaysAbsent: 0,
    approvedLeaves: 0,
    unapprovedAbsences: 0,
    attendanceRate: 0,
    absenteeismRate: 0,
    attendanceByDept: {},
    absenceReasons: {},
    monthlyTrends: {}
  });

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const fetchData = async () => {
    const params = startDate && endDate
      ? `?start=${startDate.toISOString().split('T')[0]}&end=${endDate.toISOString().split('T')[0]}`
      : '';
    try {
      const res = await axios.get(`https://attandance-managment-system-1.onrender.com/attendance/overall${params}`);
      setData(res.data);
    } catch {
      toast.error('Failed to load dashboard');
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const applyFilter = () => {
    fetchData();
  };

  const clearFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  // Chart Data
  const attendanceGauge = {
    datasets: [{
      data: [data.attendanceRate, 100 - data.attendanceRate],
      backgroundColor: ['#635eff', '#e0e7ff'],
      borderWidth: 0,
      borderRadius: 10,
      circumference: 180,
      rotation: -90
    }]
  };

  const absenteeismGauge = {
    datasets: [{
      data: [data.absenteeismRate, 100 - data.absenteeismRate],
      backgroundColor: ['#ff6b6b', '#ffe0e0'],
      borderWidth: 0,
      borderRadius: 10,
      circumference: 180,
      rotation: -90
    }]
  };

  const deptData = {
    labels: Object.keys(data.attendanceByDept || {}),
    datasets: [{
      label: 'Attendance %',
      data: Object.values(data.attendanceByDept || {}),
      backgroundColor: '#635eff',
      borderRadius: 8,
      barThickness: 20
    }]
  };

  const reasonData = {
    labels: Object.keys(data.absenceReasons || {}),
    datasets: [{
      data: Object.values(data.absenceReasons || {}),
      backgroundColor: ['#635eff', '#ff6b6b', '#ffa726', '#66bb6a', '#42a5f5'],
      borderWidth: 3,
      borderColor: '#fff'
    }]
  };

  const monthlyLabels = Object.keys(data.monthlyTrends || {}).sort();
  const monthlyData = monthlyLabels.map(m => data.monthlyTrends[m] || 0);

  const trendData = {
    labels: monthlyLabels,
    datasets: [{
      label: 'Attendance %',
      data: monthlyData,
      borderColor: '#635eff',
      backgroundColor: 'rgba(99, 94, 255, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#635eff',
      pointRadius: 6,
      pointHoverRadius: 8
    }]
  };

  return (
    <div className="container-fluid py-5 px-4" style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #e6efff 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5">
        <h1 className="h2 fw-bold text-primary mb-3 mb-md-0">
          Attendance Overview
        </h1>
        <div className="d-flex flex-wrap gap-2">
          <DatePicker selected={startDate} onChange={setStartDate} placeholderText="From Date" className="form-control form-control-sm rounded-pill" />
          <DatePicker selected={endDate} onChange={setEndDate} placeholderText="To Date" className="form-control form-control-sm rounded-pill" />
          <button onClick={applyFilter} className="btn btn-primary btn-sm rounded-pill px-4 shadow-sm">Apply</button>
          <button onClick={clearFilter} className="btn btn-outline-secondary btn-sm rounded-pill">Clear</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-4 mb-5">
        {[
          { icon: 'bi-people-fill', label: 'Total Students', value: data.totalStudents, color: 'primary' },
          { icon: 'bi-calendar-check-fill', label: 'Academic Days', value: data.totalAcademicDays, color: 'info' },
          { icon: 'bi-check-circle-fill', label: 'Days Present', value: data.totalDaysPresent, color: 'success' },
          { icon: 'bi-x-circle-fill', label: 'Days Absent', value: data.totalDaysAbsent, color: 'danger' },
          { icon: 'bi-patch-check-fill', label: 'Approved Leaves', value: data.approvedLeaves, color: 'success' },
          { icon: 'bi-exclamation-triangle-fill', label: 'Unapproved', value: data.unapprovedAbsences, color: 'warning' }
        ].map((item, i) => (
          <div key={i} className="col-6 col-md-4 col-lg-2">
            <div className="card border-0 shadow-lg h-100 text-center p-4 bg-white hover-lift">
              <i className={`bi ${item.icon} text-${item.color} fs-1 mb-3`}></i>
              <p className="small text-muted mb-1">{item.label}</p>
              <h3 className="fw-bold text-dark">{item.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="row g-4">
        {/* Attendance Rate */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-lg h-100 bg-white hover-lift">
            <div className="card-body text-center">
              <h5 className="text-primary fw-bold mb-4">Attendance Rate</h5>
              <Doughnut data={attendanceGauge} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
              <h3 className="mt-3 text-primary fw-bold">{data.attendanceRate}%</h3>
            </div>
          </div>
        </div>

        {/* Absenteeism Rate */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-lg h-100 bg-white hover-lift">
            <div className="card-body text-center">
              <h5 className="text-danger fw-bold mb-4">Absenteeism Rate</h5>
              <Doughnut data={absenteeismGauge} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
              <h3 className="mt-3 text-danger fw-bold">{data.absenteeismRate}%</h3>
            </div>
          </div>
        </div>

        {/* Department Wise */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-lg h-100 bg-white hover-lift">
            <div className="card-body">
              <h5 className="text-primary fw-bold mb-4">By Department</h5>
              <Bar data={deptData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        </div>

        {/* Absence Reasons */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-lg h-100 bg-white hover-lift">
            <div className="card-body">
              <h5 className="text-primary fw-bold mb-4">Absence Reasons</h5>
              <Doughnut data={reasonData} options={{ responsive: true }} />
            </div>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-lg h-100 bg-white hover-lift">
            <div className="card-body">
              <h5 className="text-primary fw-bold mb-4">Monthly Attendance Trend</h5>
              <Line data={trendData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Effects */}
      <style jsx>{`
        .hover-lift {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-lift:hover {
          transform: translateY(-12px);
          box-shadow: 0 25px 50px rgba(99, 94, 255, 0.25) !important;
        }
        .form-control:focus {
          border-color: #635eff !important;
          box-shadow: 0 0 0 0.2rem rgba(99, 94, 255, 0.25) !important;
        }
      `}</style>

      <ToastContainer position="top-right" theme="light" autoClose={3000} />
    </div>
  );
};


export default Dashboard;
