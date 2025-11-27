import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './SubscriptionPage.css';

// Ensure you have REACT_APP_PAYSTACK_PUBLIC_KEY defined in your .env.local
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
const PLAN_AMOUNT_KES = 20; // Fixed amount for the single plan in KES
const PLAN_NAME = '1 Day Plan'; // Corrected plan name

function SubscriptionPage() {
  const navigate = useNavigate();
  const { subscribeVisitor, checkExistingSubscription } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showExistingSubscriberSection, setShowExistingSubscriberSection] = useState(false);
  const [loading, setLoading] = useState(false);

  // Use a ref to store the Paystack handler instance
  const paystackHandlerRef = useRef(null);

  // Define the callback function for Paystack payment success
  const handlePaystackCallback = useCallback(async (response) => {
    setMessage('Payment successful. Verifying subscription...');
    console.log('Paystack response:', response);

    try {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      const { error } = await supabase.from('subscriptions').insert([
        {
          email: email, // Use the email from the state
          plan: PLAN_NAME,
          expiry_time: expiryTime.toISOString(),
          created_at: now.toISOString(),
          transaction_ref: response.reference,
          status: 'active',
        },
      ]);

      if (error) throw error;

      setMessage(`Successfully subscribed to the ${PLAN_NAME}!`);
      subscribeVisitor(email, PLAN_NAME);
      setTimeout(() => navigate('/'), 1500);

    } catch (err) {
      alert('Subscription update failed after successful payment. Please contact support.');
      console.error('Supabase subscription update error:', err);
    } finally {
      setLoading(false);
    }
  }, [email, navigate, subscribeVisitor]); // Dependencies for useCallback

  // Define the onClose function for Paystack payment modal
  const handlePaystackClose = useCallback(() => {
    setMessage('Payment process cancelled.');
    setLoading(false);
  }, []); // No dependencies for useCallback if it doesn't use any state/props

  // Initialize PaystackPop.setup only once when the component mounts
  useEffect(() => {
    // Only proceed if PaystackPop is available and Public Key is configured
    if (typeof window.PaystackPop !== 'undefined' && PAYSTACK_PUBLIC_KEY) {
      paystackHandlerRef.current = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        // Initial values for email and ref can be placeholders, they will be updated later
        email: 'customer@example.com', 
        amount: PLAN_AMOUNT_KES * 100,
        currency: 'KES',
        ref: 'initial_ref_' + new Date().getTime().toString(), 
        metadata: {
          custom_fields: [
            {
              display_name: 'Plan',
              variable_name: 'plan_name',
              value: PLAN_NAME,
            },
          ],
        },
        callback: handlePaystackCallback,
        onClose: handlePaystackClose,
      });
      console.log('Paystack handler initialized successfully once.');
    } else if (!PAYSTACK_PUBLIC_KEY) {
      console.warn('Paystack Public Key is not configured. Paystack handler will not be set up.');
    } else {
      console.warn('Paystack script (inline.js) not loaded. Paystack handler will not be set up.');
    }

    // No cleanup for PaystackPop.setup as it's a global script and ideally setup once.
    // If PaystackPop has a destroy method, it would go here.
  }, [handlePaystackCallback, handlePaystackClose]); // Dependencies for useEffect to ensure stable callbacks

  const handleSubscribe = async () => {
    if (!email) {
      alert('Please enter your email to subscribe.');
      return;
    }
    if (!PAYSTACK_PUBLIC_KEY) {
      alert('Paystack Public Key is not configured. Please check your .env.local file.');
      console.error('Paystack Public Key is missing.');
      setLoading(false);
      return;
    }
    if (typeof window.PaystackPop === 'undefined' || !paystackHandlerRef.current) {
      alert('Paystack payment system is not ready. Please ensure you have an internet connection and refresh the page, then try again.');
      console.error('Paystack script (inline.js) not loaded or handler not initialized.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(`Initiating payment for ${PLAN_NAME} (${PLAN_AMOUNT_KES} KES) for ${email}...`);

    // Update the handler's options with the latest email and a new ref before opening
    if (paystackHandlerRef.current) {
      paystackHandlerRef.current.setOptions({
        email: email,
        ref: new Date().getTime().toString(), // Generate a new unique ref each time
      });
      paystackHandlerRef.current.openIframe(); // Open the Paystack checkout modal
    } else {
      // This fallback should ideally not be reached if the checks above pass
      alert('Paystack handler not initialized. Please refresh the page and try again.');
      setLoading(false);
    }
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
      <h2>Subscribe to KenyaFlashing!</h2>
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
              <li>24 Hours Access</li> {/* Updated duration in UI */}
            </ul>
            <button className="subscribe-button" disabled={loading}>
              {loading ? 'Processing...' : `Subscribe for ${PLAN_AMOUNT_KES} KES`}
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
