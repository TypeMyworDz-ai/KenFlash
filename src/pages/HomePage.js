import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { supabase } from '../supabaseClient';
import './HomePage.css';

const AD_MEDIA_BUCKET = 'ad-media';
const CONTENT_PER_PAGE = 30;
const DEFAULT_AVATAR_PLACEHOLDER = 'https://via.placeholder.com/40';
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';

function HomePage() {
  const { isVisitorSubscribed, subscribeVisitor } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [content, setContent] = useState([]);
  const [advertisements, setAdvertisements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // New state for payment status
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const callbackProcessedRef = useRef(false);

  const [showAgeModal, setShowAgeModal] = useState(() => {
    return localStorage.getItem('ageVerified') !== 'true';
  });

  const [showCookieConsent, setShowCookieConsent] = useState(() => {
    if (localStorage.getItem('ageVerified') === 'true' && localStorage.getItem('cookieConsent') !== 'true') {
      return Math.random() < 0.5;
    }
    return false;
  });

  const [showSlideshowModal, setShowSlideshowModal] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);
  const [slideshowContext, setSlideshowContext] = useState({ creatorId: null, isPremiumContent: false, contentType: 'photo' });

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalContentCount, setTotalContentCount] = useState(0);
  const totalPages = Math.ceil(totalContentCount / CONTENT_PER_PAGE);

  const videoRefs = useRef({});

  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

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
      const sortedGroup = group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      combinedContent.push({
        id: group_id,
        type: 'photo_group',
        photos: sortedGroup,
        url: getPublicUrl(sortedGroup[0].storage_path, 'content'),
        caption: sortedGroup[0].caption,
        creator_id: sortedGroup[0].creator_id,
        profiles: sortedGroup[0].profiles,
        views: sortedGroup[0].views || 0,
        content_type: 'photo',
      });
    });

    return [...combinedContent, ...singlePhotos.map(p => ({
      ...p,
      type: 'photo',
      url: getPublicUrl(p.storage_path, 'content')
    }))];
  }, [getPublicUrl]);

  const logView = useCallback(async (contentId, creatorId, contentType, isPremiumContent) => {
    console.log('--- Attempting to log view ---');
    console.log('Content ID:', contentId);
    console.log('Creator ID (for view logging):', creatorId);
    console.log('Content Type (for view logging):', contentType);
    console.log('Is Premium Content:', isPremiumContent);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const viewerEmailToLog = user?.email || localStorage.getItem('subscriberEmail') || null;

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
          console.error('Error checking for existing view:', checkError);
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
        console.error('Supabase INSERT Error:', insertError);
      } else {
        console.log('View successfully logged for contentId:', contentId);
      }
    } catch (err) {
      console.error('Error in logView function:', err);
    }
    console.log('--- End log view attempt ---');
  }, [isVisitorSubscribed]);

  const fetchContent = useCallback(async () => {
    if (showAgeModal) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const creatorTypesToFetch = isVisitorSubscribed ? ['premium_creator', 'creator'] : ['creator'];

      const { data: contentData, error: contentError } = await supabase
        .from('content')
        .select('id, storage_path, thumbnail_path, title, caption, creator_id, group_id, created_at, content_type, is_active, profiles(id, nickname, avatar_path, user_type), views_count:views(count)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (contentError) throw contentError;

      const contentWithProfilesAndViews = (contentData || [])
        .map(item => ({
          ...item,
          views: item.views_count ? item.views_count[0].count : 0,
        }))
        .filter(item => item.profiles && creatorTypesToFetch.includes(item.profiles.user_type));

      const photos = contentWithProfilesAndViews.filter(item => item.content_type === 'photo');
      const videos = contentWithProfilesAndViews.filter(item => item.content_type === 'video');

      const groupedAndFilteredPhotos = groupPhotos(photos);

      const allContent = [
        ...groupedAndFilteredPhotos,
        ...videos.map(v => ({
          ...v,
          type: 'video',
          url: getPublicUrl(v.storage_path, 'content'),
          thumbnailUrl: v.thumbnail_path ? getPublicUrl(v.thumbnail_path, 'content') : (v.storage_path ? getPublicUrl(v.storage_path, 'content') : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER),
        })),
      ];

      const shuffled = allContent.sort(() => Math.random() - 0.5);
      setTotalContentCount(shuffled.length);
      const startIndex = (currentPage - 1) * CONTENT_PER_PAGE;
      const endIndex = startIndex + CONTENT_PER_PAGE;
      setContent(shuffled.slice(startIndex, endIndex));
    } catch (err) {
      setError(err.message || 'Failed to fetch content.');
      console.error('Error fetching content:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, showAgeModal, isVisitorSubscribed, getPublicUrl, groupPhotos]);

  // NEW: Handle Paystack callback - WITH ENHANCED DEBUGGING AND FIXED DEPENDENCIES
  useEffect(() => {
    const handlePaystackCallback = async () => {
      const status = searchParams.get('status');
      const subscriptionEmail = localStorage.getItem('pendingSubscriptionEmail');
      const planName = localStorage.getItem('pendingPlanName');
      
      console.log('=== PAYSTACK CALLBACK DEBUG ===');
      console.log('URL status parameter:', status);
      console.log('localStorage pendingSubscriptionEmail:', subscriptionEmail);
      console.log('localStorage pendingPlanName:', planName);
      console.log('callbackProcessedRef.current:', callbackProcessedRef.current);
      console.log('Full URL:', window.location.href);
      console.log('================================');
      
      if (status === 'success' && subscriptionEmail && planName && !callbackProcessedRef.current) {
        callbackProcessedRef.current = true;
        console.log('HomePage: Detected Paystack callback with status=success');
        setPaymentStatus('verifying');
        setPaymentMessage('Verifying your payment and activating subscription...');
        
        try {
          const now = new Date();
          let expiryTime;
          
          if (planName === '1 Day Plan') {
            expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          } else if (planName === '2 Hour Plan') {
            expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
          } else {
            throw new Error('Unknown plan name stored in localStorage.');
          }
          
          const transactionRef = `PAYSTACK_${subscriptionEmail.split('@')[0]}_${Date.now()}`;
          
          const subscriptionData = {
            email: subscriptionEmail,
            plan: planName,
            expiry_time: expiryTime.toISOString(),
            transaction_ref: transactionRef,
            status: 'active',
          };
          
          console.log('HomePage: Attempting to insert subscription data:', subscriptionData);
          
          const { data, error: insertError } = await supabase
            .from('subscriptions')
            .insert([subscriptionData])
            .select();
            
          if (insertError) {
            console.error('HomePage: Supabase subscription INSERT ERROR:', insertError);
            throw insertError;
          }
          
          if (data && data.length > 0) {
            console.log('HomePage: Subscription successfully activated:', data);
            setPaymentStatus('success');
            setPaymentMessage('Subscription activated successfully! Content unlocked.');
            subscribeVisitor(subscriptionEmail, planName);
            
            fetchContent();
          } else {
            throw new Error('No data returned from subscription insert.');
          }
        } catch (err) {
          console.error('HomePage: Subscription activation failed:', err);
          setPaymentStatus('failed');
          setPaymentMessage(`Failed to activate subscription: ${err.message}. Please contact support.`);
        } finally {
          localStorage.removeItem('pendingSubscriptionEmail');
          localStorage.removeItem('pendingPlanName');
          
          setTimeout(() => {
            navigate('/', { replace: true });
            if (paymentStatus !== 'failed') {
              setPaymentStatus(null);
            }
          }, 4000);
        }
      } else {
        console.log('Callback conditions not met. Missing:', {
          hasStatus: !!status,
          hasEmail: !!subscriptionEmail,
          hasPlan: !!planName,
          notProcessed: !callbackProcessedRef.current
        });
      }
    };
    
    handlePaystackCallback();
  }, [searchParams, subscribeVisitor, navigate, fetchContent, paymentStatus]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    if (showAgeModal) {
      setAdvertisements([]);
      return;
    }
    const fetchAds = async () => {
      try {
        const now = new Date().toISOString();
        const { data, error: fetchError } = await supabase
          .from('ad_campaigns')
          .select('*')
          .eq('status', 'active')
          .lte('start_date', now)
          .gte('end_date', now)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const shuffledAds = data ? data.sort(() => Math.random() - 0.5).slice(0, 2) : [];
        setAdvertisements(shuffledAds.map(ad => ({
          ...ad,
          media_url: getPublicUrl(ad.media_path, AD_MEDIA_BUCKET),
          ad_type: ad.media_type,
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
      window.location.href = 'https://www.google.com';
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

  const openSlideshow = (item) => {
    const isPremium = item.profiles?.user_type === 'premium_creator';
    
    logView(item.id, item.creator_id, item.type === 'photo_group' ? 'photo' : item.type, isPremium);

    const photosForSlideshow = item.type === 'photo_group'
      ? item.photos.map(p => ({
          id: p.id,
          url: getPublicUrl(p.storage_path, 'content'),
          caption: p.caption,
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
    setSlideshowContext({ creatorId: null, isPremiumContent: false, contentType: 'photo' });
  };

  const openVideoPlayer = (videoItem) => {
    const isPremium = videoItem.profiles?.user_type === 'premium_creator';
    logView(videoItem.id, videoItem.creator_id, videoItem.content_type, isPremium);
    
    setCurrentVideo({
      id: videoItem.id,
      url: videoItem.url,
      thumbnailUrl: videoItem.thumbnailUrl,
      title: videoItem.title,
      creatorNickname: videoItem.profiles?.nickname,
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

  const handleCreatorAvatarClick = (creatorId) => {
    window.open(`/profile/${creatorId}`, '_blank');
  };

  const handleVideoMouseEnter = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.muted = true;
      video.play().catch(error => console.error("Video autoplay failed:", error));
    }
  };

  const handleVideoMouseLeave = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.pause();
      video.currentTime = 0;
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
              <button className="modal-button decline" onClick={() => handleAgeVerification(false)}>I'm Under 18</button>
              <button className="modal-button accept" onClick={() => handleAgeVerification(true)}>I'm Over 18</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      {paymentStatus && (
        <div className="modal-overlay">
          <div className="modal-content payment-status-modal">
            <h2>{paymentStatus === 'verifying' ? 'Verifying Payment...' : paymentStatus === 'success' ? 'Success!' : 'Payment Failed'}</h2>
            <p>{paymentMessage}</p>
            {paymentStatus === 'failed' && <button onClick={() => setPaymentStatus(null)}>Close</button>}
          </div>
        </div>
      )}
      
      {showCookieConsent && (
        <div className="cookie-consent-banner">
          <p>We use cookies to enhance your experience. By continuing, you accept our use of cookies.</p>
          <button className="cookie-accept-button" onClick={handleCookieConsent}>Accept Cookies</button>
        </div>
      )}

      <div className="draftey-header-section">
        <img src="/draftey-logo.png" alt="Draftey Logo" className="draftey-logo" />
        <h2 className="draftey-slogan">Post your Drafts…</h2>
      </div>

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

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading content...</p>
      ) : content.length === 0 ? (
        <p>No content available at the moment.</p>
      ) : (
        <>
          <div className="content-grid">
            {content.map((item) => (
              <div key={`$aspect_ratio_1-${item.id}`} className="content-card">
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
                  <div className="watermark-overlay"></div>
                </div>

                <div className="content-creator-info">
                  <div className="creator-left-section">
                    <img
                      src={item.profiles?.avatar_path ? getPublicUrl(item.profiles.avatar_path, 'avatars') : DEFAULT_AVATAR_PLACEHOLDER}
                      alt={item.profiles?.nickname || 'Creator'}
                      className="creator-avatar"
                      onClick={() => handleCreatorAvatarClick(item.profiles?.id)}
                      title={item.profiles?.nickname || 'Creator'}
                    />
                    <div className="creator-name-info">
                      <p>{item.profiles?.nickname || 'Unknown Creator'}</p>
                    </div>
                  </div>
                  <div className="view-count">
                    {item.views || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination-controls">
            <button onClick={handlePrevPage} disabled={currentPage === 1 || loading} className="pagination-button">Previous</button>
            <span className="pagination-info">Page {currentPage} of {totalPages}</span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages || loading} className="pagination-button">Next</button>
          </div>
        </>
      )}

      {!isVisitorSubscribed && (
        <div className="subscribe-prompt bottom-prompt">
          <h3>Unlock Premium Content</h3>
          <p>Subscribe to view exclusive content from premium creators!</p>
          <Link to="/subscribe" className="subscribe-button-homepage">
            Subscribe Now - 20 KES / 2 Hours
          </Link>
        </div>
      )}

      {showSlideshowModal && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          caption={slideshowContext.contentType === 'photo' ? currentSlideshowPhotos[currentSlideshowIndex]?.caption : ''}
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

export default HomePage;
