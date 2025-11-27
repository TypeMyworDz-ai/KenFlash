import React, { useState } from 'react';
import './ForgotPasswordPage.css'; // We'll create this CSS file next

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real application, you would send this email to a backend
    // to initiate the password reset process.
    console.log('Forgot Password request for email:', email);
    setMessage(`If an account with ${email} exists, a password reset link has been sent.`);
    setEmail(''); // Clear the email field
  };

  return (
    <div className="forgot-password-container">
      <h2>Forgot Password</h2>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      <form onSubmit={handleSubmit} className="forgot-password-form">
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="submit-button">Send Reset Link</button>
      </form>
      {message && <p className="success-message">{message}</p>}
    </div>
  );
}

export default ForgotPasswordPage;
