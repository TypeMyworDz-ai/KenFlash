import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreatorProfileCard from '../components/CreatorProfileCard';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal'; // Import VideoPlayerModal
import { supabase } from '../supabaseClient';
import './HomePage.css';

const AD_MEDIA_BUCKET = 'ad-media';

function HomePage() {
  const { isVisitorSubscribed } = useAuth();
  const navigate = useNavigate();

  const [creators, setCreators] = useState([]);
  const [previewContent, setPreviewContent] = useState([]);
  const [advertisements, setAdvertisements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const profilesPerPage = 6;
  const [totalCreatorCount, setTotalCreatorCount] = useState(0);
  const totalPages = Math.ceil(totalCreatorCount / profilesPerPage);

  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  // Memoized fetchCreators function
  const fetchCreators = useCallback(async () => {
    if (showAgeModal) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('is_approved', true)
        .neq('official_name', 'Admin');

      if (searchTerm) {
        query = query.ilike('nickname', `%${searchTerm}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * profilesPerPage, currentPage * profilesPerPage - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      setCreators(data || []);
      setTotalCreatorCount(count || 0);

    } catch (err) {
      setError(err.message || 'Failed to fetch creators.');
      console.error('Error fetching creators:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, showAgeModal, searchTerm]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // Fetch Preview Content (3 photos, 2 videos)
  useEffect(() => {
    if (showAgeModal) {
      return;
    }

    const fetchPreviewContent = async () => {
      try {
        // Fetch 3 photos
        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('id, storage_path, caption, creator_id, profiles(nickname)')
          .order('created_at', { ascending: false })
          .limit(3);

        if (photosError) throw photosError;

        // Fetch 2 videos
        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('id, storage_path, thumbnail_path, title, creator_id, profiles(nickname)')
          .order('created_at', { ascending: false })
          .limit(2);

        if (videosError) throw videosError;

        const allContent = [
          ...(photosData || []).map(p => ({
            ...p,
            type: 'photo',
            url: getPublicUrl(p.storage_path, 'content')
          })),
          ...(videosData || []).map(v => ({
            ...v,
            type: 'video',
            url: getPublicUrl(v.storage_path, 'content'),
            thumbnailUrl: getPublicUrl(v.thumbnail_path || v.storage_path, 'content')
          })),
        ];

        const shuffled = allContent.sort(() => Math.random() - 0.5);
        setPreviewContent(shuffled);

      } catch (err) {
        console.error('Error fetching preview content:', err);
      }
    };

    fetchPreviewContent();
  }, [showAgeModal, getPublicUrl]);

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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
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

  // Functions to manage slideshow modal
  const openSlideshow = (photoItem) => {
    setCurrentSlideshowPhotos([
      {
        id: photoItem.id,
        url: photoItem.url,
        caption: photoItem.caption,
        creatorNickname: photoItem.profiles?.nickname,
        type: 'photo',
      }
    ]);
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

      {/* Main Heading */}
      <div className="main-heading-section">
        <h2>Watch amazing content!</h2>
      </div>

      {/* Search Input */}
      <div className="search-bar-container">
        <input
          type="text"
          placeholder="Search Creators"
          value={searchTerm}
          onChange={handleSearchChange}
          className="creator-search-input"
        />
      </div>

      {/* Advertisement Banners */}
      {advertisements.length > 0 && (
        <div className="ad-banners-section">
          {/* Removed <h3>Featured Advertisements</h3> */}
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

      {/* Preview Content for Free Users (always visible after age verification) */}
      {previewContent.length > 0 && (
        <div className="preview-content-section">
          <h3>Amazing content waiting for you!</h3>
          <div className="preview-grid">
            {previewContent.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="preview-card"
                onClick={item.type === 'photo' ? () => openSlideshow(item) : () => openVideoPlayer(item)} // Handle click for both photo and video
              >
                {item.type === 'photo' ? (
                  <img src={item.url} alt={item.caption || 'Preview'} className="preview-thumbnail" />
                ) : (
                  <video
                    poster={item.thumbnailUrl}
                    className="preview-thumbnail"
                    muted
                    autoPlay
                    loop
                    controlsList="nodownload"
                  >
                    <source src={item.url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
                <div className="preview-overlay">
                  <span className="preview-type">{item.type === 'photo' ? '📸' : '🎥'}</span>
                </div>
                <p className="preview-creator">{item.profiles?.nickname || 'Creator'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading creators...</p>
      ) : creators.length === 0 && !searchTerm ? (
        <p>No approved creators available yet.</p>
      ) : creators.length === 0 && searchTerm ? (
        <p>No creators found matching "{searchTerm}".</p>
      ) : (
        <>
          <div className="creator-profiles-grid">
            {creators.map((creator) => (
              <CreatorProfileCard key={creator.id} creator={creator} />
            ))}
          </div>

          <div className="pagination-controls">
            <button onClick={handlePrevPage} disabled={currentPage === 1 || loading} className="pagination-button">
              Previous Page
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages || loading} className="pagination-button">
              Next Page
            </button>
          </div>
        </>
      )}

      {!isVisitorSubscribed && (
        <div className="subscribe-prompt bottom-prompt">
          <h3>Unlock All Content</h3>
          <p>Subscribe to view full profiles and access exclusive photos and videos!</p>
          <Link to="/subscribe" className="subscribe-button-homepage">Subscribe Now!</Link>
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
