import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';
import './UserProfileViewPage.css';
import { Capacitor } from '@capacitor/core';

const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/120';
const ITEMS_PER_PAGE = 36;
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';

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
  
  // Add state to track avatar URL
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR_PLACEHOLDER);

  const [showSlideshowModal, setShowSlideshowModal] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);
  const [currentSlideshowCaption, setCurrentSlideshowCaption] = useState('');
  const [slideshowContext, setSlideshowContext] = useState({ creatorId: null, isPremiumContent: false, contentType: 'photo' });

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const contentGridRef = useRef(null);
  const videoRefs = useRef({});

  useEffect(() => {
    setIsAndroid(Capacitor.isNativePlatform('android'));
  }, []);

  const getPublicUrl = useCallback((path, bucketName = 'content') => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  // eslint-disable-next-line no-unused-vars
  const getRandomVideoTimeOffset = () => { // Suppress warning
    return Math.floor(Math.random() * 30);
  };

  const logView = useCallback(async (contentId, creatorId, contentType, isPremiumContent) => {
    console.log('--- Attempting to log view (UserProfileViewPage) ---');
    console.log('Content ID:', contentId);
    console.log('Creator ID (for view logging):', creatorId);
    console.log('Content Type (for view logging):', contentType);
    console.log('Is Premium Content:', isPremiumContent);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const viewerEmailToLog = user?.email || localStorage.getItem('visitorEmail') || null;

      console.log('Viewer Email (to log):', viewerEmailToLog);

      if (isPremiumContent && viewerEmailToLog && isVisitorSubscribed) {
        console.log(`Checking for existing view for premium content ${contentId} by ${viewerEmailToLog}`);
        const { data: existingViews, error: checkError } = await supabase
          .from('views')
          .select('id')
          .eq('content_id', contentId)
          .eq('viewer_email', viewerEmailToLog)
          .limit(1);

        if (checkError) {
          console.error('Error checking for existing view (UserProfileViewPage):', checkError);
        } else if (existingViews && existingViews.length > 0) {
          console.log(`Duplicate view prevented for premium content ${contentId} by ${viewerEmailToLog}`);
          return;
        }
      }
      
      console.log('Values to insert:', {
        content_id: contentId,
        creator_id: creatorId,
        content_type: contentType,
        viewer_email: viewerEmailToLog,
        viewed_at: new Date().toISOString(),
      });

      const { error: insertError } = await supabase.from('views').insert([
        {
          content_id: contentId,
          creator_id: creatorId,
          content_type: contentType,
          viewer_email: viewerEmailToLog,
          viewed_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        console.error('Supabase INSERT Error (UserProfileViewPage):', insertError);
      } else {
        console.log('View successfully logged for contentId (UserProfileViewPage):', contentId);
      }
    } catch (err) {
      console.error('Error in logView function (UserProfileViewPage):', err);
    }
    console.log('--- End log view attempt (UserProfileViewPage) ---');
  }, [isVisitorSubscribed]);

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

    if (diff > swipeThreshold && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }

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

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, nickname, bio, avatar_path, user_type')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error('Creator not found.');

        setCreator(profileData);
        
        // Fix avatar URL issue by explicitly setting it here
        if (profileData.avatar_path) {
          const avatarPublicUrl = getPublicUrl(profileData.avatar_path, 'avatars');
          console.log("Avatar path:", profileData.avatar_path);
          console.log("Avatar URL generated:", avatarPublicUrl);
          setAvatarUrl(avatarPublicUrl || DEFAULT_AVATAR_PLACEHOLDER);
        } else {
          setAvatarUrl(DEFAULT_AVATAR_PLACEHOLDER);
        }

        // Fix the subscription check logic
        // Only set accessDenied if the creator is premium AND the visitor is NOT subscribed
        if (profileData.user_type === 'premium_creator' && !isVisitorSubscribed) {
          console.log("Setting access denied: Premium creator and visitor not subscribed");
          setAccessDenied(true);
          setLoading(false);
          return;
        } else {
          // Make sure to set accessDenied to false in all other cases
          console.log("Access granted: Either not premium or visitor is subscribed");
          setAccessDenied(false);
        }

        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('id, storage_path, thumbnail_path, title, caption, group_id, created_at, content_type, is_active, views_count:views(count)')
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
                  creator_id: userId,
                  content_type: 'photo',
                  isPremiumContent: profileData.user_type === 'premium_creator',
                  views: photo.views_count ? photo.views_count[0].count : 0,
                };
              }
              photoGroups[photo.group_id].photos.push({
                id: photo.id,
                url: getPublicUrl(photo.storage_path),
                storagePath: photo.storage_path,
                creator_id: userId,
                isPremiumContent: profileData.user_type === 'premium_creator',
                views: photo.views_count ? photo.views_count[0].count : 0,
              });
            } else {
              singlePhotos.push({
                id: photo.id,
                type: 'photo',
                url: getPublicUrl(photo.storage_path),
                caption: photo.caption,
                uploadDate: photo.created_at,
                storagePath: photo.storage_path,
                creator_id: userId,
                content_type: 'photo',
                isPremiumContent: profileData.user_type === 'premium_creator',
                views: photo.views_count ? photo.views_count[0].count : 0,
              });
            }
          });

          const processedContent = [
            ...Object.values(photoGroups),
            ...videos.map(v => ({
              id: v.id,
              type: 'video',
              title: v.title,
              caption: v.caption,
              uploadDate: v.created_at,
              url: getPublicUrl(v.storage_path),
              thumbnailUrl: v.thumbnail_path 
                ? getPublicUrl(v.thumbnail_path) 
                : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER,
              storagePath: v.storage_path,
              creator_id: userId,
              content_type: 'video',
              isPremiumContent: profileData.user_type === 'premium_creator',
              views: v.views_count ? v.views_count[0].count : 0,
            })),
            ...singlePhotos,
          ];

          processedContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
          setAllContent(processedContent);
        }

      } catch (err) {
        setError(err.message || 'Failed to load creator profile.');
        console.error('Error in fetchCreatorProfile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorProfile();
  }, [userId, isVisitorSubscribed, getPublicUrl]);

  const openSlideshow = (item) => {
    const isPremium = item.isPremiumContent;
    
    const photosForSlideshow = item.type === 'photo_group'
      ? item.photos.map(p => ({
          id: p.id,
          url: p.url,
          caption: p.caption || item.caption,
          creator_id: item.creator_id,
          isPremiumContent: isPremium,
          type: 'photo',
        }))
      : [{
          id: item.id,
          url: item.url,
          caption: item.caption,
          creator_id: item.creator_id,
          isPremiumContent: isPremium,
          type: 'photo',
        }];

    setCurrentSlideshowPhotos(photosForSlideshow);
    setCurrentSlideshowCaption(item.caption);
    setCurrentSlideshowIndex(0);
    
    setSlideshowContext({
      creatorId: item.creator_id,
      isPremiumContent: isPremium,
      contentType: 'photo',
    });

    setShowSlideshowModal(true);
  };

  const closeSlideshow = () => {
    setShowSlideshowModal(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowIndex(0);
    setCurrentSlideshowCaption('');
    setSlideshowContext({ creatorId: null, isPremiumContent: false, contentType: 'photo' });
  };

  const openVideoPlayer = (videoItem) => {
    const isPremium = videoItem.isPremiumContent;
    logView(videoItem.id, videoItem.creator_id, videoItem.content_type, isPremium);
    
    setCurrentVideo({
      id: videoItem.id,
      url: videoItem.url,
      thumbnailUrl: videoItem.thumbnailUrl,
      title: videoItem.title,
      creator_id: videoItem.creator_id,
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
      onTouchStart={isAndroid ? handleTouchStart : undefined}
      onTouchEnd={isAndroid ? handleTouchEnd : undefined}
    >
      <button className="back-button" onClick={() => navigate(-1)}>← Back</button>

      <div className="profile-header">
        {/* Use the explicitly set avatarUrl instead of calculating it inline */}
        <img
          src={avatarUrl}
          alt={creator.nickname || 'Creator'}
          className="profile-image"
          onError={(e) => {
            console.log("Avatar image failed to load, using placeholder");
            e.target.src = DEFAULT_AVATAR_PLACEHOLDER;
          }}
        />
        <h1 className="profile-nickname">{creator.nickname || 'Creator'}</h1>
        {creator.bio && <p className="profile-bio">{creator.bio}</p>}
      </div>

      {accessDenied ? (
        <div className="subscription-call-to-action locked-content-message">
          <p className="subscription-info">🔒 This is a premium creator</p>
          <p>Subscribe to view their exclusive content!</p>
          <Link to="/subscribe" className="subscribe-link-button">
            Subscribe Now - 20 KES / 2 Hours
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
                  <div key={`$aspect_ratio_1-${item.id}`} className="content-card">
                    <div
                      className="content-media"
                      onClick={item.type === 'video' ? () => openVideoPlayer(item) : () => openSlideshow(item)}
                      onMouseEnter={item.type === 'video' ? () => handleVideoMouseEnter(item.id) : undefined}
                      onMouseLeave={item.type === 'video' ? () => handleVideoMouseLeave(item.id) : undefined}
                    >
                      {item.type === 'photo' || item.type === 'photo_group' ? (
                        <img
                          src={item.url || (item.photos?.[0]?.url)}
                          alt={item.caption || 'Photo'}
                          className="content-thumbnail"
                          onError={(e) => {
                            console.log("Content thumbnail failed to load");
                            e.target.src = DEFAULT_AVATAR_PLACEHOLDER;
                          }}
                        />
                      ) : (
                        <video
                          ref={el => (videoRefs.current[item.id] = el)}
                          poster={item.thumbnailUrl}
                          className="content-thumbnail"
                          muted
                          playsInline
                        >
                          <source src={item.url} type="video/mp4" />
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
                  </div>
                ))}
              </div>

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

export default UserProfileViewPage;
