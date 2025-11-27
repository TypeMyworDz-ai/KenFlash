import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient'; // Keep if used elsewhere, but not for Paystack redirect
import './SubscriptionPage.css';

// Paystack Hosted Payment Page URL
const PAYSTACK_HOSTED_PAGE_URL = 'https://paystack.shop/pay/kenyaflash1day-access';
const PLAN_AMOUNT_KES = 20; // Fixed amount for the single plan in KES
const PLAN_NAME = '1 Day Plan'; // Corrected plan name

function SubscriptionPage() {
  const navigate = useNavigate();
  const { subscribeVisitor, checkExistingSubscription } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showExistingSubscriberSection, setShowExistingSubscriberSection] = useState(false);
  const [loading, setLoading] = useState(false);

  // Removed PaystackPop.setup related logic (useEffect, useRef, isPaystackLoaded, handlePaystackCallback, handlePaystackClose)
  // as we are now redirecting to a hosted page.

  const handleSubscribe = async () => {
    if (!email) {
      alert('Please enter your email to subscribe.');
      return;
    }

    setLoading(true);
    setMessage(`Redirecting to Paystack for ${PLAN_NAME} (${PLAN_AMOUNT_KES} KES) payment for ${email}...`);

    // Construct the Paystack hosted page URL with email pre-filled
    // Paystack's hosted pages often support passing email as a query parameter
    const paymentUrl = `${PAYSTACK_HOSTED_PAGE_URL}?email=${encodeURIComponent(email)}`;
    
    // Redirect the user to the Paystack hosted payment page
    window.location.href = paymentUrl;

    // Note: The loading state and message will not be relevant after redirection
    // The payment success/failure will be handled by the /paystack-callback page
  };

  const handleExistingSubscriberCheck = async () => {
    if (!email) {
      alert('Please enter your email.');
      return;
    }
    setLoading(true);
    const hasValidSubscription = await checkExistingSubscription(email);
    setLoading(false);

    if (hasValidSubscription) {
      alert('Subscription found! Content unlocked.');
      navigate('/');
    } else {
      alert('No active subscription found for this email. Please subscribe to continue.');
    }
  };

  return (
    <div className="subscription-container">
      <h2>Subscribe to KenFlash!</h2>
      <p>Unlock exclusive content with our single, affordable plan.</p>

      {/* Anonymity Information */}
      <div className="anonymity-info">
        <p>
          For enhanced anonymity, you can use a temporary email address. We recommend using services like{' '}
          <a href="https://minmail.app" target="_blank" rel="noopener noreferrer">minmail.app</a> or other reputable Temp Mail providers. Your privacy is important to us.
        </p>
      </div>

      {/* Email input always visible for new subscriptions */}
      {!showExistingSubscriberSection && (
        <div className="email-input-group">
          <label htmlFor="subscriberEmail">Your Email:</label>
          <input
            type="email"
            id="subscriberEmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={loading}
          />
        </div>
      )}

      {/* Single Subscription Plan */}
      {!showExistingSubscriberSection && (
        <div className="subscription-options-grid">
          <div className="subscription-card" onClick={handleSubscribe}>
            <h3>{PLAN_NAME}</h3>
            <p className="price">{PLAN_AMOUNT_KES} KES</p>
            <ul>
              <li>Unlimited Photo Views</li>
              <li>Unlimited Video Views</li>
              <li>Access to all Creators</li>
              <li>Enhanced Anonymity</li>
              <li>24 Hours Access</li>
            </ul>
            <button className="subscribe-button" disabled={loading}>
              {loading ? 'Redirecting...' : `Subscribe for ${PLAN_AMOUNT_KES} KES`}
            </button>
          </div>
        </div>
      )}

      {/* "Already Subscribed?" section */}
      {showExistingSubscriberSection ? (
        <div className="existing-subscriber-section">
          <h3>Already Subscribed?</h3>
          <p>If you have an active subscription, enter your email to unlock content on this device.</p>
          <div className="email-input-group">
            <label htmlFor="existingEmail">Your Email:</label>
            <input
              type="email"
              id="existingEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          <button
            className="unlock-button"
            onClick={handleExistingSubscriberCheck}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Unlock Content'}
          </button>
          <button className="back-to-subscribe-button" onClick={() => setShowExistingSubscriberSection(false)}>
            Back to Plans
          </button>
        </div>
      ) : (
        <div className="toggle-existing-subscriber-section">
          <button
            className="toggle-existing-subscriber-button"
            onClick={() => {
              setShowExistingSubscriberSection(true);
              setEmail(''); // Clear email when switching
            }}
            disabled={loading}
          >
            Already Subscribed? Click here to sign in with your email.
          </button>
        </div>
      )}

      {message && <p className="subscription-message">{message}</p>}
    </div>
  );
}

export default SubscriptionPage;
