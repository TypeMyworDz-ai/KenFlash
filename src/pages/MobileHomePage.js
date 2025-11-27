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

  const containerRef = useRef(null);

  const getPublicUrl = useCallback((path, bucketName) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const fetchContent = useCallback(async (isInitialFetch = false) => {
    // Clarified order of operations with parentheses
    if (loading || (!hasMoreContent && !isInitialFetch)) return;

    setLoading(true);
    setError(null);

    try {
      let photosQuery = supabase
        .from('photos')
        .select('id, storage_path, caption, creator_id, created_at, profiles(nickname)')
        .order('created_at', { ascending: false })
        .limit(CONTENT_FETCH_LIMIT);

      if (lastFetchedItemId && !isInitialFetch) {
        photosQuery = photosQuery.lt('id', lastFetchedItemId);
      }

      const { data: photosData, error: photosError } = await photosQuery;
      if (photosError) throw photosError;

      let videosQuery = supabase
        .from('videos')
        .select('id, storage_path, thumbnail_path, title, creator_id, created_at, profiles(nickname)')
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
        setLastFetchedItemId(allContent[allContent.length - 1].id);
      }

      const { data: adsData, error: adsError } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (adsError) console.error('Error fetching ads:', adsError);

      let newFeedItems = [];
      let adIndex = 0;
      for (let i = 0; i < allContent.length; i++) {
        newFeedItems.push(allContent[i]);
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

    } catch (err) {
      setError(err.message || 'Failed to load content.');
      console.error('Error fetching mobile content:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMoreContent, lastFetchedItemId, getPublicUrl]);

  useEffect(() => {
    fetchContent(true);
  }, [fetchContent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 200 && !loading && hasMoreContent) {
        setScrollCount(prev => prev + 1);
        fetchContent();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading, hasMoreContent, fetchContent]);

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

  return (
    <div className={`mobile-homepage-container ${theme}`} ref={containerRef}>
      {error && <p className="error-message">{error}</p>}

      {feedContent.length === 0 && !loading && !error ? (
        <p className="no-content-message">No content available. Check back later!</p>
      ) : (
        <div className="content-feed">
          {feedContent.map((item, index) => {
            if (item.type === 'ad') {
              return <MobileAdCard key={`ad-${item.id}-${index}`} ad={item} />;
            } else {
              return <MobileContentCard key={`${item.type}-${item.id}-${index}`} item={item} />;
            }
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
