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
    const subscriptionEmail = searchParams.get('subscription_email');
    const planNameFromUrl = searchParams.get('plan_name');

    console.log('PaystackCallback: Starting verification and subscription process.');
    console.log('PaystackCallback: Reference:', reference);
    console.log('PaystackCallback: Status from URL:', status);
    console.log('PaystackCallback: Subscription Email from URL:', subscriptionEmail);
    console.log('PaystackCallback: Plan Name from URL:', planNameFromUrl);

    if (!reference) {
      setPaymentStatus('failed');
      setMessage('Payment reference not found. Please contact support.');
      setRedirecting(true);
      setTimeout(() => navigate('/subscribe'), 5000);
      console.error('PaystackCallback: Payment reference missing from URL.');
      return;
    }

    if (status === 'success' || reference) {
      setPaymentStatus('verifying');
      setMessage('Payment reference received. Updating your subscription...');
      console.log('PaystackCallback: Payment status or reference indicates potential success.');

      const userEmail = subscriptionEmail || searchParams.get('email');
      const currentPlanName = planNameFromUrl || DEFAULT_PLAN_NAME;

      console.log('PaystackCallback: Derived User Email:', userEmail);
      console.log('PaystackCallback: Derived Plan Name:', currentPlanName);

      if (!userEmail) {
        setPaymentStatus('failed');
        setMessage('Could not retrieve subscriber email. Please contact support.');
        setRedirecting(true);
        setTimeout(() => navigate('/subscribe'), 5000);
        console.error('PaystackCallback: User email missing for subscription.');
        return;
      }

      try {
        const now = new Date();
        const expiryTime = new Date(now.getTime() + PLAN_DURATION_MS);

        const subscriptionData = {
          email: userEmail,
          plan: currentPlanName,
          expiry_time: expiryTime.toISOString(),
          created_at: now.toISOString(),
          transaction_ref: reference,
          status: 'active',
        };

        console.log('PaystackCallback: Attempting to insert subscription data:', subscriptionData);

        const { data, error } = await supabase.from('subscriptions').insert([
          subscriptionData,
        ]).select();

        if (error) {
          console.error('PaystackCallback: Supabase subscription INSERT ERROR (full error object):', error);
          // Provide more specific error message based on Supabase error details
          if (error.code === '23505') { // Unique constraint violation
            throw new Error(`Duplicate entry for email '${userEmail}' or transaction reference '${reference}'.`);
          } else if (error.message.includes('violates row-level security policy')) {
            throw new Error('Database security policy denied subscription update. Please contact support.');
          } else {
            throw new Error(error.message);
          }
        }

        if (data && data.length > 0) {
          setPaymentStatus('success');
          setMessage('Subscription activated successfully! Redirecting to homepage...');
          subscribeVisitor(userEmail, currentPlanName);
          setRedirecting(true);
          console.log('PaystackCallback: Subscription successfully activated and data returned:', data);
          setTimeout(() => navigate('/'), 3000);
        } else {
          throw new Error('No data returned from subscription insert despite no error.');
        }

      } catch (err) {
        setPaymentStatus('failed');
        setMessage(`Failed to activate subscription: ${err.message}. Please contact support with reference: ${reference}`);
        console.error('PaystackCallback: Subscription activation failed in catch block:', err);
        setRedirecting(true);
        setTimeout(() => navigate('/subscribe'), 5000);
      }
    } else {
      setPaymentStatus('failed');
      setMessage('Payment was not successful. Please try again or contact support.');
      setRedirecting(true);
      setTimeout(() => navigate('/subscribe'), 5000);
      console.warn('PaystackCallback: Payment status not success and no reference found.');
    }
    console.log('PaystackCallback: End of handleVerificationAndSubscription.');
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
        <div className="status-icon-wrapper">
          <div className={`status-icon ${getStatusClass()}`}>
            {getStatusIcon()}
          </div>
        </div>
        <h2 className={getStatusClass()}>{message}</h2>
        {paymentStatus === 'failed' && (
          <p>
            Please check your payment status on Paystack or{' '}
            <a href="mailto:support@draftey.com">contact support</a>.
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
