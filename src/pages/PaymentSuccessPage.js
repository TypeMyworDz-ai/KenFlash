// src/pages/PaymentSuccessPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient'; // Assuming supabaseClient is available

const SUPABASE_PROJECT_URL = process.env.REACT_APP_SUPABASE_URL;
const PLAN_AMOUNT_KES = 20; // Ensure this matches your client-side constant

function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscribeVisitor } = useAuth();
  const [message, setMessage] = useState('Verifying your payment...');
  const [isVerifying, setIsVerifying] = useState(true);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      const korapayReference = searchParams.get('reference'); // Korapay sends its reference here
      const status = searchParams.get('status'); // Korapay might send a status here

      console.log('PaymentSuccessPage: URL Params:', { korapayReference, status });

      if (!korapayReference) {
        setMessage('Payment reference missing from URL. Please return to the subscription page.');
        setIsVerifying(false);
        setShowButton(true);
        return;
      }

      // Retrieve other details from localStorage (these are for our internal verification consistency)
      const storedEmail = localStorage.getItem('pendingSubscriptionEmail');
      const storedPlanName = localStorage.getItem('pendingPlanName');
      const storedTransactionId = localStorage.getItem('pendingTransactionId'); // Our original UUID

      // Clear localStorage immediately to prevent accidental re-activations
      localStorage.removeItem('pendingSubscriptionEmail');
      localStorage.removeItem('pendingPlanName');
      localStorage.removeItem('pendingTransactionId');
      localStorage.removeItem('korapayTransactionReference'); // Also clear this

      if (!storedEmail || !storedPlanName || !storedTransactionId) {
        setMessage('Missing stored subscription details. Please re-initiate payment from the subscription page.');
        setIsVerifying(false);
        setShowButton(true);
        return;
      }

      try {
        if (!SUPABASE_PROJECT_URL) {
          throw new Error('Supabase Project URL is not defined in environment variables.');
        }
        const verifyPaymentEdgeFunctionUrl = `${SUPABASE_PROJECT_URL}/functions/v1/verify-korapay-payment`;

        console.log('PaymentSuccessPage: Calling Edge Function for verification:', verifyPaymentEdgeFunctionUrl, { 
          subscriptionEmail: storedEmail, 
          planName: storedPlanName, 
          transactionId: storedTransactionId, // Send OUR original UUID for verification
          amount: PLAN_AMOUNT_KES // Send amount for verification
        });

        const response = await fetch(verifyPaymentEdgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionId: storedTransactionId, // This is OUR internal UUID, which is Korapay's 'reference' in payins
            email: storedEmail,
            planName: storedPlanName,
            amount: PLAN_AMOUNT_KES,
          }),
        });

        const result = await response.json();
        console.log('PaymentSuccessPage: Verify Payment Edge Function response:', result);

        if (response.ok && result.success) {
          setMessage('Payment successfully verified! You can now access premium content.');
          subscribeVisitor(storedEmail, storedPlanName); // Update local auth context
          setIsVerifying(false);
          setShowButton(true); // Show button to navigate to content
        } else {
          throw new Error(result.error || 'Payment verification failed. Please try again.');
        }

      } catch (err) {
        console.error('PaymentSuccessPage: Verification failed:', err);
        setMessage(`Payment verification failed: ${err.message}. Please contact support.`);
        setIsVerifying(false);
        setShowButton(true); // Show button to return to subscription
      }
    };

    verifyPayment();
  }, [searchParams, navigate, subscribeVisitor]);

  const handleNavigateToContent = () => {
    navigate('/', { replace: true }); // Go to homepage/content, replace history
  };

  const handleReturnToSubscription = () => {
    navigate('/subscribe', { replace: true }); // Go back to subscription page
  };

  return (
    <div className="payment-success-container" style={{ textAlign: 'center', padding: '20px' }}>
      <h2>Payment Status</h2>
      <p>{message}</p>
      {isVerifying && <p>Please wait...</p>}
      {showButton && (
        <button 
          onClick={message.includes('successfully') ? handleNavigateToContent : handleReturnToSubscription}
          style={{ padding: '10px 20px', fontSize: '16px', marginTop: '20px', cursor: 'pointer' }}
        >
          {message.includes('successfully') ? 'Start Viewing Content' : 'Return to Subscription'}
        </button>
      )}
    </div>
  );
}

export default PaymentSuccessPage;
