import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './AdminManageViewersPage.css';

function AdminManageViewersPage() {
  const [blockedViewers, setBlockedViewers] = useState([]);
  const [newViewerEmail, setNewViewerEmail] = useState('');
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newPaymentPhoneNumber, setNewPaymentPhoneNumber] = useState(''); // New state for payment phone number
  const [blockReason, setBlockReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBlockedViewers = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('blocked_viewers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }
        setBlockedViewers(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch blocked viewers.');
        console.error('Error fetching blocked viewers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBlockedViewers();
  }, []);

  const handleBlockViewer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!newViewerEmail && !newIpAddress && !newPaymentPhoneNumber) { // Updated validation
      setError('Please provide at least one of: viewer email, IP address, or payment phone number to block.');
      setSubmitting(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Admin not authenticated.');
      }

      const { data, error } = await supabase
        .from('blocked_viewers')
        .insert([
          {
            viewer_email: newViewerEmail || null,
            ip_address: newIpAddress || null,
            payment_phone_number: newPaymentPhoneNumber || null, // Insert null if empty
            reason: blockReason,
            blocked_by: user.id,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      setBlockedViewers([data[0], ...blockedViewers]);
      setNewViewerEmail('');
      setNewIpAddress('');
      setNewPaymentPhoneNumber(''); // Clear new phone number
      setBlockReason('');
      alert(`Viewer ${newViewerEmail || newIpAddress || newPaymentPhoneNumber} blocked successfully!`);

    } catch (err) {
      if (err.code === '23505') { // Unique constraint violation
        setError('This viewer email, IP address, or payment phone number is already blocked.');
      } else {
        setError(err.message || 'Failed to block viewer.');
      }
      console.error('Error blocking viewer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblockViewer = async (viewerId) => {
    if (!window.confirm(`Are you sure you want to unblock this viewer?`)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('blocked_viewers')
        .delete()
        .eq('id', viewerId);

      if (error) {
        throw error;
      }

      setBlockedViewers(blockedViewers.filter(viewer => viewer.id !== viewerId));
      alert('Viewer unblocked successfully!');

    } catch (err) {
      setError(err.message || 'Failed to unblock viewer.');
      console.error('Error unblocking viewer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-manage-viewers-container">
      <h2>Manage Viewers</h2>
      <p>Block or unblock viewers who violate platform policies by email, IP address, or payment phone number.</p>

      {error && <p className="error-message">{error}</p>}

      {/* Block Viewer Form */}
      <div className="block-viewer-section">
        <h3>Block a New Viewer</h3>
        <form onSubmit={handleBlockViewer} className="block-viewer-form">
          <div className="form-group">
            <label htmlFor="viewerEmail">Viewer Email (Optional):</label>
            <input
              type="email"
              id="viewerEmail"
              value={newViewerEmail}
              onChange={(e) => setNewViewerEmail(e.target.value)}
              placeholder="viewer@example.com"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="ipAddress">IP Address (Optional):</label>
            <input
              type="text"
              id="ipAddress"
              value={newIpAddress}
              onChange={(e) => setNewIpAddress(e.target.value)}
              placeholder="e.g., 192.168.1.1 or 2001:0db8::"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="paymentPhoneNumber">Payment Phone Number (Optional):</label> {/* New input */}
            <input
              type="tel"
              id="paymentPhoneNumber"
              value={newPaymentPhoneNumber}
              onChange={(e) => setNewPaymentPhoneNumber(e.target.value)}
              placeholder="e.g., 0712345678"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="blockReason">Reason (Optional):</label>
            <textarea
              id="blockReason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g., Policy violation, inappropriate comments"
              disabled={submitting}
            ></textarea>
          </div>
          <button type="submit" className="block-button" disabled={submitting || (!newViewerEmail && !newIpAddress && !newPaymentPhoneNumber)}>
            {submitting ? 'Blocking...' : 'Block Viewer'}
          </button>
        </form>
      </div>

      {/* Blocked Viewers List */}
      <div className="blocked-viewers-list-section">
        <h3>Currently Blocked Viewers</h3>
        {loading ? (
          <p>Loading blocked viewers...</p>
        ) : blockedViewers.length === 0 ? (
          <p>No viewers are currently blocked.</p>
        ) : (
          <div className="blocked-viewers-grid">
            {blockedViewers.map((viewer) => (
              <div key={viewer.id} className="blocked-viewer-card">
                <h4>
                  {viewer.viewer_email || viewer.ip_address || viewer.payment_phone_number || 'N/A'}
                </h4> {/* Display email, IP, or phone */}
                <p>Reason: {viewer.reason || 'N/A'}</p>
                <p>Blocked By: {viewer.blocked_by || 'Admin'}</p>
                <p>Blocked On: {new Date(viewer.created_at).toLocaleDateString()}</p>
                <button onClick={() => handleUnblockViewer(viewer.id)} className="unblock-button" disabled={submitting}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminManageViewersPage;
