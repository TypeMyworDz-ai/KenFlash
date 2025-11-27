import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './UserDashboardPage.css';

function UserDashboardPage() {
  const { userRole, isUserApproved } = useAuth();

  return (
    <div className="user-dashboard-container">
      <h2>Welcome to Your Creator Dashboard!</h2>
      {userRole && <p>Logged in as: {userRole} ({isUserApproved ? 'Approved' : 'Pending Approval'})</p>}
      <p>Here you can manage your photos, videos, views, and earnings.</p>

      <div className="dashboard-sections-grid">
        {/* My Content Card */}
        <Link to={isUserApproved ? "/my-content" : "#"} className={`dashboard-card-link ${!isUserApproved ? 'disabled-link' : ''}`}>
          <div className="dashboard-card">
            <h3>My Content</h3>
            <p>View, manage, and edit all your uploaded photos and videos.</p>
            {isUserApproved ? (
              <button className="dashboard-button">View Content</button>
            ) : (
              <button className="dashboard-button disabled" disabled>View Content</button>
            )}
          </div>
        </Link>

        {/* Upload Content Card */}
        <Link to={isUserApproved ? "/choose-upload-type" : "#"} className={`dashboard-card-link ${!isUserApproved ? 'disabled-link' : ''}`}>
          <div className="dashboard-card">
            <h3>Upload New Content</h3>
            <p>Share your latest photos and videos with your audience.</p>
            {isUserApproved ? (
              <button className="dashboard-button">Start Uploading</button>
            ) : (
              <button className="dashboard-button disabled" disabled>Start Uploading</button>
            )}
          </div>
        </Link>

        {/* My Views Card */}
        <div className="dashboard-card">
          <h3>My Views</h3>
          <p>Monitor your total views and track your content's performance.</p>
          {isUserApproved ? (
            <Link to="/my-views" className="dashboard-button">View Statistics</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>View Statistics</button>
          )}
        </div>

        {/* Payment History Card */}
        <div className="dashboard-card">
          <h3>Payment History</h3>
          <p>See your earnings and upcoming payments.</p>
          {isUserApproved ? (
            <Link to="/payment-history" className="dashboard-button">Check Payments</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>Check Payments</button>
          )}
        </div>

        {/* Messages Card - New Feature */}
        <div className="dashboard-card">
          <h3>Messages</h3>
          <p>Chat with the admin team for support or inquiries.</p>
          {isUserApproved ? (
            <Link to="/messages" className="dashboard-button">Chat with Admin</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>Chat with Admin</button>
          )}
        </div>

        {/* Settings Card */}
        <div className="dashboard-card">
          <h3>Settings</h3>
          <p>Update your profile information and details.</p>
          {isUserApproved ? (
            <Link to="/profile-settings" className="dashboard-button">Edit Settings</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>Edit Settings</button>
          )}
        </div>
      </div>

      <p className="dashboard-footer">Start creating and earning today!</p>
    </div>
  );
}

export default UserDashboardPage;
