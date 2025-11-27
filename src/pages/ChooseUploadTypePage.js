import React from 'react';
import { Link } from 'react-router-dom';
import './ChooseUploadTypePage.css'; // We'll create this CSS file next

function ChooseUploadTypePage() {
  return (
    <div className="choose-upload-type-container">
      <h2>What would you like to upload today?</h2>
      <p>Select an option to share your creativity.</p>

      <div className="upload-options-grid">
        <Link to="/upload-photos" className="upload-option-card-link">
          <div className="upload-option-card">
            <h3>Photos</h3>
            <p>Upload multiple images at once.</p>
            <button className="choose-upload-button">Upload Photos</button>
          </div>
        </Link>

        <Link to="/upload-videos" className="upload-option-card-link">
          <div className="upload-option-card">
            <h3>Videos</h3>
            <p>Upload a single video file.</p>
            <button className="choose-upload-button">Upload Videos</button>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default ChooseUploadTypePage;
