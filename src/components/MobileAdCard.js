import React from 'react';
import './MobileAdCard.css';

function MobileAdCard({ ad }) {
  if (!ad) return null;

  return (
    <div className="mobile-ad-card" onClick={() => window.open(ad.target_url, '_blank')}>
      {ad.ad_type === 'image' ? (
        <img src={ad.media_url} alt="Advertisement" className="mobile-ad-media" />
      ) : (
        <video
          src={ad.media_url}
          poster={ad.thumbnail_path || ad.media_url} // Use thumbnail or video itself as poster
          className="mobile-ad-media"
          muted
          autoPlay
          loop
          playsInline // Important for mobile browsers to autoplay inline
          controlsList="nodownload nofullscreen noremoteplayback" // Restrict controls
        >
          Your browser does not support the video tag.
        </video>
      )}
      <div className="mobile-ad-overlay">
        <h3 className="mobile-ad-title">{ad.title || 'Featured Advertisement'}</h3>
        <p className="mobile-ad-description">{ad.description || 'Click to learn more!'}</p>
      </div>
    </div>
  );
}

export default MobileAdCard;
