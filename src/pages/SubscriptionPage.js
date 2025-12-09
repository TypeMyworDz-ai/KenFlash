import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Removed the unused supabase import
import './SubscriptionPage.css';

// Updated Korapay payment link
const KORAPAY_PAYMENT_LINK = 'https://test-checkout.korapay.com/pay/8ktS0QEg93KewIn';
const PLAN_AMOUNT_KES = 20;
const PLAN_NAME = '2 Hour Plan';

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

    // Store the email and plan name in localStorage
    try {
      localStorage.setItem('pendingSubscriptionEmail', email);
      localStorage.setItem('pendingPlanName', PLAN_NAME);
      console.log('Stored subscription info to localStorage');
    } catch (error) {
      console.error('Failed to write to localStorage:', error);
      alert('Could not initiate subscription. Please ensure cookies are enabled.');
      setLoading(false);
      return;
    }

    // Show payment completed section
    setShowPaymentCompletedSection(true);
    
    // Open payment link in a new tab
    window.open(KORAPAY_PAYMENT_LINK, '_blank');
    
    setLoading(false);
  };

  const handlePaymentCompleted = async () => {
    setVerifyingPayment(true);
    setMessage('Activating your subscription...');
    
    try {
      const subscriptionEmail = localStorage.getItem('pendingSubscriptionEmail');
      const planName = localStorage.getItem('pendingPlanName');
      
      if (!subscriptionEmail || !planName) {
        throw new Error('Subscription information not found. Please try again.');
      }
      
      // Call the subscribeVisitor function from AuthContext instead of directly inserting
      // This function should handle the database operations with proper permissions
      const result = await subscribeVisitor(subscriptionEmail, planName);
      
      if (result.success) {
        setMessage('Subscription activated successfully! Redirecting to homepage...');
        
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to activate subscription');
      }
    } catch (err) {
      console.error('Failed to activate subscription:', err);
      setMessage(`Failed to activate subscription: ${err.message}. Please contact support.`);
    } finally {
      localStorage.removeItem('pendingSubscriptionEmail');
      localStorage.removeItem('pendingPlanName');
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
            {verifyingPayment ? 'Activating...' : 'I\'ve Completed Payment'}
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
