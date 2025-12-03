import React, { useRef, useEffect } from 'react';
import './MobileContentCard.css'; // Ensure this CSS file exists and is linked

const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/40';
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';

function MobileContentCard({ 
  item, 
  isActive, 
  isVisitorSubscribed, 
  setShowSubscriptionPrompt, 
  onNavigateToCreatorProfile,
  logView
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && item && item.type === 'video') {
      if (isActive) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(e => console.error("Error playing mobile video:", e));
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive, item]);

  const handleMediaClick = () => {
    const isPremium = item.isPremiumContent;

    if (item.id && item.creatorInfo?.id && item.type) {
      logView(item.id, item.creatorInfo.id, item.type === 'photo_group' ? 'photo' : item.type, isPremium);
      console.log(`Mobile Content ${item.id} media clicked. View logged.`);
    }
    
    // REMOVED: Intrusive prompt on clicking premium content
    // if (!isVisitorSubscribed && isPremium) {
    //   setShowSubscriptionPrompt(true);
    // }
    // The parent MobileHomePage should ensure only free content is visible to unsubscribed users.
    // If a click on premium content happens (e.g., via a bug), it shouldn't trigger this generic prompt.
    // Access control for premium content should be handled by routing or displaying an "Access Denied" overlay.
  };

  const handleCreatorAvatarClick = () => {
    if (item.creatorInfo && item.creatorInfo.id) {
      // REMOVED: Intrusive prompt on clicking premium creator profile
      // if (!isVisitorSubscribed && item.profiles?.creator_type === 'premium_creator') {
      //   setShowSubscriptionPrompt(true);
      // } else {
      //   onNavigateToCreatorProfile(item.creatorInfo.id);
      // }
      // The parent MobileHomePage should ensure only free creator profiles are clickable/visible to unsubscribed users.
      // If a click on a premium creator profile happens, it should ideally navigate to an "Access Denied" page.
      onNavigateToCreatorProfile(item.creatorInfo.id); // Always navigate, access control is handled elsewhere
    }
  };

  if (!item) return null;

  return (
    <div className="mobile-content-card">
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
        <div className="watermark-overlay"></div> {/* Watermark added here */}
      </div>

      <div className="mobile-content-info">
        <div className="mobile-creator-left-section">
          <img
            src={item.creatorInfo?.avatar_url || DEFAULT_AVATAR_PLACEHOLDER}
            alt={item.creatorInfo?.nickname || 'Creator'}
            className="mobile-creator-avatar"
            onClick={handleCreatorAvatarClick}
            title={item.creatorInfo?.nickname || 'Creator'}
          />
          <div className="mobile-creator-name-info">
            <p>{item.creatorInfo?.nickname || 'Unknown Creator'}</p>
          </div>
        </div>
        <div className="mobile-view-count">
          {item.views || 0}
        </div>
      </div>
    </div>
  );
}

export default MobileContentCard;
