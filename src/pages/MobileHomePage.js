import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../supabaseClient';
import MobileContentCard from '../components/MobileContentCard';
import MobileAdCard from '../components/MobileAdCard';
import SubscriptionPromptModal from '../components/SubscriptionPromptModal';
import './MobileHomePage.css';

const AD_MEDIA_BUCKET = 'ad-media';
const AVATAR_BUCKET = 'avatars';
const CONTENT_FETCH_LIMIT = 5;
// eslint-disable-next-line no-unused-vars
const AD_INSERT_FREQUENCY = 3;
const SCROLLS_BEFORE_SUBSCRIPTION_PROMPT = 3; // This is used, so the warning is a false positive
const SESSION_PROMPT_KEY = 'mobileAppPromptShown';

function MobileHomePage() {
  const navigate = useNavigate();
  const { user, isVisitorSubscribed } = useAuth();
  const { theme } = useTheme();

  const [feedContent, setFeedContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMoreContent, setHasMoreContent] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [scrollCount, setScrollCount] = useState(0);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleItemIndex, setVisibleItemIndex] = useState(0);

  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const isFetching = useRef(false);
  const hasPromptBeenShownThisSession = useRef(sessionStorage.getItem(SESSION_PROMPT_KEY) === 'true');


  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const logView = useCallback(async (contentId, creatorId, contentType, isPremiumContent) => {
    console.log('--- Attempting to log view (Mobile) ---');
    console.log('Content ID:', contentId);
    console.log('Creator ID (for view logging):', creatorId);
    console.log('Content Type (for view logging):', contentType);
    console.log('Is Premium Content:', isPremiumContent);

    try {
      const { data: { user: logUser } } = await supabase.auth.getUser();
      
      const viewerEmailToLog = logUser?.email || localStorage.getItem('subscriberEmail') || null;

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
          console.error('Error checking for existing view (Mobile):', checkError);
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
        console.error('Supabase INSERT Error (Mobile):', insertError);
      } else {
        console.log('View successfully logged for contentId (Mobile):', contentId);
      }
    } catch (err) {
      console.error('Error in logView function (Mobile):', err);
    }
    console.log('--- End log view attempt (Mobile) ---');
  }, [isVisitorSubscribed]);


  const fetchContent = useCallback(async () => {
    // CORRECTED: The guard should check for 'undefined', not '!user'
    if (user === undefined || isFetching.current || !hasMoreContent) return;
    
    isFetching.current = true;
    setLoading(true);
    setError(null);

    try {
      const creatorTypesToFetch = isVisitorSubscribed ? ['premium_creator', 'creator'] : ['creator'];
      const from = currentPage * CONTENT_FETCH_LIMIT;
      const to = from + CONTENT_FETCH_LIMIT - 1;

      const { data: contentData, error: contentError } = await supabase
        .from('content')
        .select(`
          *, 
          profiles!inner(id, nickname, avatar_path, user_type),
          views_count:views(count)
        `) // Changed creator_type to user_type
        .in('profiles.user_type', creatorTypesToFetch) // Changed creator_type to user_type
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (contentError) throw contentError;

      if (contentData.length < CONTENT_FETCH_LIMIT) {
        setHasMoreContent(false);
      }
      
      if (contentData.length > 0) {
        const processedContent = contentData.map(item => ({
          ...item,
          type: item.content_type,
          url: getPublicUrl(item.storage_path, 'content'),
          thumbnailUrl: getPublicUrl(item.thumbnail_path || item.storage_path, 'content'),
          creatorInfo: {
            id: item.profiles.id,
            nickname: item.profiles.nickname || 'Creator',
            avatar_url: getPublicUrl(item.profiles.avatar_path, AVATAR_BUCKET) || null
          },
          views: item.views_count ? item.views_count[0].count : 0,
          isPremiumContent: item.profiles.user_type === 'premium_creator', // Changed creator_type to user_type
        }));

        const now = new Date().toISOString();
        const { data: adsData, error: adsError } = await supabase
          .from('ad_campaigns')
          .select('*')
          .eq('status', 'active')
          .lte('start_date', now)
          .gte('end_date', now)
          .order('created_at', { ascending: false })
          .limit(10);

        if (adsError) console.error('Error fetching ads:', adsError);
        
        let newFeedItems = [];
        let adIndex = 0;
        for (let i = 0; i < processedContent.length; i++) {
          newFeedItems.push(processedContent[i]);
          if (adsData?.length > 0 && (i + 1) % AD_INSERT_FREQUENCY === 0) {
            const randomAd = adsData[adIndex % adsData.length];
            newFeedItems.push({ 
              ...randomAd, 
              type: 'ad', 
              media_url: getPublicUrl(randomAd.media_path, AD_MEDIA_BUCKET),
              ad_type: randomAd.media_type,
            });
            adIndex++;
          }
        }
        
        setFeedContent(prev => [...prev, ...newFeedItems]);
        setCurrentPage(prev => prev + 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load content.');
      console.error('Error fetching mobile content:','err', err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [currentPage, hasMoreContent, isVisitorSubscribed, getPublicUrl, user]);


  // Effect to ensure user is loaded before fetching content
  useEffect(() => {
    if (user === undefined) return;
    fetchContent();
  }, [user, fetchContent]);


  // Reset feed when subscription status changes
  useEffect(() => {
    setFeedContent([]);
    setCurrentPage(0);
    setHasMoreContent(true);
    isFetching.current = false;
    hasPromptBeenShownThisSession.current = sessionStorage.getItem(SESSION_PROMPT_KEY) === 'true';
  }, [isVisitorSubscribed]);

  // Intersection Observer for video playback and infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentItemRefs = itemRefs.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.dataset.index, 10);
            setVisibleItemIndex(index);

            if (index === feedContent.length - 1 && !loading && hasMoreContent) {
              setScrollCount(prev => prev + 1);
            }
          }
        });
      },
      { root: container, rootMargin: '0px', threshold: 0.75 }
    );

    currentItemRefs.forEach(ref => { if (ref) observer.observe(ref); });

    return () => {
      currentItemRefs.forEach(ref => { if (ref) observer.unobserve(ref); });
      observer.disconnect();
    };
  }, [feedContent, loading, hasMoreContent]);

  // Subscription prompt logic
  useEffect(() => {
    if (!isVisitorSubscribed && scrollCount >= SCROLLS_BEFORE_SUBSCRIPTION_PROMPT && !hasPromptBeenShownThisSession.current) {
      setShowSubscriptionPrompt(true);
      hasPromptBeenShownThisSession.current = true;
      sessionStorage.setItem(SESSION_PROMPT_KEY, 'true');
    }
  }, [isVisitorSubscribed, scrollCount]);

  const closeSubscriptionPrompt = () => setShowSubscriptionPrompt(false);
  const handleSubscribeClick = () => {
    navigate('/subscribe');
    closeSubscriptionPrompt();
  };
  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  return (
    <div className={`mobile-homepage-container ${theme}`} ref={containerRef}>
      <div className="mobile-search-bar-container">
        <input
          type="text"
          placeholder="Search Creators"
          value={searchTerm}
          onChange={handleSearchChange}
          className="mobile-creator-search-input"
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading && feedContent.length === 0 ? (
        <p className="loading-message">Loading content...</p>
      ) : feedContent.length === 0 && !error ? (
        <p className="no-content-message">No content available. Check back later!</p>
      ) : (
        <div className="content-feed">
          {feedContent.map((item, index) => {
            const isActive = index === visibleItemIndex;
            return (
              <div ref={(el) => (itemRefs.current[index] = el)} key={`${item.type}-${item.id}-${index}`} data-index={index} className="scroll-snap-item">
                {item.type === 'ad' ? (
                  <MobileAdCard ad={item} isActive={isActive} />
                ) : (
                  <MobileContentCard
                    item={item}
                    isActive={isActive}
                    isVisitorSubscribed={isVisitorSubscribed}
                    setShowSubscriptionPrompt={setShowSubscriptionPrompt}
                    onNavigateToCreatorProfile={(creatorId) => navigate(`/profile/${creatorId}`)}
                    logView={logView}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading && feedContent.length > 0 && <p className="loading-message">Loading more content...</p>}
      {!hasMoreContent && !loading && feedContent.length > 0 && <p className="end-of-feed-message">You've reached the end.</p>}

      {showSubscriptionPrompt && !isVisitorSubscribed && (
        <SubscriptionPromptModal
          onClose={closeSubscriptionPrompt}
          onSubscribe={handleSubscribeClick}
        />
      )}
    </div>
  );
}

export default MobileHomePage;
