import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; // Import useTheme
import './MobileNavbar.css';

function MobileNavbar() {
  const { isLoggedIn, userRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme(); // Use theme and toggleTheme from context
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsPolicyDropdownOpen(false); // Close policy dropdown if menu is toggled
  };

  const togglePolicyDropdown = () => {
    setIsPolicyDropdownOpen(!isPolicyDropdownOpen);
  };

  const closeAllMenus = () => {
    setIsMenuOpen(false);
    setIsPolicyDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeAllMenus();
    navigate('/');
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
    <nav className="mobile-navbar">
      <Link to={getBrandRedirectPath()} className="mobile-navbar-brand" onClick={closeAllMenus}>
        KenFlash
      </Link>
      <button className="hamburger-menu" onClick={toggleMenu}>
        &#9776; {/* Hamburger icon */}
      </button>

      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={toggleMenu}>
          <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-menu-button" onClick={toggleMenu}>&times;</button>
            <Link to={getBrandRedirectPath()} className="mobile-menu-item brand-item" onClick={closeAllMenus}>
              KenFlash
            </Link>
            {isLoggedIn ? (
              <>
                {userRole === 'admin' && (
                  <>
                    <Link to="/admin-dashboard" className="mobile-menu-item" onClick={closeAllMenus}>Admin Dashboard</Link>
                    <Link to="/admin-messages" className="mobile-menu-item" onClick={closeAllMenus}>Admin Messages</Link>
                    <Link to="/admin-traffic" className="mobile-menu-item" onClick={closeAllMenus}>Admin Traffic</Link>
                    <Link to="/admin-manage-ads" className="mobile-menu-item" onClick={closeAllMenus}>Manage Ads</Link>
                    <Link to="/admin-pending-creators" className="mobile-menu-item" onClick={closeAllMenus}>Pending Creators</Link>
                    <Link to="/admin-all-creators" className="mobile-menu-item" onClick={closeAllMenus}>All Creators</Link>
                    <Link to="/admin-content-moderation" className="mobile-menu-item" onClick={closeAllMenus}>Content Moderation</Link>
                    <Link to="/admin-manage-viewers" className="mobile-menu-item" onClick={closeAllMenus}>Manage Viewers</Link>
                    <Link to="/admin-payment-overviews" className="mobile-menu-item" onClick={closeAllMenus}>Payment Overviews</Link>
                  </>
                )}
                {userRole === 'creator' && (
                  <>
                    <Link to="/user-dashboard" className="mobile-menu-item" onClick={closeAllMenus}>My Dashboard</Link>
                    <Link to="/my-content" className="mobile-menu-item" onClick={closeAllMenus}>My Content</Link>
                    <Link to="/choose-upload-type" className="mobile-menu-item" onClick={closeAllMenus}>Upload Content</Link>
                    <Link to="/my-views" className="mobile-menu-item" onClick={closeAllMenus}>My Views</Link>
                    <Link to="/payment-history" className="mobile-menu-item" onClick={closeAllMenus}>Payment History</Link>
                    <Link to="/messages" className="mobile-menu-item" onClick={closeAllMenus}>Messages</Link>
                    <Link to="/my-profile" className="mobile-menu-item" onClick={closeAllMenus}>My Profile</Link>
                    <Link to="/profile-settings" className="mobile-menu-item" onClick={closeAllMenus}>Profile Settings</Link>
                  </>
                )}
                <button onClick={handleLogout} className="mobile-menu-item logout-button">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="mobile-menu-item" onClick={closeAllMenus}>Login</Link>
                <Link to="/user-signup" className="mobile-menu-item" onClick={closeAllMenus}>Sign Up</Link>
                <Link to="/subscribe" className="mobile-menu-item" onClick={closeAllMenus}>Subscribe</Link>
              </>
            )}

            {/* Theme Toggle Button for Mobile */}
            <button onClick={toggleTheme} className="mobile-menu-item theme-toggle-button">
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            
            {/* Policy Dropdown for Mobile */}
            <div className="mobile-policy-dropdown">
              <button className="mobile-menu-item dropdown-toggle" onClick={togglePolicyDropdown}>
                Policy {isPolicyDropdownOpen ? '▲' : '▼'}
              </button>
              {isPolicyDropdownOpen && (
                <div className="mobile-dropdown-menu">
                  <Link to="/terms" className="mobile-dropdown-item" onClick={closeAllMenus}>Terms of Service</Link>
                  <Link to="/privacy" className="mobile-dropdown-item" onClick={closeAllMenus}>Privacy Policy</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default MobileNavbar;
