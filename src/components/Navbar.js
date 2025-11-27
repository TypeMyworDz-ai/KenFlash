import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; // Import useTheme
import './Navbar.css';

function Navbar() {
  const { isLoggedIn, userRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme(); // Use theme and toggleTheme from context
  const navigate = useNavigate();
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openPolicyDropdown = () => {
    clearTimeout(dropdownTimeoutRef.current);
    setIsPolicyDropdownOpen(true);
  };

  const closePolicyDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsPolicyDropdownOpen(false);
    }, 200);
  };

  const closeAllDropdownsImmediately = () => {
    clearTimeout(dropdownTimeoutRef.current);
    setIsPolicyDropdownOpen(false);
  };

  const getBrandRedirectPath = () => {
    if (isLoggedIn) {
      if (userRole === 'admin') {
        return '/admin-dashboard';
      } else if (userRole === 'creator') {
        return '/user-dashboard';
      }
    }
    return '/';
  };

  return (
    <nav className="navbar">
      <Link to={getBrandRedirectPath()} className="navbar-brand" onClick={closeAllDropdownsImmediately}>
        KenFlash
      </Link>
      <div className="navbar-links">
        {/* Theme Toggle Button */}
        <button onClick={toggleTheme} className="navbar-item theme-toggle-button">
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>

        {isLoggedIn ? (
          <button onClick={handleLogout} className="navbar-item logout-button">Logout</button>
        ) : (
          <>
            <Link to="/login" className="navbar-item" onClick={closeAllDropdownsImmediately}>Login</Link>
            <Link to="/user-signup" className="navbar-item" onClick={closeAllDropdownsImmediately}>Sign Up</Link>
            <Link to="/subscribe" className="navbar-item pricing-link" onClick={closeAllDropdownsImmediately}>Pricing</Link>
          </>
        )}
        <div 
          className="dropdown" 
          onMouseEnter={openPolicyDropdown} 
          onMouseLeave={closePolicyDropdown}
        >
          <button className="navbar-item dropdown-toggle">Policy</button>
          {isPolicyDropdownOpen && (
            <div className="dropdown-menu">
              <Link to="/terms" className="dropdown-item" onClick={closeAllDropdownsImmediately}>Terms of Service</Link>
              <Link to="/privacy" className="dropdown-item" onClick={closeAllDropdownsImmediately}>Privacy Policy</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
