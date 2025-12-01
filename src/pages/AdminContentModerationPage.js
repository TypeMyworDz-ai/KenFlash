import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';
import './AdminContentModerationPage.css';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = 'admin@kenyaflashing.com';
// eslint-disable-next-line no-unused-vars
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';
// eslint-disable-next-line no-unused-vars
const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/40';
// eslint-disable-next-line no-unused-vars
const AD_MEDIA_BUCKET = 'ad-media';

function AdminContentModerationPage() {
  // eslint-disable-next-line no-unused-vars
  const { logout, isVisitorSubscribed } = useAuth(); // Suppress warning
  const navigate = useNavigate();

  const [content, setContent] = useState([]);
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
    if (currentAdminEmail) {
      const fetchAllContent = async () => {
        setLoading(true);
        setError(null);
        try {
          const bucketName = 'content';

          const getPublicUrl = (path) => {
            if (!path) return null;
            const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
            return data.publicUrl;
          };

          const { data: contentData, error: contentError } = await supabase
            .from('content')
            .select(`
              id, created_at, creator_id, storage_path, thumbnail_path, title, caption, 
              content_type, is_active, profiles(nickname, creator_type), views_count:views(count)
            `)
            .order('created_at', { ascending: false });

          if (contentError) throw contentError;

          const allProcessedContent = [];

          if (contentData) {
            contentData.forEach(item => {
                const creatorNickname = item.profiles ? item.profiles.nickname : 'Unknown Creator';
                const isPremiumContent = item.profiles?.creator_type === 'premium_creator';
                
                if (item.content_type === 'photo' && item.group_id) {
                    return;
                }
                
                allProcessedContent.push({
                    id: item.id,
                    type: item.content_type,
                    creatorId: item.creator_id,
                    creatorNickname: creatorNickname,
                    url: getPublicUrl(item.storage_path),
                    thumbnail: item.thumbnail_path ? getPublicUrl(item.thumbnail_path) : getPublicUrl(item.storage_path),
                    videoUrl: getPublicUrl(item.storage_path),
                    title: item.title,
                    caption: item.caption,
                    uploadDate: item.created_at,
                    storagePath: item.storage_path,
                    isActive: item.is_active,
                    isPremiumContent: isPremiumContent,
                    views: item.views_count ? item.views_count[0].count : 0,
                });
            });

            const groupedPhotosMap = new Map();
            const finalContentList = [];

            allProcessedContent.forEach(item => {
                if (item.type === 'photo' && item.group_id) {
                    if (!groupedPhotosMap.has(item.group_id)) {
                        groupedPhotosMap.set(item.group_id, {
                            id: item.group_id,
                            type: 'photo_group',
                            creatorId: item.creatorId,
                            creatorNickname: item.creatorNickname,
                            uploadDate: item.uploadDate,
                            caption: item.caption,
                            photos: [],
                            storagePaths: [],
                            isPremiumContent: item.isPremiumContent,
                            views: item.views,
                        });
                    }
                    groupedPhotosMap.get(item.group_id).photos.push({
                        id: item.id,
                        url: getPublicUrl(item.storagePath),
                        storagePath: item.storagePath,
                        caption: item.caption,
                        creator_id: item.creatorId,
                        isPremiumContent: item.isPremiumContent,
                        type: 'photo',
                        views: item.views,
                    });
                    groupedPhotosMap.get(item.group_id).storagePaths.push(item.storagePath);
                } else {
                    finalContentList.push(item);
                }
            });

            Object.values(groupedPhotosMap).forEach(group => finalContentList.push(group));
            finalContentList.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            setContent(finalContentList);
          }

        } catch (err) {
          setError(err.message || 'Failed to fetch content for moderation.');
          console.error('Error fetching content:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchAllContent();
    }
  }, [currentAdminEmail]);

  const handleTakeDownContent = async (itemId, itemType, storagePaths) => {
    if (!window.confirm(`Are you sure you want to permanently take down this ${itemType} (${itemId})? This will delete it from the database and storage.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
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

      setContent(prevContent => prevContent.filter(item => item.id !== itemId && item.group_id !== itemId));
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
    return <div className="admin-content-moderation-container">Loading admin status...</div>;
  }

  if (loading) {
    return <div className="admin-content-moderation-container"><p>Loading all content...</p></div>;
  }

  if (error) {
    return <div className="admin-content-moderation-container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="admin-content-moderation-container">
      <h2>Content Moderation</h2>
      <p>Review and manage all uploaded photos and videos.</p>

      {content.length === 0 ? (
        <p>No content has been uploaded yet.</p>
      ) : (
        <div className="content-grid">
          {content.map((item) => (
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

export default AdminContentModerationPage;
