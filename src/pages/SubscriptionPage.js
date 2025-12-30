import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import './SubscriptionPage.css';

// Updated Korapay payment link
const KORAPAY_PAYMENT_LINK = 'https://test-checkout.korapay.com/pay/8ktS0QEg93KewIn';
const PLAN_AMOUNT_KES = 20;
const PLAN_NAME = '2 Hour Plan';

// Get your Supabase project URL from your .env.local or environment variables
// Ensure this matches the URL your Supabase project is deployed to
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
    setMessage(`Redirecting to payment for ${PLAN_NAME} (${PLAN_AMOUNT_KES} KES) for ${email}...`);

    const transactionId = uuidv4(); // Generate a unique transaction ID for this attempt

    try {
      localStorage.setItem('pendingSubscriptionEmail', email);
      localStorage.setItem('pendingPlanName', PLAN_NAME);
      localStorage.setItem('pendingTransactionId', transactionId); // Store the unique transaction ID
      console.log('Stored subscription info to localStorage:', { email, plan: PLAN_NAME, transactionId });
    } catch (error) {
      console.error('Failed to write to localStorage:', error);
      alert('Could not initiate subscription. Please ensure cookies are enabled.');
      setLoading(false);
      return;
    }

    const metadata = {
      transaction_id: transactionId,
      plan_name: PLAN_NAME,
      user_email: email 
    };
    const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));

    const korapayUrlWithParams = `${KORAPAY_PAYMENT_LINK}?email=${encodeURIComponent(email)}&amount=${PLAN_AMOUNT_KES}&currency=KES&metadata=${encodedMetadata}`;

    setShowPaymentCompletedSection(true);
    
    // Open payment link in a new tab with dynamic parameters
    window.open(korapayUrlWithParams, '_blank');
    
    setLoading(false);
  };

  const handlePaymentCompleted = async () => {
    setVerifyingPayment(true);
    setMessage('Verifying your payment and activating subscription...');
    
    try {
      const subscriptionEmail = localStorage.getItem('pendingSubscriptionEmail');
      const planName = localStorage.getItem('pendingPlanName');
      const transactionId = localStorage.getItem('pendingTransactionId');

      if (!subscriptionEmail || !planName || !transactionId) {
        throw new Error('Subscription information not found. Please try again.');
      }

      // --- START OF MODIFIED BLOCK: Calling the Supabase Edge Function ---
      if (!SUPABASE_PROJECT_URL) {
        throw new Error('Supabase Project URL is not defined in environment variables.');
      }
      const edgeFunctionUrl = `${SUPABASE_PROJECT_URL}/functions/v1/verify-korapay-payment`;

      console.log('Calling Edge Function for verification:', edgeFunctionUrl, { subscriptionEmail, planName, transactionId });

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header needed if the Edge Function is deployed with --no-verify-jwt
        },
        body: JSON.stringify({
          transactionId: transactionId,
          email: subscriptionEmail,
          planName: planName,
        }),
      });

      const result = await response.json();
      console.log('Edge Function response:', result);

      if (response.ok && result.success) {
        // Only activate subscription if Edge Function confirms payment
        setMessage('Payment verified. Subscription activated successfully! Redirecting to homepage...');
        subscribeVisitor(subscriptionEmail, planName); // Update local auth context
        
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        throw new Error(result.error || 'Payment verification failed. Please try again or contact support.');
      }
      // --- END OF MODIFIED BLOCK ---

    } catch (err) {
      console.error('Failed to activate subscription:', err);
      setMessage(`Failed to activate subscription: ${err.message}. Please contact support.`);
    } finally {
      localStorage.removeItem('pendingSubscriptionEmail');
      localStorage.removeItem('pendingPlanName');
      localStorage.removeItem('pendingTransactionId');
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
        </>
      )}

      {message && <p className="subscription-message">{message}</p>}
    </div>
  );
}

export default SubscriptionPage;
