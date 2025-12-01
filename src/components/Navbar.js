import React, { useState, useRef, useEffect } from 'react'; // Added useEffect
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

function Navbar() {
  const { isLoggedIn, userType, logout } = useAuth(); // Using userType from context
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef(null);

  // --- TEMPORARY DEBUG LOGS ---
  useEffect(() => {
    console.log('Navbar - isLoggedIn:', isLoggedIn);
    console.log('Navbar - userType:', userType);
  }, [isLoggedIn, userType]);
  // --- END TEMPORARY DEBUG LOGS ---

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
      if (userType === 'admin') {
        return '/admin-dashboard';
      } else if (userType === 'creator' || userType === 'premium_creator') {
        return '/user-dashboard';
      } else if (userType === 'business') {
        return '/admin-manage-ads';
      }
    }
    return '/'; // Default to homepage if not logged in or type not matched
  };

  return (
    <nav className="navbar">
      <Link to={getBrandRedirectPath()} className="navbar-brand" onClick={closeAllDropdownsImmediately}>
        <svg className="home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </Link>
      <div className="navbar-links">
        {/* Draftey Business Link - Visible for Business and Admin */}
        {(isLoggedIn && (userType === 'business' || userType === 'admin')) && (
          <Link to="/admin-manage-ads" className="navbar-item" onClick={closeAllDropdownsImmediately}>
            Draftey Business
          </Link>
        )}

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
