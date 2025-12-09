import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import './UploadContentPage.css'; // You'll need to create this CSS file

function UploadContentPage() {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]); // Can be photos or a single video
  const [contentType, setContentType] = useState(''); // 'photo' or 'video'
  const [title, setTitle] = useState(''); // For video title or photo group title (if applicable)
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setError(null);
    const files = Array.from(e.target.files);

    if (files.length === 0) {
      setSelectedFiles([]);
      setContentType('');
      return;
    }

    const firstFile = files[0];
    if (firstFile.type.startsWith('image/')) {
      setContentType('photo');
      setSelectedFiles(files);
      // If multiple photos, title might be for the group, otherwise optional for single photo
      setTitle(''); 
    } else if (firstFile.type.startsWith('video/')) {
      if (files.length > 1) {
        setError('Please select only one video at a time.');
        setSelectedFiles([]);
        setContentType('');
        return;
      }
      setContentType('video');
      setSelectedFiles(files);
      // Video usually requires a title
      setTitle('');
    } else {
      setError('Unsupported file type. Please upload images or videos.');
      setSelectedFiles([]);
      setContentType('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (selectedFiles.length === 0) {
      setError('Please select files to upload.');
      setLoading(false);
      return;
    }

    if (contentType === 'video' && !title.trim()) {
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

      // Fetch user's profile to check user_type and approval status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_type, is_approved')
        .eq('id', creatorId)
        .single();

      if (profileError || !profileData) {
        throw new Error('Could not retrieve user profile. Please try again.');
      }

      // Prevent upload if premium_creator is not approved
      if (profileData.user_type === 'premium_creator' && !profileData.is_approved) {
        setError('Premium creators must be approved by an admin before uploading content. Please wait for your verification to be processed.');
        setLoading(false);
        return;
      }

      const uploadedContentMetadata = [];
      const groupId = contentType === 'photo' && selectedFiles.length > 1 ? uuidv4() : null;
      const bucketName = 'content';

      for (const file of selectedFiles) {
        const fileExtension = file.name.split('.').pop();
        const filePath = `public/${creatorId}/${contentType}s/${uuidv4()}.${fileExtension}`;

        console.log(`[UploadContentPage] Attempting to upload ${contentType} to path:`, filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error(`[UploadContentPage] Error uploading ${contentType} to storage:`, uploadError);
          throw uploadError;
        }
        
        console.log(`[UploadContentPage] ${contentType} uploaded to storage. uploadData:`, uploadData);
        uploadedContentMetadata.push({
          creator_id: creatorId,
          storage_path: uploadData.path,
          group_id: groupId,
          title: contentType === 'video' ? title : (selectedFiles.length === 1 ? title : null), // Only set title for single photo if provided
          caption: caption || null,
          content_type: contentType,
          is_active: true,
        });
      }

      console.log('[UploadContentPage] Content metadata prepared for insertion:', uploadedContentMetadata);

      const { error: insertError } = await supabase
        .from('content')
        .insert(uploadedContentMetadata);

      if (insertError) {
        console.error('[UploadContentPage] Error inserting content metadata:', insertError);
        throw insertError;
      }

      console.log('Content uploaded and metadata stored successfully.');
      alert('Your content has been uploaded and saved!');
      setSelectedFiles([]);
      setContentType('');
      setTitle('');
      setCaption('');
      navigate('/my-content');

    } catch (err) {
      setError(err.message || 'An unexpected error occurred during content upload. Please ensure you are approved if you are a Premium Creator.');
      console.error('[UploadContentPage] Content upload process error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-content-container">
      <h2>Upload Content</h2>
      <p>Share your amazing photos and videos with Draftey!</p>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="files">Select Files (multiple photos or single video):</label>
          <input
            type="file"
            id="files"
            name="files"
            accept="image/*,video/*"
            multiple={contentType !== 'video'} // Allow multiple for photos, single for video
            onChange={handleFileChange}
            required
            disabled={loading}
          />
          {selectedFiles.length > 0 && (
            <p className="selected-files-info">
              {selectedFiles.length} {contentType === 'video' ? 'video' : 'photo(s)'} selected.
            </p>
          )}
        </div>

        {contentType === 'video' && (
          <div className="form-group">
            <label htmlFor="title">Video Title:</label>
            <input
              type="text"
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your video"
              required={contentType === 'video'}
              disabled={loading}
            />
          </div>
        )}

        {contentType === 'photo' && selectedFiles.length === 1 && (
          <div className="form-group">
            <label htmlFor="title">Photo Title (Optional for single photo):</label>
            <input
              type="text"
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your photo"
              disabled={loading}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="caption">Caption (Optional):</label>
          <textarea
            id="caption"
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={contentType === 'video' ? "Add a caption for your video..." : "Add a caption for your photo group or single photo..."}
            rows="3"
            disabled={loading}
          ></textarea>
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="upload-button" disabled={loading || selectedFiles.length === 0 || (contentType === 'video' && !title.trim())}>
          {loading ? `Uploading ${contentType === 'video' ? 'Video' : 'Photos'}...` : `Upload ${contentType === 'video' ? 'Video' : 'Photos'}`}
        </button>
        {loading && <p className="upload-message">Uploading content...</p>}
      </form>
    </div>
  );
}

export default UploadContentPage;
