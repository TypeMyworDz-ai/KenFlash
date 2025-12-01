import React, { useState, useEffect, useRef } from 'react'; // NEW: Added useRef
import './PhotoSlideshowModal.css';

function PhotoSlideshowModal({ photos, caption, onClose, logView, creatorId, contentType, isPremiumContent }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const loggedPhotosRef = useRef(new Set()); // NEW: Use a ref to track logged photo IDs within this modal instance

  // Effect to reset index and clear loggedPhotos when the photos array changes (e.g., new slideshow opens)
  useEffect(() => {
    setCurrentPhotoIndex(0);
    loggedPhotosRef.current.clear(); // Clear previously logged photos for a new set
  }, [photos]);

  // Effect to log view when the current photo changes
  useEffect(() => {
    if (photos && photos.length > 0) {
      const photoToLog = photos[currentPhotoIndex];
      
      // Only log if the photo exists, logView is provided, and this photo hasn't been logged yet in this session
      if (photoToLog && logView && creatorId && contentType && !loggedPhotosRef.current.has(photoToLog.id)) {
        logView(photoToLog.id, creatorId, contentType, isPremiumContent);
        loggedPhotosRef.current.add(photoToLog.id); // Add photo ID to the set of logged photos
        console.log(`Logged view for photo: ${photoToLog.id} (Index: ${currentPhotoIndex})`);
      }
    }
  }, [currentPhotoIndex, photos, logView, creatorId, contentType, isPremiumContent]); // Added new dependencies

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

  return (
    <div className="slideshow-overlay" onClick={onClose}>
      <div className="slideshow-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <div className="slideshow-container">
          <img src={currentPhoto.url} alt={caption || `Photo ${currentPhotoIndex + 1}`} className="slideshow-image" />
          <div className="slideshow-controls">
            <button className="nav-button prev-button" onClick={goToPreviousPhoto}>&lt;</button>
            <span className="photo-counter">{currentPhotoIndex + 1} / {photos.length}</span>
            <button className="nav-button next-button" onClick={goToNextPhoto}>&gt;</button>
          </div>
          {caption && <p className="slideshow-caption">{caption}</p>}
        </div>
      </div>
    </div>
  );
}

export default PhotoSlideshowModal;
