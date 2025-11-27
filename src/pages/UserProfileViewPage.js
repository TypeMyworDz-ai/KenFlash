import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

import './UserProfileViewPage.css';

function UserProfileViewPage() {
  const { userId } = useParams();
  const { isVisitorSubscribed } = useAuth();
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const avatarUrl = data.avatar_url
            ? supabase.storage.from('avatars').getPublicUrl(data.avatar_url).data.publicUrl
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nickname || data.official_name)}&background=random&color=fff`;

          setCreatorProfile({ ...data, avatar_url: avatarUrl });
        } else {
          setError('Creator profile not found.');
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch creator profile.');
        console.error('Error fetching creator profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorProfile();
  }, [userId]);

  if (loading) {
    return <div className="user-profile-view-container"><p>Loading creator profile...</p></div>;
  }

  if (error) {
    return <div className="user-profile-view-container"><p className="error-message">{error}</p></div>;
  }

  if (!creatorProfile) {
    return <div className="user-profile-view-container"><p>Creator profile not found.</p></div>;
  }

  return (
    <div className="user-profile-view-container">
      <div className="profile-header">
        <img src={creatorProfile.avatar_url} alt={`Avatar of ${creatorProfile.nickname}`} className="profile-image" />
        <h2>{creatorProfile.nickname}</h2>
        {creatorProfile.bio && <p className="profile-bio">{creatorProfile.bio}</p>}
        {!creatorProfile.bio && <p className="profile-bio">No biography provided yet.</p>}
      </div>

      <div className="content-cards-section">
        <h3>Content</h3>
        <div className="content-cards-grid">
          {/* Photos Card */}
          <div className={`content-card ${!isVisitorSubscribed ? 'locked' : ''}`}>
            <h4>Photos</h4>
            {!isVisitorSubscribed ? (
              <p>Content locked. Subscribe to view!</p>
            ) : (
              <Link to={`/profile/${userId}/photos`} className="view-content-button">View Photos</Link>
            )}
          </div>

          {/* Videos Card */}
          <div className={`content-card ${!isVisitorSubscribed ? 'locked' : ''}`}>
            <h4>Videos</h4>
            {!isVisitorSubscribed ? (
              <p>Content locked. Subscribe to view!</p>
            ) : (
              <Link to={`/profile/${userId}/videos`} className="view-content-button">View Videos</Link>
            )}
          </div>
        </div>
      </div>

      {!isVisitorSubscribed && (
        <div className="subscription-call-to-action">
          <p className="subscription-info">
            Subscribe weekly for 5 USD or monthly for 10 USD to unlock content.
          </p>
          <Link to="/subscribe" className="subscribe-link-button">
            Subscribe Now!
          </Link>
        </div>
      )}
    </div>
  );
}

export default UserProfileViewPage;
