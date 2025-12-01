import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './PayForAdPage.css';

// You would typically get this from your .env file or a secure backend endpoint
const PAYSTACK_PUBLIC_KEY = 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxx'; // Replace with your actual Paystack Public Key

function PayForAdPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { user, userType, logout } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // Corrected: Added success state
  const [paymentStatus, setPaymentStatus] = useState(null); // 'pending', 'completed', 'failed'

  // Ensure user is logged in and is a business user
  useEffect(() => {
    if (!user) {
      alert("Access Denied: You must be logged in to access this page.");
      logout();
      navigate('/login');
      return;
    }
    if (userType !== 'business') {
      alert("Access Denied: Only business accounts can pay for ads.");
      navigate('/user-dashboard'); // Redirect non-business users
      return;
    }
  }, [user, userType, logout, navigate]);

  // Fetch campaign details
  useEffect(() => {
    if (!user || !campaignId) return;

    const fetchCampaign = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('ad_campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('business_id', user.id) // Ensure only business owner can pay for their campaign
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Ad campaign not found or you don't have access.");

        setCampaign(data);

        // Check if campaign is already paid or awaiting review
        if (data.status !== 'pending_payment' && data.status !== 'rejected') {
          setPaymentStatus('completed'); // Already processed
          setError('This campaign has already been paid for or is under review.');
        } else {
          setPaymentStatus('pending');
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch ad campaign details.');
        console.error('Error fetching campaign for payment:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [user, campaignId]);

  // Function to calculate expiration date based on interval
  const calculateExpirationDate = useCallback((interval) => {
    const now = new Date();
    if (interval === 'weekly') {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    } else if (interval === 'monthly') {
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()); // 1 month from now
    }
    return null;
  }, []);

  // Handle Paystack Payment
  const handlePaystackPayment = useCallback(async () => {
    if (!campaign || paymentStatus !== 'pending') {
      setError('Cannot proceed with payment. Campaign not ready or already paid.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null); // Clear previous success messages

    try {
      // --- Simulate Paystack Checkout ---
      // In a real application, you would integrate with Paystack's SDK here.
      // This would typically involve:
      // 1. Initializing Paystack with public key and transaction details.
      // 2. Opening the Paystack checkout modal.
      // 3. Handling success/failure callbacks from Paystack.

      // For this example, we'll simulate a successful payment after a delay.
      const simulatedPaymentSuccess = await new Promise(resolve => setTimeout(() => resolve(true), 2000));

      if (!simulatedPaymentSuccess) {
        throw new Error("Payment simulation failed.");
      }
      // --- End Simulate Paystack Checkout ---

      const transactionRef = `PS_${Date.now()}_${campaign.id.substring(0, 8)}`; // Unique transaction reference
      const expiresAt = calculateExpirationDate(campaign.payment_interval);

      // 1. Record the payment in ad_payments table
      const { error: paymentInsertError } = await supabase
        .from('ad_payments')
        .insert({
          campaign_id: campaign.id,
          business_id: user.id,
          amount: campaign.payment_amount,
          transaction_reference: transactionRef,
          payment_status: 'completed',
          expires_at: expiresAt.toISOString(),
        });

      if (paymentInsertError) throw paymentInsertError;

      // 2. Update the ad_campaigns status to pending_admin_review
      const { error: campaignUpdateError } = await supabase
        .from('ad_campaigns')
        .update({
          status: 'pending_admin_review',
          start_date: new Date().toISOString(), // Set start date to now
          end_date: expiresAt.toISOString(),   // Set end date based on payment
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);

      if (campaignUpdateError) throw campaignUpdateError;

      setPaymentStatus('completed');
      setSuccess('Payment successful! Your ad campaign is now pending admin review.');
      alert('Payment successful! Your ad campaign is now pending admin review.');
      navigate('/admin-manage-ads'); // Redirect business user to their campaign management page

    } catch (err) {
      setPaymentStatus('failed');
      setError(err.message || 'Payment failed. Please try again.');
      console.error('Paystack payment error:', err);
      // Optionally, log failed payment to ad_payments with status 'failed'
      await supabase.from('ad_payments').insert({
        campaign_id: campaign.id,
        business_id: user.id,
        amount: campaign.payment_amount,
        transaction_reference: `FAILED_${Date.now()}`,
        payment_status: 'failed',
      }).catch(logErr => console.error('Error logging failed payment:', logErr));
    } finally {
      setLoading(false);
    }
  }, [campaign, user, paymentStatus, calculateExpirationDate, navigate]);


  if (loading || !user) {
    return <div className="pay-for-ad-container"><p>Loading payment page...</p></div>;
  }

  if (error && paymentStatus !== 'completed') { // Display general error unless already completed
    return <div className="pay-for-ad-container"><p className="error-message">{error}</p></div>;
  }

  if (!campaign) {
    return <div className="pay-for-ad-container"><p className="error-message">Ad campaign details could not be loaded.</p></div>;
  }

  return (
    <div className="pay-for-ad-container">
      <h2>Pay for Ad Campaign</h2>
      <p>Complete the payment for your advertisement campaign.</p>

      {paymentStatus === 'completed' && (
        <p className="success-message">Payment already processed for this campaign or it is under review. You can view its status on your Ad Campaigns page.</p>
      )}
      {paymentStatus === 'failed' && (
        <p className="error-message">Payment failed. Please try again or contact support.</p>
      )}
      {success && <p className="success-message">{success}</p>}
      {error && paymentStatus !== 'completed' && <p className="error-message">{error}</p>}

      <div className="campaign-summary-card">
        <h3>Campaign: {campaign.ad_title}</h3>
        <p><strong>Description:</strong> {campaign.ad_description || 'N/A'}</p>
        <p><strong>Amount Due:</strong> KES {campaign.payment_amount.toLocaleString()}</p>
        <p><strong>Interval:</strong> {campaign.payment_interval.charAt(0).toUpperCase() + campaign.payment_interval.slice(1)}</p>
        <p><strong>Status:</strong> {campaign.status.replace(/_/g, ' ')}</p>
        
        {campaign.media_path && (
          <div className="campaign-media-preview">
            {campaign.media_type === 'image' ? (
              <img src={supabase.storage.from('ad-media').getPublicUrl(campaign.media_path).data.publicUrl} alt="Ad Preview" />
            ) : (
              <video src={supabase.storage.from('ad-media').getPublicUrl(campaign.media_path).data.publicUrl} controls />
            )}
          </div>
        )}
      </div>

      {paymentStatus === 'pending' && (
        <button 
          onClick={handlePaystackPayment} 
          className="pay-now-button" 
          disabled={loading}
        >
          {loading ? 'Processing Payment...' : `Pay KES ${campaign.payment_amount.toLocaleString()} Now`}
        </button>
      )}

      <button onClick={() => navigate('/admin-manage-ads')} className="back-to-campaigns-button" disabled={loading}>
        Back to My Ad Campaigns
      </button>
    </div>
  );
}

export default PayForAdPage;
