import React, { useState, useRef } from 'react'; // Import useRef
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { isLoggedIn, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef(null); // Ref to store the timeout ID

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Function to open the dropdown
  const openPolicyDropdown = () => {
    clearTimeout(dropdownTimeoutRef.current); // Clear any pending close
    setIsPolicyDropdownOpen(true);
  };

  // Function to close the dropdown with a delay
  const closePolicyDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsPolicyDropdownOpen(false);
    }, 200); // 200ms delay
  };

  // Function to close all dropdowns immediately on navigation
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
        KenyaFlashing
      </Link>
      <div className="navbar-links">
        {isLoggedIn ? (
          <button onClick={handleLogout} className="navbar-item logout-button">Logout</button>
        ) : (
          <>
            <Link to="/login" className="navbar-item" onClick={closeAllDropdownsImmediately}>Login</Link>
            <Link to="/user-signup" className="navbar-item" onClick={closeAllDropdownsImmediately}>Sign Up</Link>
            <Link to="/subscribe" className="navbar-item pricing-link" onClick={closeAllDropdownsImmediately}>Pricing</Link>
          </>
        )}
        {/* Policy Dropdown - now uses onMouseEnter/Leave on the parent div */}
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
