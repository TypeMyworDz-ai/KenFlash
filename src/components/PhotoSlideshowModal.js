import React, { useState, useEffect, useRef } from 'react';
import './PhotoSlideshowModal.css';

function PhotoSlideshowModal({ photos, caption, onClose, logView, creatorId, contentType, isPremiumContent }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const loggedPhotosRef = useRef(new Set());

  useEffect(() => {
    setCurrentPhotoIndex(0);
    loggedPhotosRef.current.clear();
  }, [photos]);

  useEffect(() => {
    if (photos && photos.length > 0) {
      const photoToLog = photos[currentPhotoIndex];
      
      if (photoToLog && logView && creatorId && contentType && !loggedPhotosRef.current.has(photoToLog.id)) {
        logView(photoToLog.id, creatorId, contentType, isPremiumContent);
        loggedPhotosRef.current.add(photoToLog.id);
        console.log(`Logged view for photo: ${photoToLog.id} (Index: ${currentPhotoIndex})`);
      }
    }
  }, [currentPhotoIndex, photos, logView, creatorId, contentType, isPremiumContent]);

  const goToPreviousPhoto = () => {
    setCurrentPhotoIndex((prevIndex) =>
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };

  const goToNextPhoto = () => {
    setCurrentPhotoIndex((prevIndex) =>
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    );
  };

  if (!photos || photos.length === 0) {
    return (
      <div className="slideshow-overlay" onClick={onClose}>
        <div className="slideshow-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>&times;</button>
          <p>No photos to display.</p>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentPhotoIndex];
  const showNavigationButtons = photos.length > 1; // NEW: Conditional rendering for buttons

  return (
    <div className="slideshow-overlay" onClick={onClose}>
      <div className="slideshow-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <div className="slideshow-container">
          <div className="slideshow-media-wrapper">
            <img src={currentPhoto.url} alt={caption || `Photo ${currentPhotoIndex + 1}`} className="slideshow-image" />
            <div className="watermark-overlay"></div> {/* Watermark inside the new wrapper */}
            {showNavigationButtons && ( // NEW: Conditionally render controls
              <div className="slideshow-controls">
                <button className="nav-button prev-button" onClick={goToPreviousPhoto}>&#x2190;</button> {/* Unicode left arrow */}
                <span className="photo-counter">{currentPhotoIndex + 1} / {photos.length}</span>
                <button className="nav-button next-button" onClick={goToNextPhoto}>&#x2192;</button> {/* Unicode right arrow */}
              </div>
            )}
          </div>
          {caption && <p className="slideshow-caption">{caption}</p>}
        </div>
      </div>
    </div>
  );
}

export default PhotoSlideshowModal;
