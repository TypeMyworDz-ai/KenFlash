import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UserDashboardPage.css';

function UserDashboardPage() {
  const { user, userType, isUserApproved } = useAuth(); // Changed userRole to userType
  const [profileUserType, setProfileUserType] = useState(null); // Renamed to avoid confusion with AuthContext's userType
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Added error state

  useEffect(() => {
    const fetchProfileData = async () => { // Renamed function for clarity
      setLoading(true);
      setError(null); // Reset error on new fetch
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser?.id) {
          const { data, error: profileError } = await supabase
            .from('profiles')
            // FIXED: Changed 'creator_type' to 'user_type' to match database schema
            .select('user_type') 
            .eq('id', authUser.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile type:', profileError.message);
            setError('Failed to load user profile. Please try again.'); // Set user-friendly error
            setProfileUserType(null);
          } else if (data) {
            setProfileUserType(data.user_type);
          }
        } else {
          // If no authUser, it means the user is not logged in or session expired
          setError('You must be logged in to view the dashboard.');
          setProfileUserType(null);
        }
      } catch (err) {
        console.error('Error in fetchProfileData:', err.message);
        setError('An unexpected error occurred while loading your dashboard.');
        setProfileUserType(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]); // Added user to dependency array to refetch if user changes

  if (loading) {
    return <div className="user-dashboard-container"><p>Loading dashboard...</p></div>; // More specific loading message
  }

  if (error) {
    return <div className="user-dashboard-container"><p className="error-message">{error}</p></div>; // Display error message
  }

  // Check if the user's profile type is 'creator' (assuming 'normal_creator' is now just 'creator')
  if (profileUserType === 'creator') {
    return (
      <div className="user-dashboard-container">
        <h2>Welcome to Your Creator Dashboard!</h2>
        <p className="dashboard-subtitle">Post your Drafts…</p>
        <p className="dashboard-description">Manage your content and profile settings.</p>

        <div className="dashboard-sections-grid normal-creator-grid">
          {/* My Content Card */}
          <Link to="/my-content" className="dashboard-card-link">
            <div className="dashboard-card content-card">
              <h3>📂 My Content</h3>
              <p>View, manage, and edit all your uploaded photos and videos.</p>
              <button className="dashboard-button">View Content</button>
            </div>
          </Link>

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

  // Premium Creator Dashboard (or other authenticated user types like 'business' or 'admin')
  // This section will now also cover 'premium_creator' if 'profileUserType' matches
  // Using userType from AuthContext for display, as profileUserType is for fetching from DB
  return (
    <div className="user-dashboard-container">
      <h2>Welcome to Your Dashboard!</h2>
      {userType && <p>Logged in as: {userType} ({isUserApproved ? 'Approved' : 'Pending Approval'})</p>}
      <p>Here you can manage your content, views, and other settings.</p>

      <div className="dashboard-sections-grid">
        {/* My Content Card */}
        <Link to={isUserApproved ? "/my-content" : "#"} className={`dashboard-card-link ${!isUserApproved ? 'disabled-link' : ''}`}>
          <div className="dashboard-card content-card">
            <h3>📂 My Content</h3>
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
          <div className="dashboard-card upload-card">
            <h3>📤 Upload New Content</h3>
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
          <h3>📊 My Views</h3>
          <p>Monitor your total views and track your content's performance.</p>
          {isUserApproved ? (
            <Link to="/my-views" className="dashboard-button">View Statistics</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>View Statistics</button>
          )}
        </div>

        {/* Payment History Card */}
        <div className="dashboard-card">
          <h3>💰 Payment History</h3>
          <p>See your earnings and upcoming payments.</p>
          {isUserApproved ? (
            <Link to="/payment-history" className="dashboard-button">Check Payments</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>Check Payments</button>
          )}
        </div>

        {/* Messages Card */}
        <div className="dashboard-card">
          <h3>💬 Messages</h3>
          <p>Chat with the admin team for support or inquiries.</p>
          {isUserApproved ? (
            <Link to="/messages" className="dashboard-button">Chat with Admin</Link>
          ) : (
            <button className="dashboard-button disabled" disabled>Chat with Admin</button>
          )}
        </div>

        {/* Settings Card */}
        <div className="dashboard-card">
          <h3>⚙️ Settings</h3>
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
