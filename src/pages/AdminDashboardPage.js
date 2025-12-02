import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

import './AdminDashboardPage.css';

// Define an admin email for testing purposes
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function AdminDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [currentAdminEmail, setCurrentAdminEmail] = useState(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === ADMIN_EMAIL) {
        setCurrentAdminEmail(user.email);
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        logout();
        navigate('/');
      }
    };

    checkAdminStatus();
  }, [navigate, logout]);

  if (!currentAdminEmail) {
    return <div className="admin-dashboard-container">Loading admin status...</div>;
  }

  return (
    <div className="admin-dashboard-container">
      <h2>Admin Dashboard</h2>
      <p>Overview of administrative tasks for Draftey.</p> {/* UPDATED: KenyaFlashing to Draftey */}

      <div className="admin-dashboard-grid">
        {/* Pending Approvals Card */}
        <Link to="/admin-pending-creators" className="admin-card-link">
          <div className="admin-card">
            <h3>Pending Creator Approvals</h3>
            <p>Review new content creators' verification documents and approve their accounts.</p>
            <button className="admin-card-button">Review Creators</button>
          </div>
        </Link>

        {/* Manage Creators Card */}
        <Link to="/admin-all-creators" className="admin-card-link">
          <div className="admin-card">
            <h3>Manage Creators</h3>
            <p>View all approved creators, their profiles, and total views.</p>
            <button className="admin-card-button">View All Creators</button>
          </div>
        </Link>

        {/* Manage Content Card */}
        <Link to="/admin-content-moderation" className="admin-card-link">
          <div className="admin-card">
            <h3>Manage Content</h3>
            <p>View all uploaded photos and videos. Take down inappropriate content.</p>
            <button className="admin-card-button">Go to Moderation</button>
          </div>
        </Link>

        {/* Payment Overviews Card */}
        <Link to="/admin-payment-overviews" className="admin-card-link">
          <div className="admin-card">
            <h3>Payment Overviews</h3>
            <p>Monitor payment histories and upcoming payouts for all creators.</p>
            <button className="admin-card-button">View Payments</button>
          </div>
        </Link>

        {/* Manage Viewers Card */}
        <Link to="/admin-manage-viewers" className="admin-card-link">
          <div className="admin-card">
            <h3>Manage Viewers</h3>
            <p>Block viewers violating policies (future feature).</p>
            <button className="admin-card-button">Manage Viewers</button>
          </div>
        </Link>

        {/* Messages Card */}
        <Link to="/admin-messages" className="admin-card-link">
          <div className="admin-card">
            <h3>Creator Messages</h3>
            <p>View and respond to messages from content creators.</p>
            <button className="admin-card-button">View Messages</button>
          </div>
        </Link>

        {/* Traffic Overview Card */}
        <Link to="/admin-traffic" className="admin-card-link">
          <div className="admin-card">
            <h3>Traffic Overview</h3>
            <p>Monitor website visits, unique visitors, and popular pages.</p>
            <button className="admin-card-button">View Traffic</button>
          </div>
        </Link>

        {/* Manage Advertisements Card - New Feature */}
        <Link to="/admin-manage-ads" className="admin-card-link">
          <div className="admin-card">
            <h3>Manage Advertisements</h3>
            <p>Upload, edit, and delete ad banners for the homepage.</p>
            <button className="admin-card-button">Manage Ads</button>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
