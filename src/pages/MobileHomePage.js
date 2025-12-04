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
const SCROLLS_BEFORE_SUBSCRIPTION_PROMPT = 3;
const SESSION_PROMPT_KEY = 'mobileAppPromptShown';

function MobileHomePage() {
  const navigate = useNavigate();
  const { user, isVisitorSubscribed } = useAuth();
  const { theme } = useTheme();

  const [feedContent, setFeedContent] = useState([]);
  const [loading, setLoading] = useState(true); // Set to true initially
  const [error, setError] = useState(null);
  const [hasMoreContent, setHasMoreContent] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [scrollCount, setScrollCount] = useState(0);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleItemIndex, setVisibleItemIndex] = useState(0);
  const [sessionRandomOffset, setSessionRandomOffset] = useState(null); // NEW: State for random offset per session

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
    // console.log('--- Attempting to log view (Mobile) ---'); // Suppressed for less console clutter
    // console.log('Content ID:', contentId);
    // console.log('Creator ID (for view logging):', creatorId);
    // console.log('Content Type (for view logging):', contentType);
    // console.log('Is Premium Content:', isPremiumContent);

    try {
      const { data: { user: logUser } } = await supabase.auth.getUser();
      const viewerEmailToLog = logUser?.email || localStorage.getItem('subscriberEmail') || null;

      // console.log('Viewer Email (to log):', viewerEmailToLog); // Suppressed

      if (isPremiumContent && viewerEmailToLog && isVisitorSubscribed) {
        // console.log(`Checking for existing view for premium content ${contentId} by ${viewerEmailToLog}`); // Suppressed
        const { data: existingViews, error: checkError } = await supabase
          .from('views')
          .select('id')
          .eq('content_id', contentId)
          .eq('viewer_email', viewerEmailToLog)
          .limit(1);

        if (checkError) {
          console.error('Error checking for existing view (Mobile):', checkError);
        } else if (existingViews && existingViews.length > 0) {
          // console.log(`Duplicate view prevented for premium content ${contentId} by ${viewerEmailToLog}`); // Suppressed
          return;
        }
      }
      
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
        // console.log('View successfully logged for contentId (Mobile):', contentId); // Suppressed
      }
    } catch (err) {
      console.error('Error in logView function (Mobile):', err);
    }
    // console.log('--- End log view attempt (Mobile) ---'); // Suppressed
  }, [isVisitorSubscribed]);


  const fetchContent = useCallback(async () => {
    console.log('--- fetchContent called ---');
    console.log('Current user in AuthContext:', user);
    console.log('isFetching.current:', isFetching.current);
    console.log('hasMoreContent:', hasMoreContent);
    console.log('sessionRandomOffset:', sessionRandomOffset); // NEW: Log current random offset

    if (user === undefined || isFetching.current || !hasMoreContent || sessionRandomOffset === null) {
      console.log('fetchContent blocked by guard conditions or sessionRandomOffset is null.');
      if (user === undefined) {
        console.log('Reason: user is undefined (AuthContext still loading)');
      }
      if (sessionRandomOffset === null) {
        console.log('Reason: sessionRandomOffset is null, waiting for initial calculation.');
      }
      return;
    }
    
    isFetching.current = true;
    setLoading(true);
    setError(null);

    try {
      const creatorTypesToFetch = isVisitorSubscribed ? ['premium_creator', 'creator'] : ['creator'];
      
      // NEW: Calculate dynamic offset based on sessionRandomOffset
      let currentOffset;
      if (currentPage === 0) {
        currentOffset = sessionRandomOffset;
      } else {
        // For subsequent pages, add to the initial random offset
        currentOffset = sessionRandomOffset + (currentPage * CONTENT_FETCH_LIMIT);
      }

      const from = currentOffset;
      const to = from + CONTENT_FETCH_LIMIT - 1;

      console.log(`Fetching content for user types: ${creatorTypesToFetch.join(', ')} from ${from} to ${to} (Effective offset: ${currentOffset})`);
      console.log('Attempting Supabase content select...');
      
      const { data: contentData, error: contentError, count } = await supabase
        .from('content')
        .select(`
          *, 
          profiles!inner(id, nickname, avatar_path, user_type),
          views_count:views(count)
        `, { count: 'exact' }) // Fetch exact count for better random offset calculation
        .in('profiles.user_type', creatorTypesToFetch)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      console.log('Supabase content fetch result:', { data: contentData, error: contentError, count });

      if (contentError) throw contentError;

      // Update hasMoreContent based on actual data returned vs limit
      if (contentData.length < CONTENT_FETCH_LIMIT || (count !== null && (currentOffset + contentData.length) >= count)) {
        setHasMoreContent(false);
        console.log('No more content to fetch or reached total count.');
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
          isPremiumContent: item.profiles.user_type === 'premium_creator',
        }));

        const now = new Date().toISOString();
        console.log('Attempting Supabase ads select...');
        const { data: adsData, error: adsError } = await supabase
          .from('ad_campaigns')
          .select('*')
          .eq('status', 'active')
          .lte('start_date', now)
          .gte('end_date', now)
          .order('created_at', { ascending: false })
          .limit(10);

        console.log('Supabase ads fetch result:', { data: adsData, error: adsError });
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
      } else {
        console.log('Supabase returned no content data for the current query. Setting hasMoreContent to false.');
        setHasMoreContent(false); // No content, so no more to fetch
      }
    } catch (err) {
      console.error('Error fetching mobile content in catch block (full error):', err);
      setError(err.message || 'Failed to load content. Please check your network connection.');
    } finally {
      setLoading(false);
      isFetching.current = false;
      console.log('--- fetchContent finished ---');
    }
  }, [currentPage, hasMoreContent, isVisitorSubscribed, getPublicUrl, user, sessionRandomOffset]); // NEW: Add sessionRandomOffset to dependencies


  // Effect to ensure user is loaded before fetching content AND calculate initial random offset
  useEffect(() => {
    if (user !== undefined && sessionRandomOffset === null) {
      console.log('User state resolved and sessionRandomOffset is null. Calculating initial random offset.');
      const calculateInitialOffset = async () => {
        // Fetch total count to determine a valid random offset range
        const { count, error: countError } = await supabase
          .from('content')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);

        if (countError) {
          console.error('Error fetching total content count for random offset:', countError);
          setSessionRandomOffset(0); // Fallback to 0 if count fails
          return;
        }

        if (count && count > 0) {
          const maxOffset = Math.max(0, count - CONTENT_FETCH_LIMIT);
          const randomOffset = Math.floor(Math.random() * (maxOffset + 1));
          setSessionRandomOffset(randomOffset);
          console.log('Calculated sessionRandomOffset:', randomOffset, 'Total content count:', count);
        } else {
          setSessionRandomOffset(0); // No content, start at 0
          setHasMoreContent(false);
          console.log('No content available for random offset calculation. Setting offset to 0.');
        }
      };
      calculateInitialOffset();
    } else if (user !== undefined && sessionRandomOffset !== null) {
      // User state resolved and initial offset is set, proceed to fetch content
      console.log('User state resolved and sessionRandomOffset is set. Triggering fetchContent.');
      fetchContent();
    }
  }, [user, sessionRandomOffset, fetchContent]); // Added sessionRandomOffset to dependencies


  // Reset feed when subscription status changes or when random offset needs recalculation
  useEffect(() => {
    console.log('Subscription status changed or component mounted. Resetting feed and sessionRandomOffset.');
    setFeedContent([]);
    setCurrentPage(0);
    setHasMoreContent(true);
    isFetching.current = false;
    hasPromptBeenShownThisSession.current = sessionStorage.getItem(SESSION_PROMPT_KEY) === 'true';
    setSessionRandomOffset(null); // NEW: Reset random offset to trigger recalculation
  }, [isVisitorSubscribed]); // Only trigger when subscription status changes


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

            // Trigger fetchContent here for infinite scroll when nearing end of feed
            if (index === feedContent.length - 1 && !loading && hasMoreContent) {
              console.log('Nearing end of feed, incrementing scrollCount and fetching more content.');
              setScrollCount(prev => prev + 1);
              fetchContent(); 
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
  }, [feedContent, loading, hasMoreContent, fetchContent]); // Added fetchContent to dependencies

  // Subscription prompt logic
  useEffect(() => {
    console.log(`Checking subscription prompt logic: isVisitorSubscribed=${isVisitorSubscribed}, scrollCount=${scrollCount}, hasPromptBeenShownThisSession=${hasPromptBeenShownThisSession.current}`);
    if (!isVisitorSubscribed && scrollCount >= SCROLLS_BEFORE_SUBSCRIPTION_PROMPT && !hasPromptBeenShownThisSession.current) {
      console.log('Showing subscription prompt.');
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
              // Ensure scroll-snap-item has a defined height for IntersectionObserver to work reliably
              <div ref={(el) => (itemRefs.current[index] = el)} key={`${item.type}-${item.id}-${index}`} data-index={index} className="scroll-snap-item" style={{ height: '100vh' }}>
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
