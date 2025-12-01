import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';
import './UserProfileViewPage.css';
import { Capacitor } from '@capacitor/core';

const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/120';
const ITEMS_PER_PAGE = 36; // 6 items per row × 6 rows

function UserProfileViewPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isVisitorSubscribed } = useAuth();

  const [creator, setCreator] = useState(null);
  const [allContent, setAllContent] = useState([]);
  const [paginatedContent, setPaginatedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAndroid, setIsAndroid] = useState(false);

  const [showSlideshowModal, setShowSlideshowModal] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const contentGridRef = useRef(null);

  useEffect(() => {
    setIsAndroid(Capacitor.isNativePlatform('android'));
  }, []);

  const getPublicUrl = (path, bucketName = 'content') => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  };

  const getRandomVideoTimeOffset = () => {
    return Math.floor(Math.random() * 30);
  };

  // Handle pagination
  useEffect(() => {
    if (allContent.length > 0) {
      const total = Math.ceil(allContent.length / ITEMS_PER_PAGE);
      setTotalPages(total);

      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      setPaginatedContent(allContent.slice(startIndex, endIndex));

      window.scrollTo(0, 0);
    }
  }, [currentPage, allContent]);

  // Swipe handlers for Android
  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    // Swiped left (next page)
    if (diff > swipeThreshold && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }

    // Swiped right (previous page)
    if (diff < -swipeThreshold && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!userId) {
          throw new Error('No creator ID provided');
        }

        // Fetch creator profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, nickname, bio, avatar_path, creator_type')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error('Creator not found.');

        setCreator(profileData);

        // Check access control
        if (profileData.creator_type === 'premium_creator' && !isVisitorSubscribed) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        // Fetch creator's content
        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('id, storage_path, thumbnail_path, title, caption, group_id, created_at, content_type, is_active')
          .eq('creator_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (contentError) throw contentError;

        if (contentData && contentData.length > 0) {
          const photos = contentData.filter(item => item.content_type === 'photo');
          const videos = contentData.filter(item => item.content_type === 'video');

          const photoGroups = {};
          const singlePhotos = [];

          photos.forEach(photo => {
            if (photo.group_id) {
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
            } else {
              singlePhotos.push({
                id: photo.id,
                type: 'photo',
                url: getPublicUrl(photo.storage_path),
                caption: photo.caption,
                uploadDate: photo.created_at,
                storagePath: photo.storage_path,
              });
            }
          });

          const processedContent = [
            ...Object.values(photoGroups),
            ...singlePhotos,
            ...videos.map(v => ({
              id: v.id,
              type: 'video',
              title: v.title,
              caption: v.caption,
              uploadDate: v.created_at,
              url: getPublicUrl(v.storage_path),
              thumbnailUrl: v.thumbnail_path 
                ? getPublicUrl(v.thumbnail_path) 
                : `${getPublicUrl(v.storage_path)}#t=${getRandomVideoTimeOffset()}`,
              storagePath: v.storage_path,
            })),
          ];

          processedContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
          setAllContent(processedContent);
        }

      } catch (err) {
        setError(err.message || 'Failed to load creator profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorProfile();
  }, [userId, isVisitorSubscribed]);

  const openSlideshow = (item) => {
    if (item.type === 'photo_group') {
      setCurrentSlideshowPhotos(item.photos.map(p => ({
        id: p.id,
        url: p.url,
        caption: item.caption,
      })));
    } else {
      setCurrentSlideshowPhotos([{
        id: item.id,
        url: item.url,
        caption: item.caption,
      }]);
    }
    setCurrentSlideshowIndex(0);
    setShowSlideshowModal(true);
  };

  const closeSlideshow = () => {
    setShowSlideshowModal(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowIndex(0);
  };

  const openVideoPlayer = (videoItem) => {
    setCurrentVideo({
      id: videoItem.id,
      url: videoItem.url,
      thumbnailUrl: videoItem.thumbnailUrl,
      title: videoItem.title,
    });
    setShowVideoModal(true);
  };

  const closeVideoPlayer = () => {
    setShowVideoModal(false);
    setCurrentVideo(null);
  };

  if (loading) {
    return (
      <div className="user-profile-view-container">
        <p>Loading creator profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-profile-view-container">
        <button className="back-button" onClick={() => navigate(-1)}>← Back</button>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="user-profile-view-container">
        <button className="back-button" onClick={() => navigate(-1)}>← Back</button>
        <p className="error-message">Creator not found.</p>
      </div>
    );
  }

  return (
    <div 
      className="user-profile-view-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button className="back-button" onClick={() => navigate(-1)}>← Back</button>

      <div className="profile-header">
        <img
          src={creator.avatar_path ? getPublicUrl(creator.avatar_path, 'avatars') : DEFAULT_AVATAR_PLACEHOLDER}
          alt={creator.nickname}
          className="profile-image"
        />
        <h1 className="profile-nickname">{creator.nickname || 'Creator'}</h1>
        {creator.bio && <p className="profile-bio">{creator.bio}</p>}
      </div>

      {accessDenied ? (
        <div className="subscription-call-to-action locked-content-message">
          <p className="subscription-info">🔒 This is a premium creator</p>
          <p>Subscribe to view their exclusive content!</p>
          <Link to="/subscribe" className="subscribe-link-button">
            Subscribe Now - 20 KES / 24 Hours
          </Link>
        </div>
      ) : (
        <>
          {paginatedContent.length === 0 ? (
            <p>This creator hasn't uploaded any content yet.</p>
          ) : (
            <>
              <div 
                className="creator-content-grid"
                ref={contentGridRef}
              >
                {paginatedContent.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="content-card">
                    <div
                      className="content-media"
                      onClick={item.type === 'video' ? () => openVideoPlayer(item) : () => openSlideshow(item)}
                    >
                      {item.type === 'photo' || item.type === 'photo_group' ? (
                        <img
                          src={item.url || (item.photos?.[0]?.url)}
                          alt={item.caption || 'Photo'}
                          className="content-thumbnail"
                        />
                      ) : (
                        <video
                          poster={item.thumbnailUrl}
                          className="content-thumbnail"
                        >
                          <source src={item.url} type="video/mp4" />
                        </video>
                      )}
                      <div className="content-overlay">
                        <span className="content-type">
                          {item.type === 'photo_group' ? '📸📸' : item.type === 'photo' ? '📸' : '🎥'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls - Only show on non-Android or if needed */}
              {!isAndroid && totalPages > 1 && (
                <div className="pagination-controls">
                  <button 
                    onClick={handlePrevPage} 
                    disabled={currentPage === 1}
                    className="pagination-button"
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    onClick={handleNextPage} 
                    disabled={currentPage === totalPages}
                    className="pagination-button"
                  >
                    Next →
                  </button>
                </div>
              )}

              {/* Android swipe hint */}
              {isAndroid && totalPages > 1 && (
                <div className="pagination-info" style={{ marginTop: '20px' }}>
                  Page {currentPage} of {totalPages} • Swipe to navigate
                </div>
              )}
            </>
          )}
        </>
      )}

      {showSlideshowModal && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          initialIndex={currentSlideshowIndex}
          onClose={closeSlideshow}
        />
      )}

      {showVideoModal && (
        <VideoPlayerModal
          video={currentVideo}
          onClose={closeVideoPlayer}
        />
      )}
    </div>
  );
}

export default UserProfileViewPage;
