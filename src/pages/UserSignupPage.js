import React, { useState } from 'react';
import UserSignupForm from '../components/UserSignupForm';
import './UserSignupPage.css';

function UserSignupPage() {
  const [userType, setUserType] = useState(null);
  const [errorMessage, setErrorMessage] = useState(''); // State to hold error messages

  const handleSelectUserType = (type) => {
    setUserType(type);
    setErrorMessage(''); // Clear any previous error when a new type is selected
  };

  return (
    <div className="user-signup-page-container">
      <h2 className="signup-title">Join Draftey</h2>
      <p className="signup-tagline">Post your Drafts…</p>

      {!userType ? (
        <div className="user-type-selection">
          <p className="selection-prompt">Choose your account type:</p>
          
          <button
            className="user-type-button normal-creator"
            onClick={() => handleSelectUserType('creator')}
          >
            Sign up as a Creator (Free Content)
          </button>

          <div className="premium-creator-option">
            <button
              className="user-type-button premium-creator"
              onClick={() => handleSelectUserType('premium_creator')}
            >
              Sign up as a Premium Creator (Pay-per-view)
            </button>
            <p className="premium-info">
              *Premium accounts are subject to a verification process and will be handled on a first-come, first-served basis.
            </p>
          </div>

          <div className="business-account-option">
            <button
              className="user-type-button business"
              onClick={() => handleSelectUserType('business')}
            >
              Sign up as a Business (Post Adverts)
            </button>
            <p className="business-info">
              *Create an ad account to post and manage your campaigns.
            </p>
          </div>
        </div>
      ) : (
        <>
          {errorMessage && <p className="error-message">{errorMessage}</p>} {/* Display error message */}
          <UserSignupForm userType={userType} setErrorMessage={setErrorMessage} /> 
        </>
      )}
    </div>
  );
}

export default UserSignupPage;
