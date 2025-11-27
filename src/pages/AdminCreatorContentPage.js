import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal'; // Re-use photo slideshow modal
import './AdminCreatorContentPage.css'; // We'll create this CSS file next

// Define the admin email for testing purposes
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function AdminCreatorContentPage() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [creatorContent, setCreatorContent] = useState([]);
  const [creatorNickname, setCreatorNickname] = useState('Creator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState(null);

  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowCaption, setCurrentSlideshowCaption] = useState('');

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === ADMIN_EMAIL) {
        setCurrentAdminEmail(user.email);
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        logout();
        navigate('/');
      }
    };
    checkAdminStatus();
  }, [navigate, logout]);

  useEffect(() => {
    if (currentAdminEmail && creatorId) {
      const fetchCreatorContent = async () => {
        setLoading(true);
        setError(null);
        try {
          // Fetch creator's nickname first
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', creatorId)
            .single();

          if (profileError) throw profileError;
          if (profileData) setCreatorNickname(profileData.nickname);

          const bucketName = 'content';
          const getPublicUrl = (path) => {
            if (!path) return null;
            const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
            return data.publicUrl;
          };

          // 1. Fetch creator's photos
          const { data: photosData, error: photosError } = await supabase
            .from('photos')
            .select('id, created_at, storage_path, caption, group_id')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false });

          if (photosError) throw photosError;

          // 2. Fetch creator's videos
          const { data: videosData, error: videosError } = await supabase
            .from('videos')
            .select('id, created_at, storage_path, thumbnail_path, title, caption')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false });

          if (videosError) throw videosError;

          const allContent = [];

          // Process photos: Group by group_id
          if (photosData) {
            const photoGroups = {};
            photosData.forEach(photo => {
              if (!photoGroups[photo.group_id]) {
                photoGroups[photo.group_id] = {
                  id: photo.group_id,
                  type: 'photo_group',
                  uploadDate: photo.created_at,
                  caption: photo.caption,
                  photos: [],
                  storagePaths: [], // To store all storage paths for deletion
                };
              }
              photoGroups[photo.group_id].photos.push({
                id: photo.id,
                url: getPublicUrl(photo.storage_path),
                storagePath: photo.storage_path,
              });
              photoGroups[photo.group_id].storagePaths.push(photo.storage_path);
            });
            Object.values(photoGroups).forEach(group => allContent.push(group));
          }

          // Process videos
          if (videosData) {
            videosData.forEach(video => {
              allContent.push({
                id: video.id,
                type: 'video',
                thumbnail: video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : getPublicUrl(video.storage_path),
                videoUrl: getPublicUrl(video.storage_path),
                title: video.title,
                uploadDate: video.created_at,
                caption: video.caption,
                storagePath: video.storage_path,
              });
            });
          }

          allContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
          setCreatorContent(allContent);

        } catch (err) {
          setError(err.message || 'Failed to fetch creator content.');
          console.error('Error fetching creator content:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCreatorContent();
    }
  }, [currentAdminEmail, creatorId, navigate]); // Added navigate to dependency array

  const handleTakeDownContent = async (itemId, itemType, storagePaths) => { // storagePaths is now an array for groups
    if (!window.confirm(`Are you sure you want to permanently take down this ${itemType} (${itemId})? This will delete it from the database and storage.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Delete files from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('content')
        .remove(Array.isArray(storagePaths) ? storagePaths : [storagePaths]); // Handle single or multiple paths
      if (storageError) throw storageError;

      // 2. Delete record(s) from the database table (photos or videos)
      let dbError;
      if (itemType === 'photo_group') {
        // Delete all photos belonging to this group_id
        const { error } = await supabase.from('photos').delete().eq('group_id', itemId);
        dbError = error;
      } else if (itemType === 'video') {
        const { error } = await supabase.from('videos').delete().eq('id', itemId);
        dbError = error;
      }

      if (dbError) throw dbError;

      // Update UI: remove the content from the list
      setCreatorContent(prevContent => prevContent.filter(item => item.id !== itemId));
      alert(`${itemType} ${itemId} taken down successfully!`);

    } catch (err) {
      setError(err.message || `Failed to take down ${itemType}.`);
      console.error(`Error taking down ${itemType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const openSlideshow = (photos, caption) => {
    setCurrentSlideshowPhotos(photos);
    setCurrentSlideshowCaption(caption);
    setIsSlideshowOpen(true);
  };

  const closeSlideshow = () => {
    setIsSlideshowOpen(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowCaption('');
  };


  if (!currentAdminEmail) {
    return <div className="admin-creator-content-container">Loading admin status...</div>;
  }

  if (loading) {
    return <div className="admin-creator-content-container"><p>Loading creator content...</p></div>;
  }

  if (error) {
    return <div className="admin-creator-content-container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="admin-creator-content-container">
      <h2>Content from {creatorNickname}</h2>
      <p>Review and manage all uploaded photos and videos by this creator.</p>

      {creatorContent.length === 0 ? (
        <p>This creator has not uploaded any content yet.</p>
      ) : (
        <div className="creator-content-grid">
          {creatorContent.map((item) => (
            <div key={item.id} className="content-card">
              {item.type === 'photo_group' ? (
                <div className="photo-group-card-content" onClick={() => openSlideshow(item.photos, item.caption)}>
                  <img src={item.photos[0].url} alt={item.caption || 'Photo group'} className="content-thumbnail" />
                  <div className="group-overlay">
                    <span className="group-icon">📸</span>
                    <p>{item.photos.length} Photos</p>
                  </div>
                  <div className="content-details">
                    <h4>{item.caption || 'Photo Group'}</h4>
                    <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                <div className="video-card-content">
                  <video controls src={item.videoUrl} poster={item.thumbnail} className="content-thumbnail">
                    Your browser does not support the video tag.
                  </video>
                  <div className="content-details">
                    <h4>{item.title || 'No Title'}</h4>
                    <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                    {item.caption && <p className="video-caption">{item.caption}</p>}
                  </div>
                </div>
              )}
              <div className="card-actions">
                <button onClick={() => handleTakeDownContent(item.id, item.type, item.type === 'photo_group' ? item.storagePaths : item.storagePath)} className="takedown-button">Take Down</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isSlideshowOpen && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          caption={currentSlideshowCaption}
          onClose={closeSlideshow}
        />
      )}
    </div>
  );
}

export default AdminCreatorContentPage;
