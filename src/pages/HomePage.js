import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { supabase } from '../supabaseClient';
import './HomePage.css';

const AD_MEDIA_BUCKET = 'ad-media';
const CONTENT_PER_PAGE = 30; // 5 columns × 6 rows
const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/40'; // Consistent placeholder
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video'; // Generic video placeholder

function HomePage() {
  const { isVisitorSubscribed } = useAuth();
  const navigate = useNavigate();

  const [content, setContent] = useState([]); // State for free content
  const [premiumContent, setPremiumContent] = useState([]); // State for premium content
  const [advertisements, setAdvertisements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAgeModal, setShowAgeModal] = useState(() => {
    return localStorage.getItem('ageVerified') !== 'true';
  });

  const [showCookieConsent, setShowCookieConsent] = useState(() => {
    if (localStorage.getItem('ageVerified') === 'true' && localStorage.getItem('cookieConsent') !== 'true') {
      return Math.random() < 0.5;
    }
    return false;
  });

  // State for PhotoSlideshowModal
  const [showSlideshowModal, setShowSlideshowModal] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);

  // State for VideoPlayerModal
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalContentCount, setTotalContentCount] = useState(0);
  const totalPages = Math.ceil(totalContentCount / CONTENT_PER_PAGE);

  // Ref for video elements to control playback on hover
  const videoRefs = useRef({});

  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  // Helper function to group photos by group_id
  const groupPhotos = useCallback((photos) => {
    const groupedPhotosMap = new Map();
    const singlePhotos = [];

    photos.forEach(photo => {
      if (photo.group_id) {
        if (!groupedPhotosMap.has(photo.group_id)) {
          groupedPhotosMap.set(photo.group_id, []);
        }
        groupedPhotosMap.get(photo.group_id).push(photo);
      } else {
        singlePhotos.push(photo);
      }
    });

    const combinedContent = [];
    groupedPhotosMap.forEach((group, group_id) => {
      // Sort group photos by created_at or some order if needed, taking the first as thumbnail
      const sortedGroup = group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      combinedContent.push({
        id: group_id, // Use group_id as the main ID for the group
        type: 'photo_group',
        photos: sortedGroup,
        url: getPublicUrl(sortedGroup[0].storage_path, 'content'), // Thumbnail is the first photo
        caption: sortedGroup[0].caption, // Use first photo's caption for display
        creator_id: sortedGroup[0].creator_id,
        profiles: sortedGroup[0].profiles, // Ensure profiles are already attached if coming from processed data
      });
    });

    return [...combinedContent, ...singlePhotos.map(p => ({
      ...p,
      type: 'photo',
      url: getPublicUrl(p.storage_path, 'content')
    }))];
  }, [getPublicUrl]);

  // Helper function to fetch profiles for a list of creator IDs
  const fetchProfilesForContent = useCallback(async (creatorIds) => {
    if (creatorIds.length === 0) return {};

    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_path, creator_type')
        .in('id', creatorIds); // Fetch all unique profiles in one go

      if (profilesError) throw profilesError;

      const profilesMap = {};
      profilesData.forEach(profile => {
        profilesMap[profile.id] = profile;
      });
      console.log('Fetched Profiles Map (separate query):', profilesMap); // Debugging
      return profilesMap;
    } catch (err) {
      console.error('Error fetching profiles for content (separate query):', err);
      return {};
    }
  }, []);

  // Fetch free creator content (photos and videos)
  const fetchFreeContent = useCallback(async () => {
    if (showAgeModal) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch photos WITHOUT joining profiles
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('id, storage_path, caption, creator_id, group_id, created_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (photosError) throw photosError;

      // Fetch videos WITHOUT joining profiles
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, storage_path, thumbnail_path, title, creator_id', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      // Collect all unique creator IDs from both photos and videos
      const allCreatorIds = [
        ...new Set([
          ...(photosData || []).map(p => p.creator_id),
          ...(videosData || []).map(v => v.creator_id),
        ].filter(Boolean))
      ];

      // Fetch profiles separately
      const profilesMap = await fetchProfilesForContent(allCreatorIds);

      // Attach profiles and apply client-side filtering for 'normal_creator'
      const processedPhotosWithProfiles = (photosData || [])
        .map(photo => ({
          ...photo,
          profiles: profilesMap[photo.creator_id] || null // Attach profile or null if not found
        }))
        .filter(photo => photo.profiles && photo.profiles.creator_type === 'normal_creator');

      const processedVideosWithProfiles = (videosData || [])
        .map(video => ({
          ...video,
          profiles: profilesMap[video.creator_id] || null // Attach profile or null if not found
        }))
        .filter(video => video.profiles && video.profiles.creator_type === 'normal_creator');

      console.log('Processed Free Photos (with profiles, client-filtered):', processedPhotosWithProfiles);
      console.log('Processed Free Videos (with profiles, client-filtered):', processedVideosWithProfiles);

      // Group photos (now with profiles attached)
      const groupedAndFilteredPhotos = groupPhotos(processedPhotosWithProfiles || []);

      // Combine all content
      const allContent = [
        ...groupedAndFilteredPhotos,
        ...(processedVideosWithProfiles || []).map(v => ({
          ...v,
          type: 'video',
          url: getPublicUrl(v.storage_path, 'content'),
          thumbnailUrl: v.thumbnail_path ? getPublicUrl(v.thumbnail_path, 'content') : (v.storage_path ? getPublicUrl(v.storage_path, 'content') : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER)
        })),
      ];

      const shuffled = allContent.sort(() => Math.random() - 0.5);
      setTotalContentCount(shuffled.length);
      
      const startIndex = (currentPage - 1) * CONTENT_PER_PAGE;
      const endIndex = startIndex + CONTENT_PER_PAGE;
      setContent(shuffled.slice(startIndex, endIndex));

    } catch (err) {
      setError(err.message || 'Failed to fetch content.');
      console.error('Error fetching free content:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, showAgeModal, getPublicUrl, groupPhotos, fetchProfilesForContent]);

  // Fetch premium creator content (photos and videos)
  const fetchPremiumContent = useCallback(async () => {
    // If not subscribed, we don't fetch premium content
    if (!isVisitorSubscribed || showAgeModal) {
      setPremiumContent([]);
      return;
    }

    try {
      // Fetch photos WITHOUT joining profiles
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('id, storage_path, caption, creator_id, group_id, created_at')
        .order('created_at', { ascending: false });

      if (photosError) throw photosError;

      // Fetch videos WITHOUT joining profiles
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, storage_path, thumbnail_path, title, creator_id')
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      // Collect all unique creator IDs from both photos and videos
      const allCreatorIds = [
        ...new Set([
          ...(photosData || []).map(p => p.creator_id),
          ...(videosData || []).map(v => v.creator_id),
        ].filter(Boolean))
      ];

      // Fetch profiles separately
      const profilesMap = await fetchProfilesForContent(allCreatorIds);

      // Attach profiles and apply client-side filtering for 'premium_creator'
      const processedPhotosWithProfiles = (photosData || [])
        .map(photo => ({
          ...photo,
          profiles: profilesMap[photo.creator_id] || null
        }))
        .filter(photo => photo.profiles && photo.profiles.creator_type === 'premium_creator');

      const processedVideosWithProfiles = (videosData || [])
        .map(video => ({
          ...video,
          profiles: profilesMap[video.creator_id] || null
        }))
        .filter(video => video.profiles && video.profiles.creator_type === 'premium_creator');

      console.log('Processed Premium Photos (with profiles, client-filtered):', processedPhotosWithProfiles);
      console.log('Processed Premium Videos (with profiles, client-filtered):', processedVideosWithProfiles);

      // Group photos (now with profiles attached)
      const groupedAndFilteredPhotos = groupPhotos(processedPhotosWithProfiles || []);

      // Combine all premium content
      const allPremiumContent = [
        ...groupedAndFilteredPhotos,
        ...(processedVideosWithProfiles || []).map(v => ({
          ...v,
          type: 'video',
          url: getPublicUrl(v.storage_path, 'content'),
          thumbnailUrl: v.thumbnail_path ? getPublicUrl(v.thumbnail_path, 'content') : (v.storage_path ? getPublicUrl(v.storage_path, 'content') : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER)
        })),
      ];

      const shuffledPremium = allPremiumContent.sort(() => Math.random() - 0.5);
      setPremiumContent(shuffledPremium);

    } catch (err) {
      console.error('Error fetching premium content:', err);
    }
  }, [isVisitorSubscribed, showAgeModal, getPublicUrl, groupPhotos, fetchProfilesForContent]);

  useEffect(() => {
    fetchFreeContent();
    fetchPremiumContent(); // Fetch premium content when subscription status changes
  }, [fetchFreeContent, fetchPremiumContent]);

  // Fetch Advertisements
  useEffect(() => {
    if (showAgeModal) {
      setAdvertisements([]);
      return;
    }

    const fetchAds = async () => {
      try {
        const now = new Date().toISOString();
        const { data, error: fetchError } = await supabase
          .from('advertisements')
          .select('*')
          .eq('is_active', true)
          .lte('start_date', now)
          .gte('end_date', now)
          .order('display_order', { ascending: true });

        if (fetchError) throw fetchError;

        const shuffledAds = data ? data.sort(() => Math.random() - 0.5).slice(0, 2) : [];
        setAdvertisements(shuffledAds.map(ad => ({
          ...ad,
          media_url: getPublicUrl(ad.media_path, AD_MEDIA_BUCKET)
        })));
      } catch (err) {
        console.error('Error fetching advertisements:', err);
      }
    };

    fetchAds();
  }, [showAgeModal, getPublicUrl]);

  const handleAgeVerification = (isOver18) => {
    if (isOver18) {
      localStorage.setItem('ageVerified', 'true');
      setShowAgeModal(false);
      if (localStorage.getItem('cookieConsent') !== 'true') {
        setShowCookieConsent(Math.random() < 0.5);
      }
    } else {
      navigate('https://www.google.com');
    }
  };

  const handleCookieConsent = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShowCookieConsent(false);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo(0, 0);
    }
  };

  // Functions to manage slideshow modal
  const openSlideshow = (item) => {
    // If it's a photo group, pass all photos in the group
    if (item.type === 'photo_group') {
      setCurrentSlideshowPhotos(item.photos.map(p => ({
        id: p.id,
        url: getPublicUrl(p.storage_path, 'content'),
        caption: p.caption,
        creatorNickname: p.profiles?.nickname,
        type: 'photo',
      })));
    } else { // It's a single photo
      setCurrentSlideshowPhotos([
        {
          id: item.id,
          url: item.url,
          caption: item.caption,
          creatorNickname: item.profiles?.nickname,
          type: 'photo',
        }
      ]);
    }
    setCurrentSlideshowIndex(0);
    setShowSlideshowModal(true);
  };

  const closeSlideshow = () => {
    setShowSlideshowModal(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowIndex(0);
  };

  // Functions to manage video player modal
  const openVideoPlayer = (videoItem) => {
    setCurrentVideo({
      id: videoItem.id,
      url: videoItem.url,
      thumbnailUrl: videoItem.thumbnailUrl,
      title: videoItem.title,
      creatorNickname: videoItem.profiles?.nickname,
    });
    setShowVideoModal(true);
  };

  const closeVideoPlayer = () => {
    setShowVideoModal(false);
    setCurrentVideo(null);
  };

  // Handle creator avatar click
  const handleCreatorAvatarClick = (creatorId) => {
    navigate(`/profile/${creatorId}`);
  };

  // Handle video hover for autoplay
  const handleVideoMouseEnter = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.muted = true; // Ensure video is muted for autoplay
      video.play().catch(error => console.error("Video autoplay failed:", error));
    }
  };

  const handleVideoMouseLeave = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.pause();
      video.currentTime = 0; // Reset video to start on mouse leave
    }
  };


  if (showAgeModal) {
    return (
      <div className="homepage-container">
        <div className="modal-overlay">
          <div className="modal-content age-modal">
            <h2>Age Verification</h2>
            <p>You must be 18 or older to access this content.</p>
            <div className="modal-buttons">
              <button className="modal-button decline" onClick={() => handleAgeVerification(false)}>
                I'm Under 18
              </button>
              <button className="modal-button accept" onClick={() => handleAgeVerification(true)}>
                I'm Over 18
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      {showCookieConsent && (
        <div className="cookie-consent-banner">
          <p>We use cookies to enhance your experience. By continuing, you accept our use of cookies.</p>
          <button className="cookie-accept-button" onClick={handleCookieConsent}>
            Accept Cookies
          </button>
        </div>
      )}

      {/* Draftey Logo and Slogan */}
      <div className="draftey-header-section">
        <img src="/draftey-logo.png" alt="Draftey Logo" className="draftey-logo" /> {/* Assumes logo is in the public folder */}
        <h2 className="draftey-slogan">Post your Drafts…</h2>
      </div>

      {/* Advertisement Banners */}
      {advertisements.length > 0 && (
        <div className="ad-banners-section">
          <div className="ad-banners-grid">
            {advertisements.map(ad => (
              <a key={ad.id} href={ad.target_url} target="_blank" rel="noopener noreferrer" className="ad-banner-card">
                {ad.ad_type === 'image' ? (
                  <img src={ad.media_url} alt="Advertisement" />
                ) : (
                  <video src={ad.media_url} controls muted loop />
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Free Content Grid */}
      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading content...</p>
      ) : content.length === 0 ? (
        <p>No free content available at the moment.</p>
      ) : (
        <>
          <h2 className="content-grid-heading">Free Content</h2>
          <div className="free-content-grid">
            {content.map((item) => (
              <div key={`${item.type}-${item.id}`} className="content-card">
                <div
                  className="content-media"
                  onClick={item.type === 'video' ? () => openVideoPlayer(item) : () => openSlideshow(item)}
                  onMouseEnter={item.type === 'video' ? () => handleVideoMouseEnter(item.id) : undefined}
                  onMouseLeave={item.type === 'video' ? () => handleVideoMouseLeave(item.id) : undefined}
                >
                  {item.type === 'photo' || item.type === 'photo_group' ? (
                    <img src={item.url} alt={item.caption || 'Content'} className="content-thumbnail" />
                  ) : (
                    <video
                      ref={el => (videoRefs.current[item.id] = el)}
                      poster={item.thumbnailUrl} // Use the potentially new thumbnailUrl
                      className="content-thumbnail"
                      muted // Muted for autoplay on hover
                      loop
                      controls // Added controls for better user interaction if autoplay fails
                      controlsList="nodownload"
                    >
                      <source src={item.url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  <div className="content-overlay">
                    <span className="content-type">
                      {item.type === 'photo_group' ? '📸📸' : item.type === 'photo' ? '📸' : '🎥'}
                    </span>
                  </div>
                </div>
                
                {/* Creator Avatar Below Content */}
                <div className="content-creator-info">
                  <img
                    src={item.profiles?.avatar_path ? getPublicUrl(item.profiles.avatar_path, 'avatars') : DEFAULT_AVATAR_PLACEHOLDER}
                    alt={item.profiles?.nickname || 'Creator'}
                    className="creator-avatar"
                    onClick={() => handleCreatorAvatarClick(item.profiles?.id)}
                    title={item.profiles?.nickname || 'Creator'}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="pagination-controls">
            <button onClick={handlePrevPage} disabled={currentPage === 1 || loading} className="pagination-button">
              Previous
            </button>
            <span className="pagination-info">Page {currentPage} of {totalPages}</span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages || loading} className="pagination-button">
              Next
            </button>
          </div>
        </>
      )}

      {/* Premium Content Grid (Conditionally rendered) */}
      {isVisitorSubscribed && premiumContent.length > 0 && (
        <>
          <h2 className="content-grid-heading">Premium Content</h2>
          <div className="premium-content-grid free-content-grid"> {/* Reusing free-content-grid styles for now */}
            {premiumContent.map((item) => (
              <div key={`${item.type}-${item.id}`} className="content-card">
                <div
                  className="content-media"
                  onClick={item.type === 'video' ? () => openVideoPlayer(item) : () => openSlideshow(item)}
                  onMouseEnter={item.type === 'video' ? () => handleVideoMouseEnter(item.id) : undefined}
                  onMouseLeave={item.type === 'video' ? () => handleVideoMouseLeave(item.id) : undefined}
                >
                  {item.type === 'photo' || item.type === 'photo_group' ? (
                    <img src={item.url} alt={item.caption || 'Content'} className="content-thumbnail" />
                  ) : (
                    <video
                      ref={el => (videoRefs.current[item.id] = el)}
                      poster={item.thumbnailUrl}
                      className="content-thumbnail"
                      muted
                      loop
                      controls
                      controlsList="nodownload"
                    >
                      <source src={item.url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  <div className="content-overlay">
                    <span className="content-type">
                      {item.type === 'photo_group' ? '📸📸' : item.type === 'photo' ? '📸' : '🎥'}
                    </span>
                  </div>
                </div>
                
                <div className="content-creator-info">
                  <img
                    src={item.profiles?.avatar_path ? getPublicUrl(item.profiles.avatar_path, 'avatars') : DEFAULT_AVATAR_PLACEHOLDER}
                    alt={item.profiles?.nickname || 'Creator'}
                    className="creator-avatar"
                    onClick={() => handleCreatorAvatarClick(item.profiles?.id)}
                    title={item.profiles?.nickname || 'Creator'}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Subscribe Prompt */}
      {!isVisitorSubscribed && (
        <div className="subscribe-prompt bottom-prompt">
          <h3>Unlock Premium Content</h3>
          <p>Subscribe to view exclusive content from premium creators!</p>
          <Link to="/subscribe" className="subscribe-button-homepage">
            Subscribe Now - 20 KES / 24 Hours
          </Link>
        </div>
      )}

      {/* Photo Slideshow Modal */}
      {showSlideshowModal && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          initialIndex={currentSlideshowIndex}
          onClose={closeSlideshow}
        />
      )}

      {/* Video Player Modal */}
      {showVideoModal && (
        <VideoPlayerModal
          video={currentVideo}
          onClose={closeVideoPlayer}
        />
      )}
    </div>
  );
}

export default HomePage;
