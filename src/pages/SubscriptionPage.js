import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SubscriptionPage.css';

// Paystack Hosted Payment Page URL - This should be configured in Paystack to point to your callback.
// IMPORTANT: The actual Paystack URL you redirect to needs to be dynamic or configured to include callback_url
// For now, we'll construct the callback_url to your /paystack-callback route.
const PAYSTACK_HOSTED_PAGE_BASE_URL = 'https://paystack.shop/pay/2jeen70kmt'; // Base URL for your Paystack product
const PLAN_AMOUNT_KES = 20;
const PLAN_NAME = '2 Hour Plan';

function SubscriptionPage() {
  const navigate = useNavigate();
  const { checkExistingSubscription } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showExistingSubscriberSection, setShowExistingSubscriberSection] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!email) {
      alert('Please enter your email to subscribe.');
      return;
    }

    setLoading(true);
    setMessage(`Redirecting to Paystack for ${PLAN_NAME} (${PLAN_AMOUNT_KES} KES) payment for ${email}...`);

    // IMPORTANT: Construct the callback URL to your app's PaystackCallback route.
    // This URL will receive Paystack's transaction reference.
    // We also pass the email and planName as custom query parameters to our callback.
    const callbackUrl = `${window.location.origin}/paystack-callback?subscription_email=${encodeURIComponent(email)}&plan_name=${encodeURIComponent(PLAN_NAME)}`;

    // Construct the Paystack hosted payment page URL
    // You might need to adjust how your Paystack product URL handles custom parameters.
    // A common way is to pass custom_fields or metadata in the Paystack initialization,
    // but for a hosted page, we typically rely on its own parameters and our callback.
    const paystackRedirectUrl = `${PAYSTACK_HOSTED_PAGE_BASE_URL}?email=${encodeURIComponent(email)}&callback_url=${encodeURIComponent(callbackUrl)}`;
    
    // Redirect to Paystack
    window.location.href = paystackRedirectUrl;
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
      <h2>Subscribe to Draftey!</h2> {/* Changed name to Draftey */}
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
              <li>2 Hours Access</li>
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
              setEmail('');
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
