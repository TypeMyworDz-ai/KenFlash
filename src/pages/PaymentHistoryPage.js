import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
// Removed: import { useAuth } from '../context/AuthContext'; // No longer needed
import { useNavigate } from 'react-router-dom';
import './PaymentHistoryPage.css';

function PaymentHistoryPage() {
  // Removed: const { } = useAuth(); // This was causing the empty object pattern warning
  const navigate = useNavigate();
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonthViews, setCurrentMonthViews] = useState(0);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      // Get authenticated user from Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        setError('User not authenticated');
        setLoading(false);
        navigate('/login');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch payment history from payments table
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('creator_id', authUser.id)
          .order('created_at', { ascending: false });

        if (paymentsError) throw paymentsError;

        setPaymentHistory(payments || []);

        // Calculate current month views (subscribed viewers only)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const { count: monthViewsCount, error: viewsError } = await supabase
          .from('views')
          .select('id', { count: 'exact' })
          .eq('creator_id', authUser.id)
          .gte('viewed_at', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
          .lt('viewed_at', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

        if (viewsError) throw viewsError;

        setCurrentMonthViews(monthViewsCount || 0);

      } catch (err) {
        setError(err.message || 'Failed to fetch payment history');
        console.error('Error fetching payment history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [navigate]);

  const totalEarned = paymentHistory.reduce((sum, payment) => sum + parseFloat(payment.earnings_kes || 0), 0);
  const upcomingPayment = Math.floor(currentMonthViews / 1000) * 10;

  if (loading) {
    return <div className="payment-history-container"><p>Loading payment history...</p></div>;
  }

  if (error) {
    return <div className="payment-history-container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="payment-history-container">
      <h2>Payment History</h2>
      <p>Track your earnings and view payment details.</p>

      {/* Summary Cards */}
      <div className="payment-summary-grid">
        <div className="summary-card">
          <h3>Total Earned</h3>
          <p className="summary-amount">{totalEarned.toFixed(2)} KES</p>
          <p className="summary-description">All-time earnings</p>
        </div>

        <div className="summary-card">
          <h3>Upcoming Payment</h3>
          <p className="summary-amount">{upcomingPayment.toFixed(2)} KES</p>
          <p className="summary-description">Based on {currentMonthViews.toLocaleString()} current month views</p>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="payment-history-section">
        <h3>Payment History</h3>
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Views</th>
                <th>Earnings (KES)</th>
                <th>Status</th>
                <th>Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No payment history yet</td>
                </tr>
              ) : (
                paymentHistory.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.month}</td>
                    <td>{payment.views.toLocaleString()}</td>
                    <td>{parseFloat(payment.earnings_kes || 0).toFixed(2)}</td>
                    <td>
                      <span className={`status-badge status-${payment.status.toLowerCase()}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Information */}
      <div className="payment-info-section">
        <h3>How Payments Work</h3>
        <div className="info-cards">
          <div className="info-card">
            <h4>Earning Rate</h4>
            <p>You earn 10 KES for every 1,000 combined views of your photos and videos from subscribed viewers.</p>
          </div>
          <div className="info-card">
            <h4>Payment Frequency</h4>
            <p>Payments are calculated and processed monthly on the 5th of each month.</p>
          </div>
          <div className="info-card">
            <h4>Payment Method</h4>
            <p>All earnings are paid directly to your registered M-Pesa number.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentHistoryPage;
