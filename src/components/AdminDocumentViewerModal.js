import React, { useState, useEffect } from 'react';
import './AdminDocumentViewerModal.css'; // We'll create this CSS file next

function AdminDocumentViewerModal({ documents, onClose }) {
  const [currentDocIndex, setCurrentDocIndex] = useState(0);

  // Ensure documents is an array and filter out nulls
  const validDocuments = documents ? documents.filter(doc => doc && doc.url !== 'N/A') : [];

  useEffect(() => {
    // Reset index if documents change or modal reopens
    setCurrentDocIndex(0);
  }, [documents]);

  const goToPreviousDoc = () => {
    setCurrentDocIndex((prevIndex) =>
      prevIndex === 0 ? validDocuments.length - 1 : prevIndex - 1
    );
  };

  const goToNextDoc = () => {
    setCurrentDocIndex((prevIndex) =>
      prevIndex === validDocuments.length - 1 ? 0 : prevIndex + 1
    );
  };

  if (!validDocuments || validDocuments.length === 0) {
    return (
      <div className="admin-doc-viewer-overlay" onClick={onClose}>
        <div className="admin-doc-viewer-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>&times;</button>
          <p>No valid documents to display for this user.</p>
        </div>
      </div>
    );
  }

  const currentDoc = validDocuments[currentDocIndex];

  return (
    <div className="admin-doc-viewer-overlay" onClick={onClose}>
      <div className="admin-doc-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <div className="doc-slideshow-container">
          <h3>{currentDoc.label} ({currentDocIndex + 1} / {validDocuments.length})</h3>
          <img src={currentDoc.url} alt={currentDoc.label} className="doc-image" />
          <div className="doc-slideshow-controls">
            <button className="nav-button prev-button" onClick={goToPreviousDoc}>&lt;</button>
            <button className="nav-button next-button" onClick={goToNextDoc}>&gt;</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDocumentViewerModal;
