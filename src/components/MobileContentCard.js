import React from 'react';
import './MobileContentCard.css';

function MobileContentCard({ item }) {
  if (!item) return null;

  return (
    <div className="mobile-content-card">
      {item.type === 'photo' ? (
        <img src={item.url} alt={item.caption || 'Content'} className="mobile-content-media" />
      ) : (
        <video
          src={item.url}
          poster={item.thumbnailUrl}
          className="mobile-content-media"
          muted
          autoPlay
          loop
          playsInline // Important for mobile browsers to autoplay inline
          controlsList="nodownload nofullscreen noremoteplayback" // Restrict controls
        >
          Your browser does not support the video tag.
        </video>
      )}
      <div className="mobile-content-overlay">
        {item.type === 'photo' ? (
          <h3 className="mobile-content-title">{item.caption || 'Photo Content'}</h3>
        ) : (
          <h3 className="mobile-content-title">{item.title || 'Video Content'}</h3>
        )}
        <p className="mobile-content-creator">By: {item.profiles?.nickname || 'Unknown Creator'}</p>
      </div>
    </div>
  );
}

export default MobileContentCard;
