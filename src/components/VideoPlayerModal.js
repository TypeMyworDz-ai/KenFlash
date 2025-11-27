import React, { useEffect, useRef } from 'react';
import './VideoPlayerModal.css';

function VideoPlayerModal({ video, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play();
    }
  }, [video]);

  if (!video) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="video-player-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-button" onClick={onClose}>&times;</button>
        <video
          ref={videoRef}
          src={video.url}
          poster={video.thumbnailUrl}
          controls
          autoPlay
          loop
          className="video-player"
        >
          Your browser does not support the video tag.
        </video>
        {video.title && <h3 className="video-title">{video.title}</h3>}
        {video.creatorNickname && <p className="video-creator-name">By: {video.creatorNickname}</p>}
      </div>
    </div>
  );
}

export default VideoPlayerModal;
