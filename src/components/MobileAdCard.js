import React, { useRef, useEffect } from 'react'; // Import useRef and useEffect
import './MobileAdCard.css';

function MobileAdCard({ ad, isActive }) { // Accept isActive prop
  // --- React Hooks must be called unconditionally at the top level ---
  const videoRef = useRef(null);

  useEffect(() => {
    // Only apply to video elements and when 'ad' object is available
    if (videoRef.current && ad && ad.ad_type === 'video') { 
      if (isActive) {
        videoRef.current.play().catch(e => console.error("Error playing ad video:", e)); // Add catch for autoplay policy
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset video to start when not active
      }
    }
  }, [isActive, ad]); // Depend on isActive and ad (to ensure ref is current)
  // --- End of Hooks section ---

  if (!ad) return null; // Early return after Hooks

  return (
    <div className="mobile-ad-card" onClick={() => window.open(ad.target_url, '_blank')}>
      {ad.ad_type === 'image' ? (
        <img src={ad.media_url} alt="Advertisement" className="mobile-ad-media" />
      ) : (
        <video
          ref={videoRef} // Attach ref to video element
          src={ad.media_url}
          poster={ad.thumbnail_path || ad.media_url}
          className="mobile-ad-media"
          muted
          loop
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
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
