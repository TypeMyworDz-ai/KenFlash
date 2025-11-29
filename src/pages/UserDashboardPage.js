import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UserDashboardPage.css';

function UserDashboardPage() {
  const { userRole, isUserApproved } = useAuth();
  const [creatorType, setCreatorType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCreatorType = async () => {
      try {
        // Get the current authenticated user directly from Supabase
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('creator_type')
            .eq('id', authUser.id)
            .single();

          if (error) {
            console.error('Error fetching creator type:', error.message);
            setCreatorType(null);
          } else if (data) {
            setCreatorType(data.creator_type);
          }
        }
      } catch (err) {
        console.error('Error fetching creator type:', err.message);
        setCreatorType(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorType();
  }, []);

  if (loading) {
    return <div className="user-dashboard-container"><p>Loading...</p></div>;
  }

  // Normal Creator Dashboard
  if (creatorType === 'normal_creator') {
    return (
      <div className="user-dashboard-container">
        <h2>Welcome to Your Creator Dashboard!</h2>
        <p className="dashboard-subtitle">Post your Drafts…</p>
        <p className="dashboard-description">Manage your content and profile settings.</p>

        <div className="dashboard-sections-grid normal-creator-grid">
          {/* Upload Content Card */}
          <Link to="/choose-upload-type" className="dashboard-card-link">
            <div className="dashboard-card upload-card">
              <h3>📤 Upload Content</h3>
              <p>Share your photos and videos with the Draftey community.</p>
              <button className="dashboard-button">Upload Photos or Videos</button>
            </div>
          </Link>

          {/* Profile Settings Card */}
          <Link to="/profile-settings" className="dashboard-card-link">
            <div className="dashboard-card settings-card">
              <h3>⚙️ Profile Settings</h3>
              <p>Update your profile picture and bio.</p>
              <button className="dashboard-button">Edit Profile</button>
            </div>
          </Link>
        </div>

        <div className="dashboard-warning">
          <p>⚠️ <strong>Important:</strong> We do not tolerate political content. Any political content or account will be taken down immediately.</p>
        </div>

        <p className="dashboard-footer">Start creating and sharing your drafts today!</p>
      </div>
    );
  }

  // Premium Creator Dashboard
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

        {/* Messages Card */}
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
