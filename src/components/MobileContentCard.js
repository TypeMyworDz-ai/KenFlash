import React, { useRef, useEffect } from 'react';
import './MobileContentCard.css';

function MobileContentCard({ 
  item, 
  isActive, 
  isVisitorSubscribed, 
  setShowSubscriptionPrompt, 
  onNavigateToCreatorProfile // This prop will now navigate to the creator's main profile page
}) {
  // --- React Hooks must be called unconditionally at the top level ---
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && item && item.type === 'video') {
      if (isActive) {
        // Attempt to play, catch potential autoplay policy errors
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset video to start when not active
      }
    }
  }, [isActive, item]); // Depend on isActive and item for correctness
  // --- End of Hooks section ---

  if (!item) return null; // Early return after Hooks

  const handleProfileClick = () => {
    if (item.creatorInfo && item.creatorInfo.id) {
      if (isVisitorSubscribed) {
        // Navigate to the creator's main profile page, where they can choose photos or videos
        onNavigateToCreatorProfile(item.creatorInfo.id); 
      } else {
        setShowSubscriptionPrompt(true); // Show subscription prompt for unsubscribed users
      }
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
        <p className="mobile-content-creator">By: {item.creatorInfo?.nickname || 'Unknown Creator'}</p>
      </div>

      {/* Profile Avatar (Positioned on the right bottom) */}
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
