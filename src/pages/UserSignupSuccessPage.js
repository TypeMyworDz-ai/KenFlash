import React from 'react';
import './UserSignupSuccessPage.css';

function UserSignupSuccessPage() {
  return (
    <div className="success-container">
      <h2>Success!</h2>
      <p>
        Your registration details have been submitted.
      </p>
      <p>
        A small MPESA transaction will be conducted to verify names and age-eligibility.
        Once approved, you will be sent an email with confirmation.
      </p>
      <p>
        Please proceed to the verification page.
      </p>
    </div>
  );
}

export default UserSignupSuccessPage;
