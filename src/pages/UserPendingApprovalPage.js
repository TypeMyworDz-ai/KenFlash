import React from 'react';
import './UserPendingApprovalPage.css'; // We'll create this CSS file next

function UserPendingApprovalPage() {
  return (
    <div className="pending-approval-container">
      <h2>Account Under Review</h2>
      <p>
        Thank you for completing your registration and verification!
      </p>
      <p>
        Your account is now being reviewed by our admin team. This process may take 1-2 business days.
      </p>
      <p>
        You will receive an email notification once your account has been approved and your dashboard is accessible.
      </p>
      <p className="contact-info">
        If you have any questions, please contact support.
      </p>
    </div>
  );
}

export default UserPendingApprovalPage;
