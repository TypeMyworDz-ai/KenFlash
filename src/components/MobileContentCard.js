import React, { useRef, useEffect } from 'react';
import './MobileContentCard.css';

function MobileContentCard({ 
  item, 
  isActive, 
  isVisitorSubscribed, 
  setShowSubscriptionPrompt, 
  onNavigateToCreatorProfile 
}) {
  // --- React Hooks must be called unconditionally at the top level ---
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && item && item.type === 'video') { // Only apply to video elements
      if (isActive) {
        videoRef.current.play().catch(e => console.error("Error playing video:", e)); // Add catch for autoplay policy
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset video to start when not active
      }
    }
  }, [isActive, item]); // Depend on isActive and item (to ensure ref is current)
  // --- End of Hooks section ---

  if (!item) return null; // Early return after Hooks

  const handleProfileClick = () => {
    if (isVisitorSubscribed) {
      onNavigateToCreatorProfile(item.creatorInfo.id);
    } else {
      setShowSubscriptionPrompt(true);
    }
  };

  return (
    <div className="mobile-content-card">
      {item.type === 'photo' ? (
        <img src={item.url} alt={item.caption || 'Content'} className="mobile-content-media" />
      ) : (
        <video
          ref={videoRef}
          src={item.url}
          poster={item.thumbnailUrl}
          className="mobile-content-media"
          muted
          loop
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
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
        <p className="mobile-content-creator">By: {item.creatorInfo?.nickname || 'Unknown Creator'}</p>
      </div>

      {/* Profile Avatar */}
      {item.creatorInfo && item.creatorInfo.id && (
        <div className="mobile-creator-avatar-container" onClick={handleProfileClick}>
          {item.creatorInfo.avatar_url ? (
            <img 
              src={item.creatorInfo.avatar_url} 
              alt={item.creatorInfo.nickname} 
              className="mobile-creator-avatar" 
            />
          ) : (
            <div className="mobile-creator-avatar-placeholder">
              {item.creatorInfo.nickname ? item.creatorInfo.nickname.charAt(0) : 'C'}
            </div>
          )}
          {!isVisitorSubscribed && (
            <div className="mobile-creator-avatar-lock">🔒</div>
          )}
        </div>
      )}
    </div>
  );
}

export default MobileContentCard;
