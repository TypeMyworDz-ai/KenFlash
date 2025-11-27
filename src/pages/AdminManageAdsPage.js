import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminManageAdsPage.css'; // We'll create this CSS file next

const ADMIN_EMAIL = 'admin@kenyaflashing.com';
const AD_MEDIA_BUCKET = 'ad-media'; // New Supabase Storage bucket for ads

function AdminManageAdsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [adminId, setAdminId] = useState(null);

  const [ads, setAds] = useState([]);
  const [newAd, setNewAd] = useState({
    ad_type: 'image',
    media_file: null,
    target_url: '',
    start_date: '',
    end_date: '',
    is_active: true,
    display_order: 0,
  });
  const [editingAdId, setEditingAdId] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  // Admin authentication check
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === ADMIN_EMAIL) {
        setAdminId(user.id);
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        logout();
        navigate('/');
      }
    };
    checkAdminStatus();
  }, [navigate, logout]);

  // Fetch advertisements
  useEffect(() => {
    if (!adminId) return;

    const fetchAds = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('advertisements')
          .select('*')
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setAds(data || []);
      } catch (err) {
        setError(err.message || 'Failed to fetch advertisements.');
        console.error('Error fetching ads:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, [adminId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      const file = files[0];
      setNewAd(prev => ({ ...prev, media_file: file }));
      if (file) {
        setMediaPreview(URL.createObjectURL(file));
      } else {
        setMediaPreview(null);
      }
    } else {
      setNewAd(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleEditClick = (ad) => {
    setEditingAdId(ad.id);
    setNewAd({
      ad_type: ad.ad_type,
      media_file: null, // Don't pre-fill file, user re-uploads if changing
      target_url: ad.target_url || '',
      start_date: ad.start_date ? ad.start_date.split('T')[0] : '', // Format date for input type="date"
      end_date: ad.end_date ? ad.end_date.split('T')[0] : '',
      is_active: ad.is_active,
      display_order: ad.display_order,
    });
    // Set media preview for existing ad
    if (ad.media_path) {
      const { data } = supabase.storage.from(AD_MEDIA_BUCKET).getPublicUrl(ad.media_path);
      setMediaPreview(data.publicUrl);
    } else {
      setMediaPreview(null);
    }
    setSuccess(null); // Clear success message when editing
  };

  const handleCancelEdit = () => {
    setEditingAdId(null);
    setNewAd({
      ad_type: 'image',
      media_file: null,
      target_url: '',
      start_date: '',
      end_date: '',
      is_active: true,
      display_order: 0,
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

    if (!newAd.media_file && !editingAdId) { // Must have a file for new ad
      setError('Please upload an image or video for the advertisement.');
      setLoading(false);
      return;
    }
    if (!newAd.target_url) {
      setError('Please provide a target URL for the advertisement.');
      setLoading(false);
      return;
    }

    try {
      let mediaPath = '';

      // If a new file is selected, upload it
      if (newAd.media_file) {
        const fileExtension = newAd.media_file.name.split('.').pop();
        const fileName = `${adminId}/${Date.now()}-${editingAdId || 'new'}.${fileExtension}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(AD_MEDIA_BUCKET)
          .upload(fileName, newAd.media_file, { upsert: true });

        if (uploadError) throw uploadError;
        mediaPath = uploadData.path;
      } else if (editingAdId) {
        // If editing and no new file, retain existing media_path
        const existingAd = ads.find(ad => ad.id === editingAdId);
        mediaPath = existingAd?.media_path || '';
      }

      const adData = {
        ad_type: newAd.ad_type,
        media_path: mediaPath,
        target_url: newAd.target_url,
        start_date: newAd.start_date || null,
        end_date: newAd.end_date || null,
        is_active: newAd.is_active,
        display_order: newAd.display_order,
      };

      if (editingAdId) {
        // Update existing ad
        const { error: updateError } = await supabase
          .from('advertisements')
          .update(adData)
          .eq('id', editingAdId);
        if (updateError) throw updateError;
        setSuccess('Advertisement updated successfully!');
      } else {
        // Insert new ad
        const { error: insertError } = await supabase
          .from('advertisements')
          .insert([adData]);
        if (insertError) throw insertError;
        setSuccess('Advertisement added successfully!');
      }

      // Refresh ads list
      const { data: updatedAds, error: fetchError } = await supabase
        .from('advertisements')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAds(updatedAds || []);

      handleCancelEdit(); // Reset form
    } catch (err) {
      setError(err.message || 'Failed to save advertisement.');
      console.error('Ad save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAd = async (adId) => {
    if (!window.confirm("Are you sure you want to delete this advertisement? This action cannot be undone.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Get media path to delete from storage
      const adToDelete = ads.find(ad => ad.id === adId);
      if (adToDelete?.media_path) {
        const { error: storageDeleteError } = await supabase.storage
          .from(AD_MEDIA_BUCKET)
          .remove([adToDelete.media_path]);
        if (storageDeleteError) console.warn("Error deleting ad media from storage:", storageDeleteError.message);
      }

      const { error: deleteError } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', adId);

      if (deleteError) throw deleteError;

      setAds(prevAds => prevAds.filter(ad => ad.id !== adId));
      setSuccess('Advertisement deleted successfully!');
    } catch (err) {
      setError(err.message || 'Failed to delete advertisement.');
      console.error('Ad delete error:', err);
    } finally {
      setLoading(false);
    }
  };


  if (loading && !adminId) {
    return <div className="admin-manage-ads-container"><p>Loading admin status...</p></div>;
  }

  if (error) {
    return <div className="admin-manage-ads-container"><p className="error-message">{error}</p></div>;
  }

  if (!adminId) {
    return <div className="admin-manage-ads-container"><p>Authenticating admin...</p></div>;
  }

  return (
    <div className="admin-manage-ads-container">
      <h2>Manage Advertisements</h2>
      <p>Upload, edit, and delete advertisement banners for your homepage and mobile feed.</p>

      {success && <p className="success-message">{success}</p>}

      {/* Ad Creation/Edit Form */}
      <div className="ad-form-section">
        <h3>{editingAdId ? 'Edit Advertisement' : 'Add New Advertisement'}</h3>
        <form onSubmit={handleSubmit} className="ad-form">
          <div className="form-group">
            <label htmlFor="ad_type">Ad Type:</label>
            <select
              id="ad_type"
              name="ad_type"
              value={newAd.ad_type}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="media_file">{editingAdId ? 'Upload New Media (optional)' : 'Upload Media'}:</label>
            <input
              type="file"
              id="media_file"
              name="media_file"
              accept={newAd.ad_type === 'image' ? 'image/*' : 'video/mp4,video/webm'}
              onChange={handleInputChange}
              disabled={loading}
              required={!editingAdId || newAd.media_file} // Required for new ad, optional for edit unless changing
            />
            {mediaPreview && (
              <div className="media-preview">
                {newAd.ad_type === 'image' ? (
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
              value={newAd.target_url}
              onChange={handleInputChange}
              placeholder="https://example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="start_date">Start Date:</label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={newAd.start_date}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="end_date">End Date:</label>
            <input
              type="date"
              id="end_date"
              name="end_date"
              value={newAd.end_date}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={newAd.is_active}
              onChange={handleInputChange}
              disabled={loading}
            />
            <label htmlFor="is_active">Is Active?</label>
          </div>

          <div className="form-group">
            <label htmlFor="display_order">Display Order:</label>
            <input
              type="number"
              id="display_order"
              name="display_order"
              value={newAd.display_order}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="save-ad-button" disabled={loading}>
              {loading ? 'Saving...' : (editingAdId ? 'Update Advertisement' : 'Add Advertisement')}
            </button>
            {editingAdId && (
              <button type="button" className="cancel-edit-button" onClick={handleCancelEdit} disabled={loading}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Existing Ads List */}
      <div className="existing-ads-section">
        <h3>Existing Advertisements</h3>
        {ads.length === 0 ? (
          <p className="no-ads">No advertisements added yet.</p>
        ) : (
          <div className="ads-list-grid">
            {ads.map(ad => (
              <div key={ad.id} className="ad-card">
                <div className="ad-media-display">
                  {ad.ad_type === 'image' ? (
                    <img src={supabase.storage.from(AD_MEDIA_BUCKET).getPublicUrl(ad.media_path).data.publicUrl} alt="Ad Media" />
                  ) : (
                    <video src={supabase.storage.from(AD_MEDIA_BUCKET).getPublicUrl(ad.media_path).data.publicUrl} controls />
                  )}
                </div>
                <div className="ad-details">
                  <p><strong>Type:</strong> {ad.ad_type}</p>
                  <p><strong>Target:</strong> <a href={ad.target_url} target="_blank" rel="noopener noreferrer">{ad.target_url}</a></p>
                  <p><strong>Active:</strong> {ad.is_active ? 'Yes' : 'No'}</p>
                  <p><strong>Order:</strong> {ad.display_order}</p>
                  <p><strong>Dates:</strong> {ad.start_date ? new Date(ad.start_date).toLocaleDateString() : 'N/A'} - {ad.end_date ? new Date(ad.end_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="ad-actions">
                  <button onClick={() => handleEditClick(ad)} className="edit-ad-button" disabled={loading}>Edit</button>
                  <button onClick={() => handleDeleteAd(ad.id)} className="delete-ad-button" disabled={loading}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminManageAdsPage;
