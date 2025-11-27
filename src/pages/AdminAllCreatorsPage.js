import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminAllCreatorsPage.css'; // We'll create this CSS file next

// Define the admin email for testing purposes
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function AdminAllCreatorsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [approvedCreators, setApprovedCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    if (currentAdminEmail) { // Only fetch if we've confirmed admin status
      const fetchApprovedCreators = async () => {
        setLoading(true);
        setError(null);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('is_approved', true) // Only fetch approved creators
            .neq('official_name', 'Admin') // Exclude the admin's own profile
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          // Construct public avatar URLs
          const creatorsWithAvatars = data.map(creator => ({
            ...creator,
            avatar_url: creator.avatar_url
              ? supabase.storage.from('avatars').getPublicUrl(creator.avatar_url).data.publicUrl
              : `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.nickname || creator.official_name)}&background=random&color=fff`,
          }));

          setApprovedCreators(creatorsWithAvatars);
        } catch (err) {
          setError(err.message || 'Failed to fetch approved creators.');
          console.error('Error fetching approved creators:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchApprovedCreators();
    }
  }, [currentAdminEmail]);

  if (!currentAdminEmail) {
    return <div className="admin-all-creators-container">Loading admin status...</div>;
  }

  if (loading) {
    return <div className="admin-all-creators-container"><p>Loading approved creators...</p></div>;
  }

  if (error) {
    return <div className="admin-all-creators-container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="admin-all-creators-container">
      <h2>All Approved Creators</h2>
      <p>Click on a creator's profile for a detailed view and management options.</p>

      {approvedCreators.length === 0 ? (
        <p>No approved creators available yet.</p>
      ) : (
        <div className="approved-creators-grid">
          {approvedCreators.map((creator) => (
            <Link to={`/admin-creator-profile/${creator.id}`} key={creator.id} className="creator-card-link">
              <div className="approved-creator-card">
                <div className="creator-avatar-container">
                  <img src={creator.avatar_url} alt={`Avatar of ${creator.nickname}`} className="creator-avatar" />
                </div>
                <h4>{creator.nickname} ({creator.official_name})</h4>
                <p>Registered: {new Date(creator.created_at).toLocaleDateString()}</p>
                <button className="view-profile-button">View Profile</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminAllCreatorsPage;
