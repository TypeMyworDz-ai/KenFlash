import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
const AD_INSERT_FREQUENCY = 3;
const SCROLLS_BEFORE_SUBSCRIPTION_PROMPT = 3;
const SESSION_PROMPT_KEY = 'mobileAppPromptShown';

function MobileHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isVisitorSubscribed, subscribeVisitor } = useAuth();
  const { theme } = useTheme();

  const [feedContent, setFeedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMoreContent, setHasMoreContent] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [scrollCount, setScrollCount] = useState(0);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleItemIndex, setVisibleItemIndex] = useState(0);
  const [sessionRandomOffset, setSessionRandomOffset] = useState(null);

  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const isFetching = useRef(false);
  const hasPromptBeenShownThisSession = useRef(sessionStorage.getItem(SESSION_PROMPT_KEY) === 'true');

  // Handle Paystack callback on mount (Android)
  useEffect(() => {
    const handlePaystackCallback = async () => {
      const reference = searchParams.get('reference');
      const subscriptionEmail = localStorage.getItem('pendingSubscriptionEmail');
      const planName = localStorage.getItem('pendingPlanName');

      if (reference && subscriptionEmail && planName && !paymentStatus) {
        console.log('MobileHomePage: Detected Paystack callback with reference:', reference);
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

          const subscriptionData = {
            email: subscriptionEmail,
            plan: planName,
            expiry_time: expiryTime.toISOString(),
            transaction_ref: reference,
            status: 'active',
          };

          const { data, error: insertError } = await supabase
            .from('subscriptions')
            .insert([subscriptionData])
            .select();

          if (insertError) throw insertError;

          if (data && data.length > 0) {
            setPaymentStatus('success');
            setPaymentMessage('Subscription activated successfully! Content unlocked.');
            subscribeVisitor(subscriptionEmail, planName);
          } else {
            throw new Error('No data returned from subscription insert');
          }
        } catch (err) {
          console.error('MobileHomePage: Subscription activation failed:', err);
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
      }
    };

    handlePaystackCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, subscribeVisitor, navigate]);

  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const logView = useCallback(async (contentId, creatorId, contentType, isPremiumContent) => {
    try {
      const { data: { user: logUser } } = await supabase.auth.getUser();
      const viewerEmailToLog = logUser?.email || localStorage.getItem('subscriberEmail') || null;

      if (isPremiumContent && viewerEmailToLog && isVisitorSubscribed) {
        const { data: existingViews, error: checkError } = await supabase
          .from('views')
          .select('id')
          .eq('content_id', contentId)
          .eq('viewer_email', viewerEmailToLog)
          .limit(1);

        if (checkError) {
          console.error('Error checking for existing view (Mobile):', checkError);
        } else if (existingViews && existingViews.length > 0) {
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
      }
    } catch (err) {
      console.error('Error in logView function (Mobile):', err);
    }
  }, [isVisitorSubscribed]);

  const fetchContent = useCallback(async () => {
    if (user === undefined || isFetching.current || !hasMoreContent || sessionRandomOffset === null) {
      return;
    }
    
    isFetching.current = true;
    setLoading(true);
    setError(null);

    try {
      const creatorTypesToFetch = isVisitorSubscribed ? ['premium_creator', 'creator'] : ['creator'];
      
      let currentOffset = (currentPage === 0) ? sessionRandomOffset : sessionRandomOffset + (currentPage * CONTENT_FETCH_LIMIT);

      const from = currentOffset;
      const to = from + CONTENT_FETCH_LIMIT - 1;
      
      const { data: contentData, error: contentError, count } = await supabase
        .from('content')
        .select(`*, profiles!inner(id, nickname, avatar_path, user_type), views_count:views(count)`, { count: 'exact' })
        .in('profiles.user_type', creatorTypesToFetch)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (contentError) throw contentError;

      if (contentData.length < CONTENT_FETCH_LIMIT || (count !== null && (currentOffset + contentData.length) >= count)) {
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
          isPremiumContent: item.profiles.user_type === 'premium_creator',
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
      } else {
        setHasMoreContent(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load content.');
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [currentPage, hasMoreContent, isVisitorSubscribed, getPublicUrl, user, sessionRandomOffset]);

  useEffect(() => {
    if (user !== undefined && sessionRandomOffset === null) {
      const calculateInitialOffset = async () => {
        const { count, error: countError } = await supabase
          .from('content')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);

        if (countError) {
          console.error('Error fetching total content count:', countError);
          setSessionRandomOffset(0);
          return;
        }
        const maxOffset = Math.max(0, (count || 0) - CONTENT_FETCH_LIMIT);
        setSessionRandomOffset(Math.floor(Math.random() * (maxOffset + 1)));
      };
      calculateInitialOffset();
    } else if (user !== undefined && sessionRandomOffset !== null) {
      fetchContent();
    }
  }, [user, sessionRandomOffset, fetchContent]);

  useEffect(() => {
    setFeedContent([]);
    setCurrentPage(0);
    setHasMoreContent(true);
    isFetching.current = false;
    hasPromptBeenShownThisSession.current = sessionStorage.getItem(SESSION_PROMPT_KEY) === 'true';
    setSessionRandomOffset(null);
  }, [isVisitorSubscribed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.dataset.index, 10);
            setVisibleItemIndex(index);

            if (index === feedContent.length - 1 && !loading && hasMoreContent) {
              setScrollCount(prev => prev + 1);
              fetchContent(); 
            }
          }
        });
      },
      { root: container, rootMargin: '0px', threshold: 0.75 }
    );

    const currentItemRefs = itemRefs.current;
    currentItemRefs.forEach(ref => { if (ref) observer.observe(ref); });

    return () => {
      currentItemRefs.forEach(ref => { if (ref) observer.unobserve(ref); });
    };
  }, [feedContent, loading, hasMoreContent, fetchContent]);

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
      {paymentStatus && (
        <div className="modal-overlay">
          <div className="modal-content payment-status-modal">
            <h2>{paymentStatus === 'verifying' ? 'Verifying Payment...' : paymentStatus === 'success' ? 'Success!' : 'Payment Failed'}</h2>
            <p>{paymentMessage}</p>
            {paymentStatus === 'failed' && <button onClick={() => setPaymentStatus(null)}>Close</button>}
          </div>
        </div>
      )}

      <div className="mobile-search-bar-container">
        <input type="text" placeholder="Search Creators" value={searchTerm} onChange={handleSearchChange} className="mobile-creator-search-input" />
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
        <SubscriptionPromptModal onClose={closeSubscriptionPrompt} onSubscribe={handleSubscribeClick} />
      )}
    </div>
  );
}

export default MobileHomePage;
