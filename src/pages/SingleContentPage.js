import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Removed useLocation as it's not used
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './SingleContentPage.css'; // We will create this CSS file next

const DEFAULT_THUMBNAIL_PLACEHOLDER = 'https://via.placeholder.com/600x400?text=Content';
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video'; // NEW: Consistent video placeholder

function SingleContentPage() {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const { isVisitorSubscribed } = useAuth(); // Only isVisitorSubscribed is needed for logView logic

  const [contentItem, setContentItem] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function to safely get public URL or null if path is invalid
  const getSafePublicUrl = useCallback((bucketName, path) => {
    if (path && typeof path === 'string' && path.trim() !== '') {
      const { data, error } = supabase.storage.from(bucketName).getPublicUrl(path);
      if (error) {
        console.error(`Error getting public URL for path '${path}' in bucket '${bucketName}':`, error);
        return null;
      }
      return data?.publicUrl || null;
    }
    return null;
  }, []);

  // UPDATED: logView function - Standardized version for unique premium content views
  const logView = useCallback(async (contentIdToLog, creatorId, contentType, isPremiumContent) => { // Renamed contentId to contentIdToLog to avoid conflict
    console.log('--- Attempting to log view (SingleContentPage) ---');
    console.log('Content ID:', contentIdToLog);
    console.log('Creator ID (for view logging):', creatorId);
    console.log('Content Type (for view logging):', contentType);
    console.log('Is Premium Content:', isPremiumContent);

    try {
      const { data: { user } } = await supabase.auth.getUser(); // Reintroduce fetching user
      
      const viewerEmailToLog = user?.email || localStorage.getItem('subscriberEmail') || null;

      console.log('Viewer Email (to log):', viewerEmailToLog);

      // --- Uniqueness Check for Premium Content ---
      if (isPremiumContent && viewerEmailToLog && isVisitorSubscribed) {
        console.log(`Checking for existing view for premium content ${contentIdToLog} by ${viewerEmailToLog}`);
        const { data: existingViews, error: checkError } = await supabase
          .from('views')
          .select('id')
          .eq('content_id', contentIdToLog)
          .eq('viewer_email', viewerEmailToLog)
          .limit(1);

        if (checkError) {
          console.error('Error checking for existing view (SingleContentPage):', checkError);
        } else if (existingViews && existingViews.length > 0) {
          console.log(`Duplicate view prevented for premium content ${contentIdToLog} by ${viewerEmailToLog}`);
          return; // Prevent logging duplicate view
        }
      }
      // --- End Uniqueness Check ---
      
      console.log('Values to insert:', {
        content_id: contentIdToLog,
        creator_id: creatorId,
        content_type: contentType,
        viewer_email: viewerEmailToLog,
        viewed_at: new Date().toISOString(),
      });

      const { error: insertError } = await supabase.from('views').insert([
        {
          content_id: contentIdToLog,
          creator_id: creatorId,
          content_type: contentType,
          viewer_email: viewerEmailToLog,
          viewed_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        console.error('Supabase INSERT Error (SingleContentPage):', insertError);
      } else {
        console.log('View successfully logged for contentId (SingleContentPage):', contentIdToLog);
      }
    } catch (err) {
      console.error('Error in logView function (SingleContentPage):', err);
    }
    console.log('--- End log view attempt (SingleContentPage) ---');
  }, [isVisitorSubscribed]); // Added isVisitorSubscribed to dependencies


  useEffect(() => {
    const fetchSingleContent = async () => {
      setLoading(true);
      setError(null);

      if (!contentId) {
        setError('Content ID is missing from the URL.');
        setLoading(false);
        return;
      }

      try {
        // Fetch content from the merged 'content' table, including profiles for creator_type
        const { data: contentData, error: fetchError } = await supabase
          .from('content')
          .select(`
            *,
            profiles(id, nickname, creator_type)
          `)
          .eq('id', contentId)
          .single();

        if (fetchError) throw fetchError;
        if (!contentData) throw new Error('Content item not found.');

        // Determine if content is premium
        const isPremium = contentData.profiles?.creator_type === 'premium_creator';

        // Access control: If content is premium_creator's and visitor is not subscribed, show error
        if (isPremium && !isVisitorSubscribed) {
          setError("You must be subscribed to view this premium content.");
          setLoading(false);
          return;
        }

        // Determine URL and thumbnail
        const contentUrl = getSafePublicUrl('content', contentData.storage_path);
        let thumbnailUrl = null;
        if (contentData.content_type === 'video') {
          thumbnailUrl = contentData.thumbnail_path
            ? getSafePublicUrl('content', contentData.thumbnail_path)
            : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER; // Use consistent video placeholder
        }

        if (contentUrl) {
          setContentItem({
            ...contentData,
            url: contentUrl,
            thumbnail: thumbnailUrl,
            creator_id: contentData.creator_id,
            content_type: contentData.content_type,
            isPremiumContent: isPremium, // NEW: Add isPremiumContent to the item
          });
          setCreatorProfile({ id: contentData.creator_id }); // For back button
          
          // Log view after content is successfully loaded and accessible
          logView(contentData.id, contentData.creator_id, contentData.content_type, isPremium);

        } else {
          setError('Failed to retrieve content URL.');
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch content.');
        console.error('Error fetching single content:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSingleContent();
  }, [contentId, isVisitorSubscribed, getSafePublicUrl, logView]); // Dependencies for useEffect

  const handleBackButtonClick = () => {
    if (creatorProfile?.id) {
      navigate(`/profile/${creatorProfile.id}`);
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return <div className="single-content-container"><p>Loading content...</p></div>;
  }

  if (error) {
    return (
      <div className="single-content-container">
        <button onClick={handleBackButtonClick} className="back-button">← Back</button>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (!contentItem) {
    return <div className="single-content-container"><p>Content not found or inaccessible.</p></div>;
  }

  return (
    <div className="single-content-container">
      <button onClick={handleBackButtonClick} className="back-button">← Back to Creator</button>

      <div className="content-display">
        {contentItem.content_type === 'photo' ? (
          <img src={contentItem.url} alt={contentItem.caption || 'Content Photo'} className="single-content-media" />
        ) : (
          <video controls poster={contentItem.thumbnail} className="single-content-media">
            <source src={contentItem.url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
        <h3 className="content-title">{contentItem.title || contentItem.caption || 'Untitled Content'}</h3>
        {contentItem.caption && <p className="content-caption">{contentItem.caption}</p>}
      </div>
    </div>
  );
}

export default SingleContentPage;
