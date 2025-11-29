import React, { useState } from 'react';
import UserSignupForm from '../components/UserSignupForm';
import './UserSignupPage.css'; // Import the new CSS file

function UserSignupPage() {
  const [creatorType, setCreatorType] = useState(null); // 'normal' or 'premium'

  const handleSelectCreatorType = (type) => {
    setCreatorType(type);
  };

  return (
    <div className="user-signup-page-container">
      <h2 className="signup-title">Join Draftey</h2>
      <p className="signup-tagline">Post your Drafts…</p>

      {!creatorType ? (
        <div className="creator-type-selection">
          <p className="selection-prompt">Choose your creator account type:</p>
          <button
            className="creator-type-button normal"
            onClick={() => handleSelectCreatorType('normal')}
          >
            Sign up as a Creator (Free Content)
          </button>
          <div className="premium-creator-option">
            <button
              className="creator-type-button premium"
              onClick={() => handleSelectCreatorType('premium')}
            >
              Sign up as a Premium Creator (Pay-per-view)
            </button>
            <p className="premium-info">
              *Premium accounts are subject to a verification process and will be handled on a first-come, first-served basis.
            </p>
          </div>
        </div>
      ) : (
        <UserSignupForm creatorType={creatorType} />
      )}
    </div>
  );
}

export default UserSignupPage;
