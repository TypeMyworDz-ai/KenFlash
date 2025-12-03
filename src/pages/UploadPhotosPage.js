import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
// import './UploadPhotosPage.css'; // Commented out as per your clarification

function UploadPhotosPage() {
  const navigate = useNavigate();
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePhotoChange = (e) => {
    setSelectedPhotos(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (selectedPhotos.length === 0) {
      setError('Please select at least one photo to upload.');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in.');
      }
      const creatorId = user.id;

      // Fetch user's profile to check user_type and approval status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_type, is_approved')
        .eq('id', creatorId)
        .single();

      if (profileError || !profileData) {
        throw new Error('Could not retrieve user profile. Please try again.');
      }

      // Prevent upload if premium_creator is not approved, as per previous logic.
      // This check remains valid for preventing uploads from *unapproved* premium creators,
      // even if content doesn't require further admin approval *after* being approved.
      if (profileData.user_type === 'premium_creator' && !profileData.is_approved) {
        setError('Premium creators must be approved by an admin before uploading content. Please wait for your verification to be processed.');
        setLoading(false);
        return;
      }

      // Generate a group ID only if more than one photo is selected
      const groupId = selectedPhotos.length > 1 ? uuidv4() : null;

      const uploadedPhotoPaths = [];

      for (const photoFile of selectedPhotos) {
        const fileExtension = photoFile.name.split('.').pop();
        const filePath = `public/${creatorId}/photos/${uuidv4()}.${fileExtension}`;

        console.log('[UploadPhotosPage] Attempting to upload file to path:', filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('content')
          .upload(filePath, photoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('[UploadPhotosPage] Error uploading photo to storage:', uploadError);
          throw uploadError;
        }
        console.log('[UploadPhotosPage] Photo uploaded to storage. uploadData:', uploadData);
        console.log('[UploadPhotosPage] Uploaded file path (uploadData.path):', uploadData.path);
        uploadedPhotoPaths.push(uploadData.path);
      }

      console.log('[UploadPhotosPage] uploadedPhotoPaths before map:', uploadedPhotoPaths);

      const photoMetadata = uploadedPhotoPaths.map(path => {
        const metadataItem = {
          creator_id: creatorId,
          storage_path: String(path),
          group_id: groupId,
          caption: caption || null,
          content_type: 'photo',
          is_active: true, // Reverted to true: content is immediately active
        };
        console.log('[UploadPhotosPage] Inside map - metadataItem before return:', metadataItem);
        return metadataItem;
      });

      console.log('[UploadPhotosPage] Photo metadata prepared for insertion (final check):', photoMetadata);

      const { error: insertError } = await supabase
        .from('content')
        .insert(photoMetadata);

      if (insertError) {
        console.error('[UploadPhotosPage] ERROR during photo metadata insertion:', insertError);
        throw insertError;
      }

      console.log('Photos uploaded and metadata stored successfully:', uploadedPhotoPaths);
      alert('Your photos have been uploaded and saved!');
      setSelectedPhotos([]);
      setCaption('');
      navigate('/my-content');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during photo upload. Please ensure you are approved if you are a Premium Creator.');
      console.error('[UploadPhotosPage] Photo upload process error (caught):', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-photos-container">
      <h2>Upload Photos</h2>
      <p>Share your amazing photos with Draftey!</p>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="photos">Select Photos (multiple allowed):</label>
          <input
            type="file"
            id="photos"
            name="photos"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            required
            disabled={loading}
          />
          {selectedPhotos.length > 0 && (
            <p className="selected-files-info">
              {selectedPhotos.length} photo(s) selected.
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="caption">Caption (Optional):</label>
          <textarea
            id="caption"
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption for your photo group..."
            rows="3"
            disabled={loading}
          ></textarea>
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="upload-button" disabled={loading || selectedPhotos.length === 0}>
          {loading ? 'Uploading Photos...' : 'Upload Photos'}
        </button>
        {loading && <p className="upload-message">Uploading content...</p>}
      </form>
    </div>
  );
}

export default UploadPhotosPage;
