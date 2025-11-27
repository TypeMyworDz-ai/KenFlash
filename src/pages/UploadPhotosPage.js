import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import './UploadPhotosPage.css';

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
      const groupId = uuidv4();

      const uploadedPhotoPaths = [];

      for (const photoFile of selectedPhotos) {
        const fileExtension = photoFile.name.split('.').pop();
        const filePath = `public/${creatorId}/photos/${groupId}/${uuidv4()}.${fileExtension}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('content')
          .upload(filePath, photoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }
        uploadedPhotoPaths.push(uploadData.path);
      }

      const photoMetadata = uploadedPhotoPaths.map(path => ({
        creator_id: creatorId,
        storage_path: path,
        group_id: groupId,
        caption: caption,
        is_active: true,
      }));

      const { error: insertError } = await supabase
        .from('photos')
        .insert(photoMetadata);

      if (insertError) {
        throw insertError;
      }

      console.log('Photos uploaded and metadata stored successfully:', uploadedPhotoPaths);
      alert('Your photos have been uploaded and saved!');
      setSelectedPhotos([]);
      setCaption('');
      navigate('/my-content'); // Redirect to My Content Page
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during photo upload.');
      console.error('Photo upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-photos-container">
      <h2>Upload Photos</h2>
      <p>Share your amazing photos with KenyaFlashing!</p>

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
