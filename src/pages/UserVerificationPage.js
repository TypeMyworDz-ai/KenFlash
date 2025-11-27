import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UserVerificationPage.css';

function UserVerificationPage() {
  const navigate = useNavigate();
  const { login, userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [frontFullPic, setFrontFullPic] = useState(null);
  const [backFullPic, setBackFullPic] = useState(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (name === 'frontFullPic') {
      setFrontFullPic(files[0]);
    } else if (name === 'backFullPic') {
      setBackFullPic(files[0]);
    }
  };

  const handleCheckboxChange = (e) => {
    setAgreeToTerms(e.target.checked);
  };

  const uploadFile = async (file, path) => {
    try {
      const { data, error } = await supabase.storage
        .from('verification-docs')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }
      return data.path;
    } catch (error) {
      console.error('Error uploading file:', error.message);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!frontFullPic || !backFullPic) {
      setError('Please upload both front and back full pictures for verification.');
      setLoading(false);
      return;
    }
    if (!agreeToTerms) {
      setError('Please agree to the terms of service and privacy policy.');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated.');
      }
      const userId = user.id;

      const frontFullPicPath = `public/${userId}/fullpic_front_${Date.now()}.${frontFullPic.name.split('.').pop()}`;
      const backFullPicPath = `public/${userId}/fullpic_back_${Date.now()}.${backFullPic.name.split('.').pop()}`;

      const uploadedFrontFullPic = await uploadFile(frontFullPic, frontFullPicPath);
      const uploadedBackFullPic = await uploadFile(backFullPic, backFullPicPath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_pic_front_url: uploadedFrontFullPic,
          full_pic_back_url: uploadedBackFullPic,
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      console.log('Verification documents uploaded and profile updated for user:', userId);
      login(userRole, false);
      navigate('/user-pending-approval');

    } catch (err) {
      setError(err.message || "An unexpected error occurred during verification.");
      console.error('Verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isConfirmButtonDisabled = loading || !agreeToTerms || !frontFullPic || !backFullPic;

  return (
    <div className="verification-container">
      <h2>Creator Verification</h2>
      <p>Please upload your full pictures (front and back) for verification by our admin team.</p>
      <form onSubmit={handleSubmit} className="verification-form">
        <div className="form-group">
          <label htmlFor="frontFullPic">Upload Full Picture (Front):</label>
          <input
            type="file"
            id="frontFullPic"
            name="frontFullPic"
            accept="image/*"
            onChange={handleFileChange}
            required
            disabled={loading}
          />
          {frontFullPic && <p>File selected: {frontFullPic.name}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="backFullPic">Upload Full Picture (Back):</label>
          <input
            type="file"
            id="backFullPic"
            name="backFullPic"
            accept="image/*"
            onChange={handleFileChange}
            required
            disabled={loading}
          />
          {backFullPic && <p>File selected: {backFullPic.name}</p>}
        </div>

        <div className="terms-checkbox">
          <input
            type="checkbox"
            id="agreeToTerms"
            checked={agreeToTerms}
            onChange={handleCheckboxChange}
            disabled={loading}
          />
          <label htmlFor="agreeToTerms">
            I confirm I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">terms of service</Link> and <Link to="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>.
          </label>
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="confirm-button" disabled={isConfirmButtonDisabled}>
          {loading ? 'Uploading...' : 'Confirm Verification'}
        </button>
      </form>
    </div>
  );
}

export default UserVerificationPage;
