import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './CreatorProfileCard.css';

function CreatorProfileCard({ creator }) {
  const { isVisitorSubscribed } = useAuth();
  const isContentLocked = !isVisitorSubscribed;

  const avatarUrl = creator.avatar_url 
    ? supabase.storage.from('avatars').getPublicUrl(creator.avatar_url).data.publicUrl
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.nickname || creator.official_name)}&background=random&color=fff`;

  return (
    <div className={`creator-profile-card ${isContentLocked ? 'locked' : ''}`}>
      <Link to={`/profile/${creator.id}`} className="profile-link">
        <div className="profile-pic-container">
          <img src={avatarUrl} alt={`Avatar of ${creator.nickname}`} className="profile-pic" /> {/* Corrected alt text */}
        </div>
        <h3 className="creator-nickname">{creator.nickname}</h3>
        {isContentLocked ? (
          <p className="locked-message">Subscribe to view content!</p>
        ) : (
          <p className="view-profile-text">View Profile</p>
        )}
      </Link>
      {isContentLocked && (
        <div className="lock-overlay">
          <span className="lock-icon">🔒</span>
        </div>
      )}
    </div>
  );
}

export default CreatorProfileCard;
