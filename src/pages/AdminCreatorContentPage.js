import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';
import './AdminCreatorContentPage.css';

const ADMIN_EMAIL = 'admin@kenyaflashing.com';
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';
// eslint-disable-next-line no-unused-vars
const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/40'; // Suppress warning if not directly used here
// eslint-disable-next-line no-unused-vars
const AD_MEDIA_BUCKET = 'ad-media'; // Suppress warning if not directly used here

function AdminCreatorContentPage() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { logout, isVisitorSubscribed } = useAuth(); // 'isVisitorSubscribed' is used for context, but not directly in this component's logic.

  const [creatorContent, setCreatorContent] = useState([]);
  const [creatorNickname, setCreatorNickname] = useState('Creator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState(null);

  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);
  const [currentSlideshowCaption, setCurrentSlideshowCaption] = useState('');
  const [slideshowContext, setSlideshowContext] = useState({ creatorId: null, isPremiumContent: false, contentType: 'photo' });

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const videoRefs = useRef({});


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

  const logView = useCallback(async (contentId, creatorId, contentType, isPremiumContent) => {
    console.log('Admin page: View event detected, but not logged to DB for admin actions.');
    console.log({ contentId, creatorId, contentType, isPremiumContent });
  }, []);


  useEffect(() => {
    if (currentAdminEmail && creatorId) {
      const fetchCreatorContent = async () => {
        setLoading(true);
        setError(null);
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('nickname, user_type') // Changed creator_type to user_type
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

          const { data: contentData, error: contentError } = await supabase
            .from('content')
            .select('id, created_at, storage_path, thumbnail_path, title, caption, group_id, content_type, is_active, views_count:views(count)')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false });

          if (contentError) throw contentError;

          const groupedContentMap = new Map(); // Use a Map for better grouping

          if (contentData) {
            contentData.forEach(item => {
              // Get public URL for media and thumbnail
              const itemUrl = getPublicUrl(item.storage_path);
              let itemThumbnail = item.thumbnail_path
                ? getPublicUrl(item.thumbnail_path)
                : (item.content_type === 'video' ? DEFAULT_VIDEO_THUMBNAIL_PLACEHADER : itemUrl); // Use itemUrl as fallback for photo thumbnail

              if (item.content_type === 'photo' && item.group_id) {
                // Group photos
                if (!groupedContentMap.has(item.group_id)) {
                  groupedContentMap.set(item.group_id, {
                    id: item.group_id, // Use group_id as the ID for the group
                    type: 'photo_group',
                    uploadDate: item.created_at,
                    caption: item.caption, // Use the caption of the first photo in the group as group caption
                    photos: [],
                    storagePaths: [], // To store all storage paths for group deletion
                    creator_id: creatorId,
                    content_type: 'photo', // Group is considered 'photo' type
                    isPremiumContent: profileData.user_type === 'premium_creator',
                    views: item.views_count ? item.views_count[0].count : 0, // Sum up views later if needed, or take first
                    is_active: item.is_active, // Take active status from one of the photos
                  });
                }
                groupedContentMap.get(item.group_id).photos.push({
                  id: item.id, // Individual photo ID
                  url: itemUrl,
                  storagePath: item.storage_path,
                  caption: item.caption,
                  creator_id: creatorId,
                  isPremiumContent: profileData.user_type === 'premium_creator',
                  views: item.views_count ? item.views_count[0].count : 0,
                });
                groupedContentMap.get(item.group_id).storagePaths.push(item.storage_path);
              } else {
                // Single photos (group_id is null) and videos
                groupedContentMap.set(item.id, { // Use item.id as the key for single items
                  id: item.id,
                  type: item.content_type,
                  url: itemUrl,
                  thumbnail: itemThumbnail,
                  videoUrl: item.content_type === 'video' ? itemUrl : null, // Only for videos
                  title: item.title,
                  caption: item.caption,
                  uploadDate: item.created_at,
                  storagePath: item.storage_path,
                  creator_id: creatorId,
                  content_type: item.content_type,
                  isPremiumContent: profileData.user_type === 'premium_creator',
                  views: item.views_count ? item.views_count[0].count : 0,
                  is_active: item.is_active,
                });
              }
            });

            const finalContentList = Array.from(groupedContentMap.values());
            finalContentList.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            setCreatorContent(finalContentList);
          }

        } catch (err) {
          setError(err.message || 'Failed to fetch creator content.');
          console.error('Error fetching creator content:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCreatorContent();
    }
  }, [currentAdminEmail, creatorId, navigate]); // Added navigate to dependencies as it's used in useEffect

  const handleTakeDownContent = async (itemId, itemType, storagePaths) => {
    if (!window.confirm(`Are you sure you want to permanently take down this ${itemType} (${itemId})? This will delete it from the database and storage.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!itemId) { // IMPORTANT: Add a check for null/undefined itemId before proceeding
        throw new Error("Content ID is missing, cannot take down.");
      }

      const pathsToDelete = Array.isArray(storagePaths) ? storagePaths : [storagePaths];
      const { error: storageError } = await supabase.storage
        .from('content')
        .remove(pathsToDelete);

      if (storageError) {
        throw storageError;
      }
      console.log(`Files removed from storage: ${pathsToDelete.join(', ')}`);

      if (itemType === 'photo_group') {
        const { error: deleteGroupError } = await supabase.from('content').delete().eq('group_id', itemId);
        if (deleteGroupError) throw deleteGroupError;
      } else {
        const { error: deleteItemError } = await supabase.from('content').delete().eq('id', itemId);
        if (deleteItemError) throw deleteItemError;
      }

      setCreatorContent(prevContent => prevContent.filter(item => item.id !== itemId && (item.type === 'photo_group' ? item.id !== itemId : true))); // Corrected filter for photo_group
      alert(`${itemType} ${itemId} taken down successfully!`);

    } catch (err) {
      setError(err.message || `Failed to take down ${itemType}.`);
      console.error(`Error taking down ${itemType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const openSlideshow = (item) => {
    const isPremium = item.isPremiumContent;
    
    const photosForSlideshow = item.type === 'photo_group'
      ? item.photos.map(p => ({
          id: p.id,
          url: p.url,
          caption: p.caption || item.caption,
          creator_id: item.creatorId,
          isPremiumContent: isPremium,
          type: 'photo',
        }))
      : [{
          id: item.id,
          url: item.url,
          caption: item.caption,
          creator_id: item.creatorId,
          isPremiumContent: isPremium,
          type: 'photo',
        }];

    setCurrentSlideshowPhotos(photosForSlideshow);
    setCurrentSlideshowCaption(item.caption);
    setCurrentSlideshowIndex(0);
    setSlideshowContext({
      creatorId: item.creatorId,
      isPremiumContent: isPremium,
      contentType: 'photo',
    });
    setIsSlideshowOpen(true);
  };

  const closeSlideshow = () => {
    setIsSlideshowOpen(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowIndex(0);
    setCurrentSlideshowCaption('');
    setSlideshowContext({ creatorId: null, isPremiumContent: false, contentType: 'photo' });
  };

  const openVideoPlayer = (videoItem) => {
    const isPremium = videoItem.isPremiumContent;
    logView(videoItem.id, videoItem.creatorId, videoItem.content_type, isPremium); 
    
    setCurrentVideo({
      id: videoItem.id,
      url: videoItem.videoUrl,
      thumbnailUrl: videoItem.thumbnail,
      title: videoItem.title,
      creator_id: videoItem.creatorId,
      content_type: videoItem.content_type,
      isPremiumContent: isPremium,
    });
    setShowVideoModal(true);
  };

  const closeVideoPlayer = () => {
    setShowVideoModal(false);
    setCurrentVideo(null);
  };

  const handleVideoMouseEnter = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.muted = true;
      video.play().catch(error => console.error("Video autoplay failed on hover:", error));
    }
  };

  const handleVideoMouseLeave = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
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
        <p>No content has been uploaded yet.</p>
      ) : (
        <div className="creator-content-grid">
          {creatorContent.map((item) => (
            <div key={item.id} className="content-card">
              <div 
                className="content-media"
                onClick={item.type === 'video' ? () => openVideoPlayer(item) : () => openSlideshow(item)}
                onMouseEnter={item.type === 'video' ? () => handleVideoMouseEnter(item.id) : undefined}
                onMouseLeave={item.type === 'video' ? () => handleVideoMouseLeave(item.id) : undefined}
              >
                {item.type === 'photo' || item.type === 'photo_group' ? (
                  <img src={item.url || item.photos?.[0]?.url} alt={`Content by ${item.creatorNickname}`} className="content-thumbnail" />
                ) : (
                  <video
                    ref={el => (videoRefs.current[item.id] = el)}
                    controls
                    src={item.videoUrl}
                    poster={item.thumbnail}
                    className="content-thumbnail"
                    muted
                    playsInline
                  >
                    <source src={item.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
                <div className="content-overlay">
                  <span className="content-type">
                    {item.type === 'photo_group' ? '📸📸' : item.type === 'photo' ? '📸' : '🎥'}
                  </span>
                </div>
                <div className="content-views-overlay">
                  👁 {item.views || 0}
                </div>
              </div>
              <div className="content-details">
                <h4>{item.type === 'photo_group' ? (item.caption || 'Photo Group') : (item.title || 'No Title')}</h4>
                <p>Creator: {item.creatorNickname}</p>
                <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                {item.caption && item.type !== 'photo_group' && <p className="video-caption">{item.caption}</p>}
              </div>
              <div className="card-actions">
                <button 
                  onClick={() => handleTakeDownContent(item.id, item.type, item.type === 'photo_group' ? item.storagePaths : item.storagePath)} 
                  className="takedown-button"
                >
                  Take Down
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isSlideshowOpen && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          caption={currentSlideshowPhotos[currentSlideshowIndex]?.caption || currentSlideshowCaption || ''}
          onClose={closeSlideshow}
          logView={logView}
          creatorId={slideshowContext.creatorId}
          contentType={slideshowContext.contentType}
          isPremiumContent={slideshowContext.isPremiumContent}
        />
      )}

      {showVideoModal && (
        <VideoPlayerModal
          video={currentVideo}
          onClose={closeVideoPlayer}
          logView={logView}
          creatorId={currentVideo?.creator_id || null}
          contentType={currentVideo?.content_type || 'video'}
          isPremiumContent={currentVideo?.isPremiumContent || false}
        />
      )}
    </div>
  );
}

export default AdminCreatorContentPage;
