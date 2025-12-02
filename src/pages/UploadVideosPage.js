import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import './UploadVideosPage.css';

function UploadVideosPage() {
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVideoChange = (e) => {
    setSelectedVideo(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedVideo) {
      setError('Please select a video to upload.');
      setLoading(false);
      return;
    }
    if (!videoTitle.trim()) {
      setError('Please enter a title for your video.');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in.');
      }
      const creatorId = user.id;

      const fileExtension = selectedVideo.name.split('.').pop();
      const filePath = `public/${creatorId}/videos/${uuidv4()}.${fileExtension}`;

      console.log('[UploadVideosPage] Attempting to upload video to path:', filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('content')
        .upload(filePath, selectedVideo, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[UploadVideosPage] Error uploading video to storage:', uploadError);
        throw uploadError;
      }
      const storagePath = uploadData.path;
      console.log('[UploadVideosPage] Video uploaded to storage. uploadData:', uploadData);
      console.log('[UploadVideosPage] Uploaded video path (storagePath):', storagePath);

      const videoMetadata = {
        creator_id: creatorId,
        storage_path: storagePath,
        title: videoTitle,
        caption: caption || null,
        content_type: 'video',
        is_active: true,
      };

      console.log('[UploadVideosPage] Video metadata prepared for insertion:', videoMetadata);

      const { error: insertError } = await supabase
        .from('content')
        .insert([videoMetadata]);

      if (insertError) {
        console.error('[UploadVideosPage] Error inserting video metadata:', insertError);
        throw insertError;
      }

      console.log('Video uploaded and metadata stored successfully:', storagePath);
      alert('Your video has been uploaded and saved!');
      setSelectedVideo(null);
      setVideoTitle('');
      setCaption('');
      navigate('/my-content');

    } catch (err) {
      setError(err.message || 'An unexpected error occurred during video upload.');
      console.error('[UploadVideosPage] Video upload process error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-videos-container">
      <h2>Upload Videos</h2>
      <p>Share your amazing videos with Draftey!</p> {/* UPDATED: KenyaFlashing to Draftey */}

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="video">Select Video (single file):</label>
          <input
            type="file"
            id="video"
            name="video"
            accept="video/*"
            onChange={handleVideoChange}
            required
            disabled={loading}
          />
          {selectedVideo && (
            <p className="selected-files-info">
              {selectedVideo.name} selected.
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="videoTitle">Video Title:</label>
          <input
            type="text"
            id="videoTitle"
            name="videoTitle"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Enter a title for your video"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="caption">Caption (Optional):</label>
          <textarea
            id="caption"
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption for your video..."
            rows="3"
            disabled={loading}
          ></textarea>
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="upload-button" disabled={loading || !selectedVideo || !videoTitle.trim()}>
          {loading ? 'Uploading Video...' : 'Upload Video'}
        </button>
        {loading && <p className="upload-message">Uploading content...</p>}
      </form>
    </div>
  );
}

export default UploadVideosPage;
