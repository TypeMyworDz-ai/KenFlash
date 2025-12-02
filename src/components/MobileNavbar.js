import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './MobileNavbar.css';

function MobileNavbar() {
  // eslint-disable-next-line no-unused-vars
  const { isLoggedIn, userType, logout, user } = useAuth(); // Correctly destructuring userType
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);

  // --- DEBUGGING LOG (More explicit) ---
  // This will help us see the exact values of auth state when the navbar renders.
  console.log('MobileNavbar Auth State - isLoggedIn:', isLoggedIn, 'userType:', userType);


  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsPolicyDropdownOpen(false);
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
      if (userType === 'admin') {
        return '/admin-dashboard';
      } else if (userType === 'creator') { // Correctly using userType
        return '/user-dashboard';
      } else if (userType === 'business') { // Correctly using userType
        return '/ad-campaign-management';
      }
    }
    return '/';
  };

  const handleCameraClick = useCallback(() => {
    // Check userType here again for robustness, in case state is not immediate
    if (isLoggedIn && userType === 'creator') { // Correctly using userType
      navigate('/mobile-upload-content');
    } else if (!isLoggedIn) {
      alert("Please log in as a creator to upload content.");
      navigate('/login');
    } else {
      alert("Only creators can upload content.");
    }
    closeAllMenus();
  }, [isLoggedIn, userType, navigate]); // Correctly using userType in dependencies


  return (
    <nav className="mobile-navbar">
      {/* Home Icon on the left (SVG) */}
      <Link to="/" className="mobile-navbar-home-icon" onClick={closeAllMenus}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="icon-svg">
          <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a1.5 1.5 0 01.41 1.06V19.5a2.25 2.25 0 01-2.25 2.25H15a2.25 2.25 0 01-2.25-2.25V15a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v4.5c0 1.241-.948 2.25-2.25 2.25H5.625a2.25 2.25 0 01-2.25-2.25V13.5c0-.212.08-.416.22-.56L11.47 3.84z" />
        </svg>
      </Link>
      
      {/* Centered Camera Icon for Creators (Image) - Conditional Rendering RE-INSTATED */}
      {(isLoggedIn && userType === 'creator') && ( // Correctly using userType
        <button className="mobile-navbar-camera-button" onClick={handleCameraClick}>
          <img src="/camera-icon.png" alt="Camera Icon" className="camera-icon-img" />
        </button>
      )}

      {/* Hamburger menu on the right */}
      <button className="hamburger-menu" onClick={toggleMenu}>
        &#9776; {/* Hamburger icon */}
      </button>

      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={toggleMenu}>
          <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-menu-button" onClick={toggleMenu}>&times;</button>
            <Link to={getBrandRedirectPath()} className="mobile-menu-item brand-item" onClick={closeAllMenus}>
              Draftey
            </Link>
            {isLoggedIn ? (
              <>
                {userType === 'admin' && ( // Correctly using userType
                  <>
                    <Link to="/admin-dashboard" className="mobile-menu-item" onClick={closeAllMenus}>Admin Dashboard</Link>
                    <Link to="/admin-messages" className="mobile-menu-item" onClick={closeAllMenus}>Admin Messages</Link>
                    <Link to="/admin-traffic" className="mobile-menu-item" onClick={closeAllMenus}>Admin Traffic</Link>
                    <Link to="/ad-campaign-management" className="mobile-menu-item" onClick={closeAllMenus}>Manage Ads</Link>
                    <Link to="/admin-pending-creators" className="mobile-menu-item" onClick={closeAllMenus}>Pending Creators</Link>
                    <Link to="/admin-all-creators" className="mobile-menu-item" onClick={closeAllMenus}>All Creators</Link>
                    <Link to="/admin-content-moderation" className="mobile-menu-item" onClick={closeAllMenus}>Content Moderation</Link>
                    <Link to="/admin-manage-viewers" className="mobile-menu-item" onClick={closeAllMenus}>Manage Viewers</Link>
                    <Link to="/admin-payment-overviews" className="mobile-menu-item" onClick={closeAllMenus}>Payment Overviews</Link>
                  </>
                )}
                {userType === 'creator' && ( // Correctly using userType
                  <>
                    <Link to="/user-dashboard" className="mobile-menu-item" onClick={closeAllMenus}>Dashboard</Link>
                    <Link to="/my-content" className="mobile-menu-item" onClick={closeAllMenus}>My Content</Link>
                    <button className="mobile-menu-item" onClick={handleCameraClick}>Upload Content</button>
                    <Link to="/my-views" className="mobile-menu-item" onClick={closeAllMenus}>My Views</Link>
                    <Link to="/payment-history" className="mobile-menu-item" onClick={closeAllMenus}>Payment History</Link>
                    <Link to="/messages" className="mobile-menu-item" onClick={closeAllMenus}>Messages</Link>
                    <Link to="/my-profile" className="mobile-menu-item" onClick={closeAllMenus}>My Profile</Link>
                    <Link to="/profile-settings" className="mobile-menu-item" onClick={closeAllMenus}>Profile Settings</Link>
                  </>
                )}
                {userType === 'business' && ( // Correctly using userType
                  <Link to="/ad-campaign-management" className="mobile-menu-item" onClick={closeAllMenus}>Draftey Business</Link>
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

            <button onClick={toggleTheme} className="mobile-menu-item theme-toggle-button">
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            
            <div className="mobile-policy-dropdown">
              <button className="mobile-menu-item dropdown-toggle" onClick={togglePolicyDropdown}>
                Policy {isPolicyDropdownOpen ? '▲' : '▼'}
              </button>
              {isPolicyDropdownOpen && (
                <div className="mobile-dropdown-menu">
                  <Link to="/terms" className="mobile-menu-item" onClick={closeAllMenus}>Terms of Service</Link>
                  <Link to="/privacy" className="mobile-menu-item" onClick={closeAllMenus}>Privacy Policy</Link>
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
