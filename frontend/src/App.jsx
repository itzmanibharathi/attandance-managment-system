import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import DetailedDashboard from './pages/DetailedDashboard.jsx';
import Navbar from './components/Navbar.jsx';
import './App.css';

const App = () => {
  return (
    <Router>
      <Navbar />
      <div className="container mt-4">
        <Routes>
          {/* Start at /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" />} />

          {/* Main routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/attendance" element={<DetailedDashboard />} />

          {/* Catch-all route redirects to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;