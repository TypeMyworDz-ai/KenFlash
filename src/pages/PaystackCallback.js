import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './PaystackCallback.css';

const PLAN_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours for '2 Hour Plan'
const DEFAULT_PLAN_NAME = '2 Hour Plan'; // Default plan name fallback

function PaystackCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { subscribeVisitor } = useAuth();

  const [paymentStatus, setPaymentStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your payment and activating subscription...');
  const [redirecting, setRedirecting] = useState(false);

  const handleVerificationAndSubscription = useCallback(async () => {
    if (redirecting) return;

    const reference = searchParams.get('trxref') || searchParams.get('reference');
    const status = searchParams.get('status');
    // NEW: Retrieve email and plan name directly from URL query parameters
    const subscriptionEmail = searchParams.get('subscription_email');
    const planNameFromUrl = searchParams.get('plan_name');

    if (!reference) {
      setPaymentStatus('failed');
      setMessage('Payment reference not found. Please contact support.');
      setRedirecting(true);
      setTimeout(() => navigate('/subscribe'), 5000);
      return;
    }

    // Check if Paystack reported success or if a reference exists (indicating potential success)
    if (status === 'success' || reference) {
      setPaymentStatus('verifying');
      setMessage('Payment reference received. Updating your subscription...');

      // PRIORITIZE retrieving email from URL, fallback to any email param Paystack might send
      const userEmail = subscriptionEmail || searchParams.get('email');
      const currentPlanName = planNameFromUrl || DEFAULT_PLAN_NAME; // Use plan name from URL, fallback to default plan name string

      if (!userEmail) {
        setPaymentStatus('failed');
        setMessage('Could not retrieve subscriber email. Please contact support.');
        setRedirecting(true);
        setTimeout(() => navigate('/subscribe'), 5000);
        return;
      }

      try {
        const now = new Date();
        const expiryTime = new Date(now.getTime() + PLAN_DURATION_MS); // Use fixed duration for '2 Hour Plan'

        const { data, error } = await supabase.from('subscriptions').insert([
          {
            email: userEmail,
            plan: currentPlanName, // Use dynamic plan name
            expiry_time: expiryTime.toISOString(),
            created_at: now.toISOString(),
            transaction_ref: reference,
            status: 'active',
          },
        ]).select();

        if (error) {
          console.error('Supabase subscription update error:', error);
          throw new Error(error.message);
        }

        if (data && data.length > 0) {
          setPaymentStatus('success');
          setMessage('Subscription activated successfully! Redirecting to homepage...');
          subscribeVisitor(userEmail, currentPlanName); // Pass dynamic plan name
          setRedirecting(true);
          // No longer need to remove 'pendingSubscriptionEmail' from localStorage
          setTimeout(() => navigate('/'), 3000);
        } else {
          throw new Error('No data returned from subscription insert.');
        }

      } catch (err) {
        setPaymentStatus('failed');
        setMessage(`Failed to activate subscription: ${err.message}. Please contact support with reference: ${reference}`);
        console.error('Subscription activation failed:', err);
        setRedirecting(true);
        setTimeout(() => navigate('/subscribe'), 5000);
      }
    } else {
      setPaymentStatus('failed');
      setMessage('Payment was not successful. Please try again or contact support.');
      setRedirecting(true);
      setTimeout(() => navigate('/subscribe'), 5000);
    }
  }, [searchParams, navigate, subscribeVisitor, redirecting]);

  useEffect(() => {
    handleVerificationAndSubscription();
  }, [handleVerificationAndSubscription]);

  const getStatusIcon = () => {
    if (paymentStatus === 'verifying') return '⏳';
    if (paymentStatus === 'success') return '✅';
    if (paymentStatus === 'failed') return '❌';
    return '';
  };

  const getStatusClass = () => {
    if (paymentStatus === 'verifying') return 'verifying-status';
    if (paymentStatus === 'success') return 'success-status';
    if (paymentStatus === 'failed') return 'failed-status';
    return '';
  };

  return (
    <div className="paystack-callback-container">
      <div className="status-card">
        <div className="status-icon-wrapper"> {/* Added wrapper for styling */}
          <div className={`status-icon ${getStatusClass()}`}>
            {getStatusIcon()}
          </div>
        </div>
        <h2 className={getStatusClass()}>{message}</h2>
        {paymentStatus === 'failed' && (
          <p>
            Please check your payment status on Paystack or{' '}
            <a href="mailto:support@draftey.com">contact support</a>. {/* Changed email and brand */}
          </p>
        )}
        {redirecting && paymentStatus !== 'success' && (
            <p>You will be redirected shortly...</p>
        )}
        {!redirecting && paymentStatus !== 'verifying' && (
            <button className="back-button" onClick={() => navigate('/')}>Go to Homepage</button>
        )}
      </div>
    </div>
  );
}

export default PaystackCallback;
