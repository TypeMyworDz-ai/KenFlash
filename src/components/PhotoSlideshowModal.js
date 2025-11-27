import React, { useState, useEffect } from 'react';
import './PhotoSlideshowModal.css';

function PhotoSlideshowModal({ photos, caption, onClose }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [photos]);

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
          <img src={currentPhoto.url} alt={caption || `Photo ${currentPhotoIndex + 1}`} className="slideshow-image" /> {/* Corrected alt text */}
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
