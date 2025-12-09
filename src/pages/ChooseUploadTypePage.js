import React from 'react';
import { Link } from 'react-router-dom';
import './ChooseUploadTypePage.css';

function ChooseUploadTypePage() {
  return (
    <div className="choose-upload-type-container">
      <h2>Ready to share your creativity?</h2>
      <p>Click below to upload your photos or videos to Draftey!</p>

      {/* MODIFIED: Single link to the combined upload page */}
      <div className="single-upload-option">
        <Link to="/upload-content" className="upload-option-card-link">
          <div className="upload-option-card">
            <h3>Start Uploading</h3>
            <p>Upload your photos (multiple) or a single video.</p>
            <button className="choose-upload-button">Go to Upload</button>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default ChooseUploadTypePage;
