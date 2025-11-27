import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext has subscribeVisitor
import './PaystackCallback.css';

const PLAN_NAME = '1 Day Plan'; // Consistent plan name
const PLAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function PaystackCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { subscribeVisitor } = useAuth(); // Destructure subscribeVisitor from useAuth

  const [paymentStatus, setPaymentStatus] = useState('verifying'); // 'verifying', 'success', 'failed'
  const [message, setMessage] = useState('Verifying your payment and activating subscription...');
  const [redirecting, setRedirecting] = useState(false);

  const handleVerificationAndSubscription = useCallback(async () => {
    if (redirecting) return; // Prevent multiple executions

    const reference = searchParams.get('trxref') || searchParams.get('reference');
    const status = searchParams.get('status'); // Paystack might return a status in the URL

    if (!reference) {
      setPaymentStatus('failed');
      setMessage('Payment reference not found. Please contact support.');
      setRedirecting(true);
      setTimeout(() => navigate('/subscribe'), 5000); // Redirect back to subscribe page
      return;
    }

    // In a real production application, this verification step should ideally
    // be done on your backend server to securely confirm the payment with Paystack
    // and prevent fraud. For this client-side example, we will simulate verification
    // based on the presence of a reference and assume success.

    if (status === 'success' || reference) { // Assuming success if reference is present
      setPaymentStatus('verifying');
      setMessage('Payment reference received. Updating your subscription...');

      // Extract email from local storage or session if stored during initiation
      // For a robust solution, you might pass email via metadata in Paystack redirect
      // or associate it with the transaction reference on your backend.
      // For now, let's assume the email is passed as a query param or stored.
      // If not, you might need to prompt the user for it or fetch from AuthContext.
      const userEmail = searchParams.get('email') || localStorage.getItem('pendingSubscriptionEmail');

      if (!userEmail) {
        setPaymentStatus('failed');
        setMessage('Could not retrieve subscriber email. Please contact support.');
        setRedirecting(true);
        setTimeout(() => navigate('/subscribe'), 5000);
        return;
      }

      try {
        const now = new Date();
        const expiryTime = new Date(now.getTime() + PLAN_DURATION_MS);

        const { data, error } = await supabase.from('subscriptions').insert([
          {
            email: userEmail,
            plan: PLAN_NAME,
            expiry_time: expiryTime.toISOString(),
            created_at: now.toISOString(),
            transaction_ref: reference,
            status: 'active',
          },
        ]).select(); // Use .select() to get the inserted data

        if (error) {
          console.error('Supabase subscription update error:', error);
          throw new Error(error.message);
        }

        if (data && data.length > 0) {
          setPaymentStatus('success');
          setMessage('Subscription activated successfully! Redirecting to homepage...');
          subscribeVisitor(userEmail, PLAN_NAME); // Update AuthContext
          setRedirecting(true);
          localStorage.removeItem('pendingSubscriptionEmail'); // Clean up
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
        <div className={`status-icon ${getStatusClass()}`}>
          {getStatusIcon()}
        </div>
        <h2 className={getStatusClass()}>{message}</h2>
        {paymentStatus === 'failed' && (
          <p>
            Please check your payment status on Paystack or{' '}
            <a href="mailto:support@kenflash.com">contact support</a>.
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
