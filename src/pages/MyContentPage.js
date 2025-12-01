import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import './MyContentPage.css';

function MyContentPage() {
  const { isLoggedIn } = useAuth();
  const [myContent, setMyContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowCaption, setCurrentSlideshowCaption] = useState('');

  useEffect(() => {
    const fetchMyContent = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!isLoggedIn) {
          throw new Error("You must be logged in to view your content.");
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("User not found.");
        }
        const creatorId = user.id;

        const bucketName = 'content';

        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        // Fetch creator's content from merged table
        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('id, created_at, storage_path, thumbnail_path, title, caption, group_id, content_type')
          .eq('creator_id', creatorId)
          .order('created_at', { ascending: false });

        if (contentError) throw contentError;

        const allMyContent = [];

        if (contentData) {
          // Process photos: Group by group_id
          const photoGroups = {};
          const photos = contentData.filter(item => item.content_type === 'photo');

          photos.forEach(photo => {
            if (!photoGroups[photo.group_id]) {
              photoGroups[photo.group_id] = {
                id: photo.group_id,
                type: 'photo_group',
                uploadDate: photo.created_at,
                caption: photo.caption,
                photos: [],
              };
            }
            photoGroups[photo.group_id].photos.push({
              id: photo.id,
              url: getPublicUrl(photo.storage_path),
              storagePath: photo.storage_path,
            });
          });

          Object.values(photoGroups).forEach(group => allMyContent.push(group));

          // Process videos
          const videos = contentData.filter(item => item.content_type === 'video');
          videos.forEach(video => {
            allMyContent.push({
              id: video.id,
              type: 'video',
              thumbnail: getPublicUrl(video.thumbnail_path || video.storage_path),
              videoUrl: getPublicUrl(video.storage_path),
              title: video.title,
              uploadDate: video.created_at,
              caption: video.caption,
              storagePath: video.storage_path,
            });
          });
        }

        allMyContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        setMyContent(allMyContent);

      } catch (err) {
        setError(err.message || 'Failed to fetch your content.');
        console.error('Error fetching my content:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isLoggedIn) {
      fetchMyContent();
    } else {
      setLoading(false);
      setError("Please log in to view your content.");
    }
  }, [isLoggedIn]);

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

  return (
    <div className="my-content-container">
      <h2>My Content</h2>
      <p>Here you can view all your uploaded photos and videos.</p>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading your content...</p>
      ) : myContent.length === 0 ? (
        <p>You haven't uploaded any content yet. Start sharing!</p>
      ) : (
        <div className="my-content-grid">
          {myContent.map((item) => (
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

export default MyContentPage;
