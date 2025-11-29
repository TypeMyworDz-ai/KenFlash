import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import './MyProfilePage.css';

function MyProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate('/login');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*, avatar_path') // Explicitly select avatar_path, or just '*' if it's already included. Changed to '*' to fetch all columns but ensuring avatar_path is used below.
          .eq('id', authUser.id)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setProfile({
            ...data,
            email: authUser.email
          });

          if (data.avatar_path) { // Changed from avatar_url to avatar_path
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(data.avatar_path); // Changed from avatar_url to avatar_path
            setAvatarUrl(urlData.publicUrl);
          } else {
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nickname || 'Creator')}&background=random&color=fff`;
            setAvatarUrl(defaultAvatar);
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  if (loading) {
    return <div className="my-profile-container"><p>Loading profile...</p></div>;
  }

  if (error) {
    return <div className="my-profile-container"><p className="error-message">{error}</p></div>;
  }

  if (!profile) {
    return <div className="my-profile-container"><p>Profile not found.</p></div>;
  }

  return (
    <div className="my-profile-container">
      <h2>{profile.nickname}'s Profile</h2>

      {/* Avatar and Basic Info */}
      <div className="profile-header">
        <div className="avatar-container">
          <img src={avatarUrl} alt={`${profile.nickname}'s avatar`} className="profile-avatar" />
        </div>
        <div className="profile-info-header">
          <h3>{profile.nickname}</h3>
          <p className="official-name">{profile.official_name}</p>
          <Link to="/profile-settings" className="edit-button">Edit Settings</Link>
        </div>
      </div>

      {/* Bio Section */}
      {profile.bio && (
        <div className="profile-section">
          <h4>Bio</h4>
          <p className="bio-text">{profile.bio}</p>
        </div>
      )}

      {/* Details Section */}
      <div className="profile-details">
        <div className="detail-card">
          <h4>Email</h4>
          <p>{profile.email}</p>
        </div>

        <div className="detail-card">
          <h4>Nickname</h4>
          <p>{profile.nickname}</p>
        </div>

        <div className="detail-card">
          <h4>Official Name</h4>
          <p>{profile.official_name}</p>
        </div>

        <div className="detail-card">
          <h4>M-Pesa Number</h4>
          <p>{profile.mpesa_number || 'Not provided'}</p>
        </div>

        <div className="detail-card">
          <h4>Account Status</h4>
          <p className={profile.is_approved ? 'status-approved' : 'status-pending'}>
            {profile.is_approved ? 'Approved' : 'Pending Approval'}
          </p>
        </div>

        <div className="detail-card">
          <h4>Role</h4>
          <p>{profile.role || 'Creator'}</p>
        </div>
      </div>

      <p className="profile-footer">You can edit your settings anytime.</p>
    </div>
  );
}

export default MyProfilePage;
