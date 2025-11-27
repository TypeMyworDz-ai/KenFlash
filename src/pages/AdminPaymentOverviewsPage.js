import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './AdminPaymentOverviewsPage.css';

function AdminPaymentOverviewsPage() {
  const [creatorPayments, setCreatorPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCreatorPayments = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all approved creators (without role filter)
        const { data: creators, error: creatorsError } = await supabase
          .from('profiles')
          .select('id, nickname, official_name')
          .eq('is_approved', true);

        if (creatorsError) throw creatorsError;

        // For each creator, calculate current month views and fetch payment history
        const creatorDataPromises = creators.map(async (creator) => {
          // Get current month views
          const currentDate = new Date();
          const currentMonth = currentDate.getMonth() + 1;
          const currentYear = currentDate.getFullYear();

          const { count: monthViewsCount, error: viewsError } = await supabase
            .from('views')
            .select('id', { count: 'exact' })
            .eq('creator_id', creator.id)
            .gte('viewed_at', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
            .lt('viewed_at', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

          if (viewsError) throw viewsError;

          const currentMonthViews = monthViewsCount || 0;
          const upcomingPayment = Math.floor(currentMonthViews / 1000) * 10;

          // Fetch payment history for this creator
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('creator_id', creator.id)
            .order('created_at', { ascending: false });

          if (paymentsError) throw paymentsError;

          // Calculate totals for this creator
          const totalEarnings = payments.reduce((sum, p) => sum + parseFloat(p.earnings_kes || 0), 0);
          const totalPaid = payments
            .filter(p => p.status === 'Paid')
            .reduce((sum, p) => sum + parseFloat(p.earnings_kes || 0), 0);
          const totalPending = payments
            .filter(p => p.status === 'Pending')
            .reduce((sum, p) => sum + parseFloat(p.earnings_kes || 0), 0);
          const totalViews = payments.reduce((sum, p) => sum + p.views, 0);

          return {
            creator_id: creator.id,
            nickname: creator.nickname,
            official_name: creator.official_name,
            currentMonthViews,
            upcomingPayment,
            totalEarnings,
            totalPaid,
            totalPending,
            totalViews,
            payments,
          };
        });

        const allCreatorData = await Promise.all(creatorDataPromises);
        setCreatorPayments(allCreatorData);

      } catch (err) {
        setError(err.message || 'Failed to fetch creator payment data.');
        console.error('Error fetching creator payments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorPayments();
  }, []);

  if (loading) {
    return <div className="admin-payment-overviews-container"><p>Loading payment data...</p></div>;
  }

  if (error) {
    return <div className="admin-payment-overviews-container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="admin-payment-overviews-container">
      <h2>Payment Overviews</h2>
      <p>Monitor individual creator payments and upcoming earnings.</p>

      {/* Individual Creator Cards */}
      <div className="creators-payment-cards">
        {creatorPayments.length === 0 ? (
          <p>No approved creators found.</p>
        ) : (
          creatorPayments.map((creator) => (
            <div key={creator.creator_id} className="creator-payment-card">
              <div className="card-header">
                <h3>{creator.nickname}</h3>
                <p className="official-name">{creator.official_name}</p>
              </div>

              <div className="card-stats">
                <div className="stat">
                  <p className="stat-label">Current Month Views</p>
                  <p className="stat-value">{creator.currentMonthViews.toLocaleString()}</p>
                </div>
                <div className="stat">
                  <p className="stat-label">Upcoming Payment</p>
                  <p className="stat-value">{creator.upcomingPayment.toFixed(2)} KES</p>
                </div>
                <div className="stat">
                  <p className="stat-label">Total Earnings</p>
                  <p className="stat-value">{creator.totalEarnings.toFixed(2)} KES</p>
                </div>
                <div className="stat">
                  <p className="stat-label">Paid Out</p>
                  <p className="stat-value">{creator.totalPaid.toFixed(2)} KES</p>
                </div>
              </div>

              {/* Payment History for this Creator */}
              {creator.payments.length > 0 && (
                <div className="payment-history">
                  <h4>Payment History</h4>
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
                        {creator.payments.map((payment) => (
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AdminPaymentOverviewsPage;
