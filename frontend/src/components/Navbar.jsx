import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <>
      <nav
        className="navbar navbar-expand-lg fixed-top shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #635eff 0%, #4c3eff 100%)',
          borderBottom: '4px solid #4c3eff',
          backdropFilter: 'blur(10px)',
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          zIndex: 1050
        }}
      >
        <div className="container-fluid px-4 px-lg-5">
          {/* Brand */}
          <NavLink className="navbar-brand text-white fw-bold fs-4" to="/">
            Attendance Pro
          </NavLink>

          {/* Mobile Toggle */}
          <button
            className="navbar-toggler border-0"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navigation Links */}
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center gap-4">
              {/* Main Links */}
              {[
                { path: '/dashboard', label: 'Dashboard' },
                { path: '/students', label: 'Students' },
                { path: '/attendance', label: 'Take Attendance' }
              ].map(item => (
                <li className="nav-item" key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-link px-4 py-2 rounded-pill fw-semibold transition-all ${
                        isActive
                          ? 'bg-white text-primary shadow-lg'
                          : 'text-white hover-glow'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}

              
            </ul>
          </div>
        </div>
      </nav>

      {/* Professional Hover & Glow Effects */}
      <style jsx>{`
        .transition-all {
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .hover-glow:hover {
          background: rgba(255, 255, 255, 0.22) !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(99, 94, 255, 0.4) !important;
        }

        .hover-primary-bg:hover {
          background: white !important;
          color: #635eff !important;
          border-color: white !important;
          box-shadow: 0 12px 35px rgba(99, 94, 255, 0.5) !important;
          transform: translateY(-2px);
        }

        .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(255,255,255,1)' stroke-width='2.5' stroke-linecap='round' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        @media (max-width: 991px) {
          .navbar-collapse {
            background: rgba(99, 94, 255, 0.98);
            margin-top: 15px;
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .nav-link, .btn {
            text-align: center;
            margin: 8px 0;
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;