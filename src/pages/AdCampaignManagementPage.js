import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdCampaignManagementPage.css';

const AD_MEDIA_BUCKET = 'ad-media';

function AdCampaignManagementPage() {
  const navigate = useNavigate();
  const { user, userType, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [newCampaign, setNewCampaign] = useState({
    ad_title: '',
    ad_description: '',
    ad_type: 'image',
    media_file: null,
    target_url: '',
    payment_amount: '',
    payment_interval: 'weekly',
    start_date: '',
    end_date: '',
    status: 'pending_payment',
  });
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  const isFetchingCampaigns = useRef(false); // Ref to prevent duplicate fetches

  const getPublicUrl = useCallback((path) => {
    if (!path) return null;
    const { data } = supabase.storage.from(AD_MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  // Authentication and Authorization Check
  useEffect(() => {
    if (!user) {
      alert("Access Denied: You must be logged in to view this page.");
      logout();
      navigate('/');
      return;
    }

    if (userType !== 'admin' && userType !== 'business') {
      alert("Access Denied: Only business accounts and admins can manage ads.");
      navigate('/'); // Redirect to home if not authorized
      return;
    }
    setLoading(false); // Auth check passed, stop initial loading state
  }, [navigate, logout, user, userType]);


  // Fetch Ad Campaigns - Separated from auth check, depends on user and userType
  const fetchCampaigns = useCallback(async () => {
    if (!user || isFetchingCampaigns.current) return;

    isFetchingCampaigns.current = true; // Set ref to true to prevent re-entry
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('ad_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (userType === 'business') {
        query = query.eq('business_id', user.id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setCampaigns(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch ad campaigns.');
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
      isFetchingCampaigns.current = false; // Reset ref
    }
  }, [user, userType]); // Dependencies for fetchCampaigns useCallback

  // Effect to trigger fetching campaigns when user or userType changes
  useEffect(() => {
    if (user && (userType === 'admin' || userType === 'business')) {
      fetchCampaigns();
    }
  }, [user, userType, fetchCampaigns]); // fetchCampaigns is a dependency here


  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      const file = files[0];
      setNewCampaign(prev => ({ ...prev, media_file: file }));
      if (file) {
        setMediaPreview(URL.createObjectURL(file));
      } else {
        setMediaPreview(null);
      }
    } else {
      setNewCampaign(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleEditClick = (campaign) => {
    setEditingCampaignId(campaign.id);
    setNewCampaign({
      ad_title: campaign.ad_title,
      ad_description: campaign.ad_description || '',
      ad_type: campaign.media_type,
      media_file: null,
      target_url: campaign.target_url || '',
      payment_amount: campaign.payment_amount,
      payment_interval: campaign.payment_interval,
      start_date: campaign.start_date ? campaign.start_date.split('T')[0] : '',
      end_date: campaign.end_date ? campaign.end_date.split('T')[0] : '',
      status: campaign.status,
    });
    if (campaign.media_path) {
      setMediaPreview(getPublicUrl(campaign.media_path));
    } else {
      setMediaPreview(null);
    }
    setSuccess(null);
    setError(null); // Clear any existing errors when editing
  };

  const handleCancelEdit = () => {
    setEditingCampaignId(null);
    setNewCampaign({
      ad_title: '',
      ad_description: '',
      ad_type: 'image',
      media_file: null,
      target_url: '',
      payment_amount: '',
      payment_interval: 'weekly',
      start_date: '',
      end_date: '',
      status: 'pending_payment',
    });
    setMediaPreview(null);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!newCampaign.media_file && !editingCampaignId) {
      setError('Please upload an image or video for the advertisement.');
      setLoading(false);
      return;
    }
    if (!newCampaign.ad_title.trim()) {
      setError('Please provide an ad title.');
      setLoading(false);
      return;
    }
    if (!newCampaign.target_url.trim()) {
      setError('Please provide a target URL.');
      setLoading(false);
      return;
    }
    if (!newCampaign.payment_amount || isNaN(parseFloat(newCampaign.payment_amount))) {
      setError('Please provide a valid payment amount.');
      setLoading(false);
      return;
    }

    try {
      let mediaPath = '';

      // If a new file is selected, upload it
      if (newCampaign.media_file) {
        const fileExtension = newCampaign.media_file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${editingCampaignId || 'new'}.${fileExtension}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(AD_MEDIA_BUCKET)
          .upload(fileName, newCampaign.media_file, { upsert: true });

        if (uploadError) throw uploadError;
        mediaPath = uploadData.path;
      } else if (editingCampaignId) {
        const existingCampaign = campaigns.find(c => c.id === editingCampaignId);
        mediaPath = existingCampaign?.media_path || '';
      }

      const campaignData = {
        business_id: user.id,
        ad_title: newCampaign.ad_title,
        ad_description: newCampaign.ad_description,
        media_path: mediaPath,
        media_type: newCampaign.ad_type,
        target_url: newCampaign.target_url,
        payment_amount: parseFloat(newCampaign.payment_amount),
        payment_interval: newCampaign.payment_interval,
        start_date: newCampaign.start_date || null,
        end_date: newCampaign.end_date || null,
        status: editingCampaignId ? newCampaign.status : 'pending_payment',
      };

      let dbError;
      let campaignId;

      if (editingCampaignId) {
        const { data, error: updateError } = await supabase
          .from('ad_campaigns')
          .update(campaignData)
          .eq('id', editingCampaignId)
          .select()
          .single();
        dbError = updateError;
        campaignId = data?.id;
        setSuccess('Ad campaign updated successfully!');
      } else {
        const { data, error: insertError } = await supabase
          .from('ad_campaigns')
          .insert([campaignData])
          .select()
          .single();
        dbError = insertError;
        campaignId = data?.id;
        setSuccess('Ad campaign created successfully! Redirecting to payment...');
      }

      if (dbError) throw dbError;

      if (userType === 'business' && campaignId && campaignData.status === 'pending_payment') {
        navigate(`/pay-for-ad/${campaignId}`);
      } else {
        await fetchCampaigns(); // Re-fetch campaigns after successful operation
        handleCancelEdit();
      }

    } catch (err) {
      setError(err.message || 'Failed to save ad campaign.');
      console.error('Campaign save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId, mediaPath) => {
    if (!window.confirm("Are you sure you want to delete this ad campaign? This action cannot be undone.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mediaPath) {
        const { error: storageDeleteError } = await supabase.storage
          .from(AD_MEDIA_BUCKET)
          .remove([mediaPath]);
        if (storageDeleteError) console.warn("Error deleting ad media from storage:", storageDeleteError.message);
      }

      const { error: deleteError } = await supabase
        .from('ad_campaigns')
        .delete()
        .eq('id', campaignId);

      if (deleteError) throw deleteError;

      await fetchCampaigns(); // Re-fetch campaigns after deletion
      setSuccess('Ad campaign deleted successfully!');
    } catch (err) {
      setError(err.message || 'Failed to delete ad campaign.');
      console.error('Campaign delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Admin-specific actions (Approve/Reject)
  const handleAdminAction = async (campaignId, action) => {
    if (userType !== 'admin') {
      alert("Permission Denied: Only admins can perform this action.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let newStatus;
      let updateData = { updated_at: new Date().toISOString() };

      if (action === 'approve') {
        newStatus = 'active';
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign?.start_date || !campaign?.end_date) {
          const now = new Date();
          updateData.start_date = now.toISOString();
          if (campaign?.payment_interval === 'weekly') {
            updateData.end_date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          } else if (campaign?.payment_interval === 'monthly') {
            updateData.end_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
          }
        }
      } else if (action === 'reject') {
        newStatus = 'rejected';
      } else if (action === 'pause') {
        newStatus = 'paused';
      } else if (action === 'activate') {
        newStatus = 'active';
      }

      const { error: updateError } = await supabase
        .from('ad_campaigns')
        .update({ status: newStatus, ...updateData })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      await fetchCampaigns(); // Re-fetch campaigns after admin action
      setSuccess(`Campaign ${campaignId} ${action}d successfully!`);
    } catch (err) {
      setError(err.message || `Failed to ${action} campaign.`);
      console.error(`Admin action error (${action}):`, err);
    } finally {
      setLoading(false);
    }
  };


  if (loading || !user) { // Keep loading if user is not yet loaded or initial auth check is ongoing
    return <div className="ad-campaign-management-container"><p>Loading...</p></div>;
  }

  if (error) {
    return <div className="ad-campaign-management-container"><p className="error-message">{error}</p></div>;
  }

  // If initial auth check passed but user is null (e.g. not logged in), redirect
  if (!user) {
    navigate('/'); // Should be caught by the useEffect, but good as fallback
    return null;
  }

  return (
    <div className="ad-campaign-management-container">
      <h2>{userType === 'admin' ? 'Admin Ad Management' : 'My Ad Campaigns'}</h2>
      <p>
        {userType === 'admin' 
          ? 'Review, approve, and manage all ad campaigns.' 
          : 'Create, view, and manage your advertisement campaigns.'}
      </p>

      {success && <p className="success-message">{success}</p>}

      {/* Campaign Creation/Edit Form (Visible to Business users and Admins) */}
      <div className="campaign-form-section">
        <h3>{editingCampaignId ? 'Edit Ad Campaign' : 'Create New Ad Campaign'}</h3>
        <form onSubmit={handleSubmit} className="campaign-form">
          <div className="form-group">
            <label htmlFor="ad_title">Ad Title:</label>
            <input
              type="text"
              id="ad_title"
              name="ad_title"
              value={newCampaign.ad_title}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ad_description">Ad Description (Optional):</label>
            <textarea
              id="ad_description"
              name="ad_description"
              value={newCampaign.ad_description}
              onChange={handleInputChange}
              disabled={loading}
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="ad_type">Ad Type:</label>
            <select
              id="ad_type"
              name="ad_type"
              value={newCampaign.ad_type}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="media_file">{editingCampaignId ? 'Upload New Media (optional)' : 'Upload Media'}:</label>
            <input
              type="file"
              id="media_file"
              name="media_file"
              accept={newCampaign.ad_type === 'image' ? 'image/*' : 'video/mp4,video/webm'}
              onChange={handleInputChange}
              disabled={loading}
              required={!editingCampaignId || newCampaign.media_file}
            />
            {mediaPreview && (
              <div className="media-preview">
                {newCampaign.ad_type === 'image' ? (
                  <img src={mediaPreview} alt="Media Preview" />
                ) : (
                  <video src={mediaPreview} controls />
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="target_url">Target URL (On Click):</label>
            <input
              type="url"
              id="target_url"
              name="target_url"
              value={newCampaign.target_url}
              onChange={handleInputChange}
              placeholder="https://example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment_amount">Payment Amount (KES):</label>
            <input
              type="number"
              id="payment_amount"
              name="payment_amount"
              value={newCampaign.payment_amount}
              onChange={handleInputChange}
              required
              min="0"
              step="any"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment_interval">Payment Interval:</label>
            <select
              id="payment_interval"
              name="payment_interval"
              value={newCampaign.payment_interval}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="weekly">Weekly (500 KES)</option>
              <option value="monthly">Monthly (1500 KES)</option>
            </select>
          </div>

          {/* Admin only fields (for editing active campaigns, etc.) */}
          {userType === 'admin' && (
            <>
              <div className="form-group">
                <label htmlFor="start_date">Start Date (Optional):</label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={newCampaign.start_date}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">End Date (Optional):</label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={newCampaign.end_date}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="status">Status:</label>
                <select
                  id="status"
                  name="status"
                  value={newCampaign.status}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="pending_payment">Pending Payment</option>
                  <option value="pending_admin_review">Pending Admin Review</option>
                  <option value="active">Active</option>
                  <option value="rejected">Rejected</option>
                  <option value="paused">Paused</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="save-campaign-button" disabled={loading}>
              {loading ? 'Saving...' : (editingCampaignId ? 'Update Campaign' : 'Create Campaign')}
            </button>
            {editingCampaignId && (
              <button type="button" className="cancel-edit-button" onClick={handleCancelEdit} disabled={loading}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Existing Campaigns List */}
      <div className="existing-campaigns-section">
        <h3>Existing Ad Campaigns</h3>
        {campaigns.length === 0 ? (
          <p className="no-campaigns">No ad campaigns added yet.</p>
        ) : (
          <div className="campaigns-list-grid">
            {campaigns.map(campaign => (
              <div key={campaign.id} className={`campaign-card status-${campaign.status.replace(/_/g, '-')}`}>
                <div className="campaign-media-display">
                  {campaign.media_type === 'image' ? (
                    <img src={getPublicUrl(campaign.media_path)} alt="Ad Media" />
                  ) : (
                    <video src={getPublicUrl(campaign.media_path)} controls />
                  )}
                </div>
                <div className="campaign-details">
                  <h4>{campaign.ad_title}</h4>
                  <p><strong>Description:</strong> {campaign.ad_description || 'N/A'}</p>
                  <p><strong>Type:</strong> {campaign.media_type}</p>
                  <p><strong>Target:</strong> <a href={campaign.target_url} target="_blank" rel="noopener noreferrer">{campaign.target_url}</a></p>
                  <p><strong>Amount:</strong> KES {campaign.payment_amount.toLocaleString()} / {campaign.payment_interval}</p>
                  <p><strong>Status:</strong> {campaign.status.replace(/_/g, ' ')}</p>
                  <p><strong>Dates:</strong> {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'N/A'} - {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="campaign-actions">
                  {(userType === 'business' && (campaign.status === 'pending_payment' || campaign.status === 'rejected')) && (
                    <button onClick={() => navigate(`/pay-for-ad/${campaign.id}`)} className="pay-button">Pay Now</button>
                  )}
                  {(userType === 'business' && campaign.status !== 'pending_payment' && campaign.status !== 'active') && (
                    <button onClick={() => handleEditClick(campaign)} className="edit-campaign-button" disabled={loading}>Edit</button>
                  )}
                  {userType === 'admin' && (
                    <>
                      {campaign.status === 'pending_admin_review' && (
                        <>
                          <button onClick={() => handleAdminAction(campaign.id, 'approve')} className="approve-button" disabled={loading}>Approve</button>
                          <button onClick={() => handleAdminAction(campaign.id, 'reject')} className="reject-button" disabled={loading}>Reject</button>
                        </>
                      )}
                      {campaign.status === 'active' && (
                        <button onClick={() => handleAdminAction(campaign.id, 'pause')} className="pause-button" disabled={loading}>Pause</button>
                      )}
                      {campaign.status === 'paused' && (
                        <button onClick={() => handleAdminAction(campaign.id, 'activate')} className="activate-button" disabled={loading}>Activate</button>
                      )}
                      <button onClick={() => handleDeleteCampaign(campaign.id, campaign.media_path)} className="delete-campaign-button" disabled={loading}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdCampaignManagementPage;
