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
const AVATAR_BUCKET = 'avatars'; // Assuming your avatars are in an 'avatars' bucket
const CONTENT_FETCH_LIMIT = 5;
const AD_INSERT_FREQUENCY = 3;
const SCROLLS_BEFORE_SUBSCRIPTION_PROMPT = 3;

function MobileHomePage() {
  const navigate = useNavigate();
  const { isVisitorSubscribed } = useAuth();
  const { theme } = useTheme();

  const [feedContent, setFeedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMoreContent, setHasMoreContent] = useState(true);
  const [lastFetchedItemId, setLastFetchedItemId] = useState(null);
  const [scrollCount, setScrollCount] = useState(0);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleItemIndex, setVisibleItemIndex] = useState(0);

  const containerRef = useRef(null);
  const itemRefs = useRef([]);

  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const fetchContent = useCallback(async (isInitialFetch = false) => {
    if ((loading && !isInitialFetch) || (!hasMoreContent && !isInitialFetch)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let photosQuery = supabase
        .from('photos')
        .select('id, storage_path, caption, creator_id, created_at')
        .order('created_at', { ascending: false })
        .limit(CONTENT_FETCH_LIMIT);

      if (lastFetchedItemId && !isInitialFetch) {
        photosQuery = photosQuery.lt('id', lastFetchedItemId);
      }

      const { data: photosData, error: photosError } = await photosQuery;
      if (photosError) throw photosError;

      let videosQuery = supabase
        .from('videos')
        .select('id, storage_path, thumbnail_path, title, creator_id, created_at')
        .order('created_at', { ascending: false })
        .limit(CONTENT_FETCH_LIMIT);

      if (lastFetchedItemId && !isInitialFetch) {
        videosQuery = videosQuery.lt('id', lastFetchedItemId);
      }

      const { data: videosData, error: videosError } = await videosQuery;
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

      allContent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (allContent.length === 0) {
        setHasMoreContent(false);
      } else {
        const creatorIds = [...new Set(allContent.map(item => item.creator_id))];
        let profilesData = [];
        let profilesError = null;
        if (creatorIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, nickname, avatar_url');
          profilesData = data;
          profilesError = error;
        }
        
        if (profilesError) console.error('Error fetching profiles for nicknames/avatars:', profilesError);

        const profilesMap = profilesData ? profilesData.reduce((acc, profile) => {
          acc[profile.id] = { nickname: profile.nickname, avatar_url: profile.avatar_url };
          return acc;
        }, {}) : {};

        const contentWithCreatorInfo = allContent.map(item => ({
          ...item,
          creatorInfo: {
            id: item.creator_id,
            nickname: profilesMap[item.creator_id]?.nickname || 'Creator',
            avatar_url: getPublicUrl(profilesMap[item.creator_id]?.avatar_url, AVATAR_BUCKET) || null
          }
        }));

        setLastFetchedItemId(allContent[allContent.length - 1].id);

        const { data: adsData, error: adsError } = await supabase
          .from('advertisements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(10);

        if (adsError) console.error('Error fetching ads:', adsError);

        let newFeedItems = [];
        let adIndex = 0;
        for (let i = 0; i < contentWithCreatorInfo.length; i++) {
          newFeedItems.push(contentWithCreatorInfo[i]);
          if (adsData && adsData.length > 0 && (i + 1) % AD_INSERT_FREQUENCY === 0) {
            const randomAd = adsData[adIndex % adsData.length];
            newFeedItems.push({
              ...randomAd,
              type: 'ad',
              media_url: getPublicUrl(randomAd.media_path, AD_MEDIA_BUCKET)
            });
            adIndex++;
          }
        }

        setFeedContent(prev => isInitialFetch ? newFeedItems : [...prev, ...newFeedItems]);
      }

    } catch (err) {
      setError(err.message || 'Failed to load content.');
      console.error('Error fetching mobile content (catch block):', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMoreContent, lastFetchedItemId, getPublicUrl]);

  // Initial content fetch
  useEffect(() => {
    fetchContent(true);
  }, [fetchContent]);

  // Intersection Observer for video playback control and infinite scroll
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
              fetchContent();
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '0px',
        threshold: 0.75,
      }
    );

    currentItemRefs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      currentItemRefs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
      observer.disconnect();
    };
  }, [feedContent, loading, hasMoreContent, fetchContent]);

  // Subscription prompt logic for free users
  useEffect(() => {
    if (!isVisitorSubscribed && scrollCount >= SCROLLS_BEFORE_SUBSCRIPTION_PROMPT) {
      setShowSubscriptionPrompt(true);
    }
  }, [isVisitorSubscribed, scrollCount]);

  const closeSubscriptionPrompt = () => {
    setShowSubscriptionPrompt(false);
  };

  const handleSubscribeClick = () => {
    navigate('/subscribe');
    closeSubscriptionPrompt();
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className={`mobile-homepage-container ${theme}`} ref={containerRef}>
      {/* Transparent Search Bar */}
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

      {feedContent.length === 0 && !loading && !error ? (
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
                    // Changed to general creator profile page
                    onNavigateToCreatorProfile={(creatorId) => navigate(`/profile/${creatorId}`)} 
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading && <p className="loading-message">Loading more content...</p>}
      {!hasMoreContent && !loading && <p className="end-of-feed-message">You've reached the end of the feed.</p>}

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
