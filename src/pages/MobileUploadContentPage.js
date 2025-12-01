import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './MobileUploadContentPage.css';

const CONTENT_BUCKET = 'content';
// eslint-disable-next-line no-unused-vars
const THUMBNAIL_BUCKET = 'content';
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';

function MobileUploadContentPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, userRole, logout } = useAuth();

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'creator') {
      alert("Access Denied: You must be logged in as a creator to upload content.");
      logout();
      navigate('/');
    }
  }, [isLoggedIn, userRole, navigate, logout]);

  const clearSelection = useCallback(() => {
    setSelectedMedia(null);
    setMediaPreviewUrl(null);
    setMediaType(null);
    setTitle('');
    setCaption('');
    setUploadError(null);
    setUploadSuccess(null);
  }, []);

  // eslint-disable-next-line no-unused-vars
  const getPublicUrl = useCallback((path, bucketName = CONTENT_BUCKET) => { // Suppress warning
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const selectPhotoOrVideo = useCallback(async (isPhoto = true) => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const galleryOptions = {
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        presentationStyle: 'popover',
      };

      if (isPhoto) {
        galleryOptions.mediaType = 'photo';
      } else {
        galleryOptions.mediaType = 'video';
      }

      const media = await Camera.getPhoto(galleryOptions);

      if (media?.webPath) {
        setSelectedMedia(media);
        setMediaPreviewUrl(media.webPath);
        setMediaType(isPhoto ? 'photo' : 'video');
      } else {
        console.log('No media selected from gallery.');
      }

    } catch (e) {
      console.error('Error selecting media from gallery:', e);
      setUploadError('Failed to select media: ' + e.message);
    } finally {
      setIsProcessingMedia(false);
    }
  }, [isProcessingMedia]);

  const takePhotoOrVideo = useCallback(async (isPhoto = true) => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const cameraOptions = {
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: false,
        presentationStyle: 'fullscreen',
      };

      if (isPhoto) {
        cameraOptions.mediaType = 'photo';
      } else {
        cameraOptions.mediaType = 'video';
        alert("Direct video capture from camera is not fully supported with current setup. Please select from gallery for video.");
        setIsProcessingMedia(false);
        selectPhotoOrVideo(false);
        return;
      }

      const photo = await Camera.getPhoto(cameraOptions);

      if (photo?.webPath) {
        setSelectedMedia(photo);
        setMediaPreviewUrl(photo.webPath);
        setMediaType(isPhoto ? 'photo' : 'video');
      } else {
        console.log('No media captured.');
      }

    } catch (e) {
      console.error('Error taking photo/video:', e);
      setUploadError('Failed to capture media: ' + e.message);
    } finally {
      setIsProcessingMedia(false);
    }
  }, [isProcessingMedia, selectPhotoOrVideo]);


  const uploadContent = useCallback(async () => {
    if (!selectedMedia || !user?.id) {
      setUploadError('No media selected or user not authenticated.');
      return;
    }
    if (!title.trim()) {
      setUploadError('Please add a title for your content.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const fileExtension = selectedMedia.format || (mediaType === 'video' ? 'mp4' : 'jpeg');
      const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
      const storagePath = `public/${fileName}`;

      let blob;
      if (Capacitor.isNativePlatform()) {
        const response = await Filesystem.readFile({
          path: selectedMedia.path,
          directory: Directory.Data,
          encoding: 'base64'
        });
        const byteCharacters = atob(response.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: selectedMedia.mimeType });
      } else {
        blob = await fetch(selectedMedia.webPath).then(r => r.blob());
      }

      // eslint-disable-next-line no-unused-vars
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(CONTENT_BUCKET)
        .upload(storagePath, blob, {
          contentType: selectedMedia.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
          upsert: false,
        });

      if (uploadError) throw uploadError;

      let thumbnailUrl = null;
      if (mediaType === 'video') {
        thumbnailUrl = DEFAULT_VIDEO_THUMBNAIL_PLACEHADER;
      }

      const { error: insertError } = await supabase.from('content').insert([
        {
          creator_id: user.id,
          storage_path: storagePath,
          thumbnail_path: thumbnailUrl,
          title: title.trim(),
          caption: caption.trim(),
          content_type: mediaType,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) throw insertError;

      setUploadSuccess('Content uploaded successfully!');
      clearSelection();
      navigate('/my-content');

    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }, [selectedMedia, user, title, caption, mediaType, clearSelection, navigate]);


  if (!isLoggedIn || userRole !== 'creator' || user === undefined) {
    return <div className="mobile-upload-container"><p>Checking access...</p></div>;
  }

  return (
    <div className="mobile-upload-container">
      <h2>Upload New Content</h2>
      <p>Capture or select photos/videos to share with your audience.</p>

      {uploadError && <p className="error-message">{uploadError}</p>}
      {uploadSuccess && <p className="success-message">{uploadSuccess}</p>}

      {!selectedMedia ? (
        <div className="upload-options">
          <h3>Choose Media Source:</h3>
          <div className="media-source-buttons">
            <button
              onClick={() => takePhotoOrVideo(true)}
              disabled={isProcessingMedia || uploading}
              className="upload-button"
            >
              <ion-icon name="camera-outline"></ion-icon> Take Photo
            </button>
            <button
              onClick={() => selectPhotoOrVideo(true)}
              disabled={isProcessingMedia || uploading}
              className="upload-button"
            >
              <ion-icon name="image-outline"></ion-icon> Choose Photo
            </button>
            <button
              onClick={() => selectPhotoOrVideo(false)}
              disabled={isProcessingMedia || uploading}
              className="upload-button"
            >
              <ion-icon name="videocam-outline"></ion-icon> Choose Video
            </button>
          </div>
          <p className="note">Note: Direct video capture is not yet fully supported. Please select existing videos.</p>
        </div>
      ) : (
        <div className="media-preview-section">
          <h3>Media Preview:</h3>
          <div className="media-preview-wrapper">
            {mediaType === 'photo' ? (
              <img src={mediaPreviewUrl} alt="Media Preview" className="uploaded-media-preview" />
            ) : (
              <video src={mediaPreviewUrl} controls className="uploaded-media-preview"></video>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="title">Title:</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your content a catchy title"
              disabled={uploading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="caption">Caption (Optional):</label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a description or some hashtags"
              disabled={uploading}
            ></textarea>
          </div>

          <div className="form-actions">
            <button onClick={uploadContent} disabled={uploading || isProcessingMedia} className="upload-button primary">
              {uploading ? 'Uploading...' : 'Upload to Draftey'}
            </button>
            <button onClick={clearSelection} disabled={uploading || isProcessingMedia} className="upload-button secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileUploadContentPage;
