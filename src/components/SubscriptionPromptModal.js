import React from 'react';
import { useTheme } from '../context/ThemeContext'; // Use ThemeContext for styling
import './SubscriptionPromptModal.css';

function SubscriptionPromptModal({ onClose, onSubscribe }) {
  const { theme } = useTheme();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`subscription-prompt-modal-content ${theme}`} onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-button" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Unlock All Content!</h2>
        <p className="modal-message">
          Enjoy unlimited photos and videos, and access all creators by subscribing to KenFlash.
        </p>
        <button className="subscribe-button" onClick={onSubscribe}>
          Subscribe Now for 20 KES / 24 Hrs!
        </button>
        <p className="modal-small-print">Your privacy is important to us. Use temporary emails for anonymity.</p>
      </div>
    </div>
  );
}

export default SubscriptionPromptModal;
