import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './ProfileSettingsPage.css';

function ProfileSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [bio, setBio] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [authUserId, setAuthUserId] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate('/login');
        return;
      }

      setAuthUserId(authUser.id);
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('bio, avatar_path, nickname') // Changed from avatar_url to avatar_path
          .eq('id', authUser.id)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setBio(data.bio || '');
          
          if (data.avatar_path) { // Changed from avatar_url to avatar_path
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(data.avatar_path); // Changed from avatar_url to avatar_path
            setPreviewUrl(urlData.publicUrl);
          } else {
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nickname || 'Creator')}&background=random&color=fff`;
            setPreviewUrl(defaultAvatar);
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBioChange = (e) => {
    const newBio = e.target.value;
    if (newBio.length <= 500) {
      setBio(newBio);
    }
  };

  const handleSave = async () => {
    if (!authUserId) return;

    setSaving(true);
    setError(null);

    try {
      // Upload avatar if changed
      if (avatarFile) {
        const fileName = `${authUserId}-${Date.now()}.${avatarFile.name.split('.').pop()}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        // Update avatar_path in profiles
        const { error: updateAvatarError } = await supabase
          .from('profiles')
          .update({ avatar_path: fileName }) // Changed from avatar_url to avatar_path
          .eq('id', authUserId);

        if (updateAvatarError) throw updateAvatarError;
      }

      // Update bio
      const { error: updateBioError } = await supabase
        .from('profiles')
        .update({ bio })
        .eq('id', authUserId);

      if (updateBioError) throw updateBioError;

      // Redirect to My Profile page
      navigate('/my-profile');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="profile-settings-container"><p>Loading settings...</p></div>;
  }

  return (
    <div className="profile-settings-container">
      <h2>Settings</h2>
      <p>Customize your profile to help viewers get to know you better.</p>

      {error && <p className="error-message">{error}</p>}

      {/* Avatar Section */}
      <div className="settings-section">
        <h3>Profile Picture</h3>
        <div className="avatar-section">
          <div className="avatar-preview">
            <img src={previewUrl} alt="Profile Avatar" className="avatar-image" />
          </div>
          <div className="avatar-upload">
            <label htmlFor="avatar-input" className="upload-button">
              Change Avatar
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            <p className="upload-hint">JPG, PNG, or GIF (Max 5MB)</p>
          </div>
        </div>
      </div>

      {/* Bio Section */}
      <div className="settings-section">
        <h3>Bio</h3>
        <p className="section-description">Tell viewers about yourself ({500 - bio.length} characters remaining)</p>
        <textarea
          value={bio}
          onChange={handleBioChange}
          maxLength={500}
          placeholder="Share your story, interests, or what makes your content unique..."
          className="bio-textarea"
        ></textarea>
        <p className="character-count">{bio.length} / 500 characters</p>
      </div>

      {/* Save Button */}
      <div className="settings-actions">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="save-button"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default ProfileSettingsPage;
