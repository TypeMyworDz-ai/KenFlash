import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import './SubscriptionPage.css';

// Client-side constants (will be sent to Edge Function)
const PLAN_AMOUNT_KES = 20;
const PLAN_NAME = '2 Hour Plan';

// Get your Supabase project URL from your .env.local or environment variables
const SUPABASE_PROJECT_URL = process.env.REACT_APP_SUPABASE_URL;

function SubscriptionPage() {
  const navigate = useNavigate();
  const { checkExistingSubscription, subscribeVisitor } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showExistingSubscriberSection, setShowExistingSubscriberSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPaymentCompletedSection, setShowPaymentCompletedSection] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const handleSubscribe = async () => {
    if (!email) {
      alert('Please enter your email to subscribe.');
      return;
    }

    setLoading(true);
    setMessage(`Initiating payment for ${PLAN_NAME} (${PLAN_AMOUNT_KES} KES) for ${email}...`);

    const transactionId = uuidv4(); // Our internal unique ID for this attempt

    try {
      // Call the new Edge Function to initialize the Korapay charge
      if (!SUPABASE_PROJECT_URL) {
        throw new Error('Supabase Project URL is not defined in environment variables.');
      }
      const initializeChargeEdgeFunctionUrl = `${SUPABASE_PROJECT_URL}/functions/v1/initialize-korapay-charge`;

      console.log('Calling Edge Function to initialize charge:', initializeChargeEdgeFunctionUrl, { email, planName: PLAN_NAME, amount: PLAN_AMOUNT_KES, transactionId });

      const response = await fetch(initializeChargeEdgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          planName: PLAN_NAME,
          amount: PLAN_AMOUNT_KES,
          transactionId: transactionId,
        }),
      });

      const result = await response.json();
      console.log('Initialize Charge Edge Function response:', result);

      if (response.ok && result.success && result.checkoutUrl && result.korapayReference) {
        // Store our internal transactionId AND Korapay's reference for later verification
        localStorage.setItem('pendingSubscriptionEmail', email);
        localStorage.setItem('pendingPlanName', PLAN_NAME);
        localStorage.setItem('pendingTransactionId', transactionId); // Our internal ID
        localStorage.setItem('korapayTransactionReference', result.korapayReference); // Korapay's reference
        
        console.log('Stored subscription info and Korapay reference to localStorage');

        // Open the dynamic checkout URL received from the Edge Function
        window.open(result.checkoutUrl, '_blank');
        
        setShowPaymentCompletedSection(true);
        setMessage('A new tab has opened with the payment page. Please complete your payment there.');
      } else {
        throw new Error(result.error || 'Failed to initiate payment with Korapay.');
      }

    } catch (error) {
      console.error('Payment initiation failed:', error);
      setMessage(`Failed to initiate payment: ${error.message}. Please contact support.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentCompleted = async () => {
    setVerifyingPayment(true);
    setMessage('Verifying your payment and activating subscription...');
    
    try {
      const subscriptionEmail = localStorage.getItem('pendingSubscriptionEmail');
      const planName = localStorage.getItem('pendingPlanName');
      const transactionId = localStorage.getItem('pendingTransactionId'); // Our internal ID
      const korapayTransactionReference = localStorage.getItem('korapayTransactionReference'); // Korapay's reference

      if (!subscriptionEmail || !planName || !transactionId || !korapayTransactionReference) {
        throw new Error('Subscription information not found. Please try again or re-initiate payment.');
      }

      // Call the existing verify-korapay-payment Edge Function
      if (!SUPABASE_PROJECT_URL) {
        throw new Error('Supabase Project URL is not defined in environment variables.');
      }
      const verifyPaymentEdgeFunctionUrl = `${SUPABASE_PROJECT_URL}/functions/v1/verify-korapay-payment`;

      console.log('Calling Edge Function for verification:', verifyPaymentEdgeFunctionUrl, { 
        subscriptionEmail, 
        planName, 
        transactionId, // Our internal ID
        korapayTransactionReference // Korapay's reference
      });

      const response = await fetch(verifyPaymentEdgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: korapayTransactionReference, // Now send Korapay's reference for verification
          email: subscriptionEmail,
          planName: planName,
          amount: PLAN_AMOUNT_KES, // Send amount for verification
        }),
      });

      const result = await response.json();
      console.log('Verify Payment Edge Function response:', result);

      if (response.ok && result.success) {
        setMessage('Payment verified. Subscription activated successfully! Redirecting to homepage...');
        subscribeVisitor(subscriptionEmail, planName); // Update local auth context
        
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        throw new Error(result.error || 'Payment verification failed. Please try again or contact support.');
      }

    } catch (err) {
      console.error('Failed to activate subscription:', err);
      setMessage(`Failed to activate subscription: ${err.message}. Please contact support.`);
    } finally {
      localStorage.removeItem('pendingSubscriptionEmail');
      localStorage.removeItem('pendingPlanName');
      localStorage.removeItem('pendingTransactionId');
      localStorage.removeItem('korapayTransactionReference'); // Clear Korapay's reference
      setVerifyingPayment(false);
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
      <h2>Subscribe to Draftey!</h2>
      <p>Unlock exclusive content with our single, affordable plan.</p>

      {/* Anonymity Information */}
      <div className="anonymity-info">
        <p>
          For enhanced anonymity, you can use a temporary email address. We recommend using services like{' '}
          <a href="https://minmail.app" target="_blank" rel="noopener noreferrer">minmail.app</a> or other reputable Temp Mail providers. Your privacy is important to us.
        </p>
      </div>

      {/* Show payment completed section if user has been redirected to Korapay */}
      {showPaymentCompletedSection ? (
        <div className="payment-completed-section">
          <h3>Complete Your Payment</h3>
          <p>A new tab has opened with the payment page. Please complete your payment there.</p>
          <p>After completing your payment, return to this page and click the button below:</p>
          <button 
            className="payment-completed-button" 
            onClick={handlePaymentCompleted}
            disabled={verifyingPayment}
          >
            {verifyingPayment ? 'Verifying...' : 'I\'ve Completed Payment'}
          </button>
          <button 
            className="back-to-subscribe-button" 
            onClick={() => setShowPaymentCompletedSection(false)}
            disabled={verifyingPayment}
          >
            Back to Subscription
          </button>
        </div>
      ) : (
        <>
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
                  {loading ? 'Initiating...' : `Subscribe for ${PLAN_AMOUNT_KES} KES`}
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
        </>
      )}

      {message && <p className="subscription-message">{message}</p>}
    </div>
  );
}

export default SubscriptionPage;
