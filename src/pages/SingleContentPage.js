import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './SingleContentPage.css'; // We will create this CSS file next

const DEFAULT_THUMBNAIL_PLACEHOLDER = 'https://via.placeholder.com/600x400?text=Content';

function SingleContentPage() {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const { user, isVisitorSubscribed, visitorEmail } = useAuth(); // Get user object and visitorEmail

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

  // Function to log a view
  const logContentView = useCallback(async (creatorId, contentId, contentType) => {
    // Only log views if the visitor is subscribed (either logged in or via visitorEmail)
    if (!isVisitorSubscribed && (!user || user.userType === 'viewer')) {
      console.log('View not logged: User not subscribed or not a creator/admin.');
      return;
    }

    let viewerIdentifier = {};
    if (user?.id) { // Logged-in user
      viewerIdentifier.viewer_profile_id = user.id;
    } else if (isVisitorSubscribed && visitorEmail) { // Subscribed visitor
      viewerIdentifier.subscriber_email = visitorEmail;
    } else {
      console.log('View not logged: No valid viewer identifier (logged-in user or subscribed visitor email).');
      return;
    }

    try {
      // Check if a unique view already exists for this creator by this viewer
      let existingViewQuery = supabase
        .from('views')
        .select('id')
        .eq('creator_id', creatorId);

      if (viewerIdentifier.viewer_profile_id) {
        existingViewQuery = existingViewQuery.eq('viewer_profile_id', viewerIdentifier.viewer_profile_id);
      } else if (viewerIdentifier.subscriber_email) {
        existingViewQuery = existingViewQuery.eq('subscriber_email', viewerIdentifier.subscriber_email);
      }

      const { data: existingView, error: existingViewError } = await existingViewQuery.single();

      if (existingViewError && existingViewError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error checking for existing view:', existingViewError.message);
        // Continue to log if check fails, to avoid blocking legitimate views
      } else if (existingView) {
        console.log('View not logged: Unique view for this creator by this viewer already exists.');
        return; // Do not log a duplicate unique view
      }

      // Log the new view
      const { error: logError } = await supabase.from('views').insert({
        creator_id: creatorId,
        content_id: contentId,
        content_type: contentType,
        ...viewerIdentifier, // Add viewer_profile_id or subscriber_email
      });

      if (logError) {
        console.error('Error logging content view:', logError.message);
      } else {
        console.log('Content view logged successfully!');
      }
    } catch (err) {
      console.error('Failed to log content view:', err.message);
    }
  }, [user, isVisitorSubscribed, visitorEmail]);


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
        // Fetch content from the merged 'content' table
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

        // Access control: If content is premium_creator's and visitor is not subscribed, show error
        if (contentData.profiles?.creator_type === 'premium_creator' && !isVisitorSubscribed) {
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
            : `${contentUrl}#t=${Math.floor(Math.random() * 30)}`; // Random frame for video poster
        }

        if (contentUrl) {
          setContentItem({
            ...contentData,
            url: contentUrl,
            thumbnail: thumbnailUrl,
            creator_id: contentData.creator_id, // Ensure creator_id is available
            content_type: contentData.content_type, // Ensure content_type is available
          });
          setCreatorProfile({ id: contentData.creator_id }); // For back button
          
          // Log view after content is successfully loaded and accessible
          logContentView(contentData.creator_id, contentData.id, contentData.content_type);

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
  }, [contentId, isVisitorSubscribed, getSafePublicUrl, logContentView]); // Dependencies for useEffect

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
        {contentItem.content_type === 'photo' ? ( // Use content_type
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
