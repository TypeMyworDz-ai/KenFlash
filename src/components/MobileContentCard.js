import React, { useRef, useEffect } from 'react';
import './MobileContentCard.css'; // Assuming you have a CSS file for this component

const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/40';
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';

function MobileContentCard({ 
  item, 
  isActive, 
  isVisitorSubscribed, 
  setShowSubscriptionPrompt, 
  onNavigateToCreatorProfile,
  logView // Receive logView function as a prop
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && item && item.type === 'video') {
      if (isActive) {
        videoRef.current.muted = true; // Always mute for autoplay
        videoRef.current.play().catch(e => console.error("Error playing mobile video:", e));
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset video to start when not active
      }
    }
  }, [isActive, item]);

  // Handle click on the content media itself
  const handleMediaClick = () => {
    // Determine if the content is premium
    const isPremium = item.profiles?.creator_type === 'premium_creator'; // NEW: Get isPremium from item.profiles

    // Log the view when the media is clicked, passing isPremium
    if (item.id && item.creatorInfo?.id && item.type) {
      logView(item.id, item.creatorInfo.id, item.type === 'photo_group' ? 'photo' : item.type, isPremium); // NEW: Pass isPremium
      console.log(`Mobile Content ${item.id} media clicked. View logged.`);
    }
    // If it's premium content and the visitor is not subscribed, show prompt
    if (!isVisitorSubscribed && isPremium) { // Use isPremium here
      setShowSubscriptionPrompt(true);
    }
    // Optionally, if there's a detailed view for mobile, navigate to it here.
    // e.g., navigate(`/content/${item.id}`);
  };

  // Handle click on the creator's avatar (same as before)
  const handleCreatorAvatarClick = () => {
    if (item.creatorInfo && item.creatorInfo.id) {
      if (isVisitorSubscribed) {
        onNavigateToCreatorProfile(item.creatorInfo.id); 
      } else {
        setShowSubscriptionPrompt(true);
      }
    }
  };

  if (!item) return null;

  return (
    <div className="mobile-content-card">
      {/* Media Section */}
      <div className="mobile-content-media" onClick={handleMediaClick}>
        {item.type === 'photo' || item.type === 'photo_group' ? (
          <img src={item.url} alt={item.caption || 'Content'} className="mobile-content-thumbnail" />
        ) : (
          <video
            ref={videoRef}
            src={item.url}
            poster={item.thumbnailUrl || DEFAULT_VIDEO_THUMBNAIL_PLACEHADER}
            className="mobile-content-thumbnail"
            muted
            loop
            playsInline
            controlsList="nodownload nofullscreen noremoteplayback"
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {/* Creator Info and Views Section */}
      <div className="mobile-content-info">
        <div className="mobile-creator-left-section">
          {/* Creator Avatar */}
          <img
            src={item.creatorInfo?.avatar_url || DEFAULT_AVATAR_PLACEHOLDER}
            alt={item.creatorInfo?.nickname || 'Creator'}
            className="mobile-creator-avatar"
            onClick={handleCreatorAvatarClick}
            title={item.creatorInfo?.nickname || 'Creator'}
          />
          {/* Creator Name */}
          <div className="mobile-creator-name-info">
            <p>{item.creatorInfo?.nickname || 'Unknown Creator'}</p>
          </div>
        </div>
        {/* View Count */}
        <div className="mobile-view-count">
          {item.views || 0}
        </div>
      </div>
    </div>
  );
}

export default MobileContentCard;
