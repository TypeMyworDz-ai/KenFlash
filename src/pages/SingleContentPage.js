import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './SingleContentPage.css'; // We will create this CSS file next

function SingleContentPage() {
  const { contentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isVisitorSubscribed } = useAuth();
  const [contentItem, setContentItem] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null); // To get creator's ID for back button
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function to safely get public URL or null if path is invalid
  const getSafePublicUrl = (bucketName, path) => {
    if (path && typeof path === 'string' && path.trim() !== '') {
      const { data, error } = supabase.storage.from(bucketName).getPublicUrl(path);
      if (error) {
        console.error(`Error getting public URL for path '${path}' in bucket '${bucketName}':`, error);
        return null;
      }
      return data?.publicUrl || null;
    }
    return null;
  };

  useEffect(() => {
    const fetchSingleContent = async () => {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams(location.search);
      const contentType = queryParams.get('type');

      if (!contentId || !contentType) {
        setError('Content ID or type is missing from the URL.');
        setLoading(false);
        return;
      }

      try {
        let data, fetchError;
        let bucketName, pathColumn, thumbnailColumn;

        if (contentType === 'photo') {
          bucketName = 'photos';
          pathColumn = 'storage_path'; // Assuming 'storage_path' for photos as well
          ({ data, error: fetchError } = await supabase
            .from('photos')
            .select('*')
            .eq('id', contentId)
            .single());
        } else if (contentType === 'video') {
          bucketName = 'videos';
          pathColumn = 'storage_path';
          thumbnailColumn = 'thumbnail_path';
          ({ data, error: fetchError } = await supabase
            .from('videos')
            .select('*')
            .eq('id', contentId)
            .single());
        } else {
          setError('Invalid content type specified.');
          setLoading(false);
          return;
        }

        if (fetchError) throw fetchError;

        if (data) {
          // Fetch creator profile for the back button and potential future use
          const { data: creatorData, error: creatorError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.creator_id)
            .single();

          if (creatorError) {
            console.error('Error fetching creator profile for single content:', creatorError);
            // Don't block content display, just set creatorProfile to null
            setCreatorProfile(null);
          } else {
            setCreatorProfile(creatorData);
          }

          const contentPath = data[pathColumn];
          const url = getSafePublicUrl(bucketName, contentPath);

          let thumbnail = null;
          if (contentType === 'video' && thumbnailColumn && data[thumbnailColumn]) {
            thumbnail = getSafePublicUrl('video_thumbnails', data[thumbnailColumn]);
          }

          if (url) {
            setContentItem({
              ...data,
              type: contentType,
              url: url,
              thumbnail: thumbnail
            });
          } else {
            setError('Failed to retrieve content URL.');
          }
        } else {
          setError('Content item not found.');
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch content.');
        console.error('Error fetching single content:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isVisitorSubscribed) { // Only fetch if subscribed
      fetchSingleContent();
    } else {
      setError("You must be subscribed to view this premium content.");
      setLoading(false);
    }
  }, [contentId, location.search, isVisitorSubscribed]);

  const handleBackButtonClick = () => {
    if (creatorProfile?.id) {
      navigate(`/profile/${creatorProfile.id}`);
    } else {
      navigate(-1); // Go back to the previous page if creator ID isn't available
    }
  };

  if (loading) {
    return <div className="single-content-container"><p>Loading content...</p></div>;
  }

  if (error) {
    return <div className="single-content-container"><p className="error-message">{error}</p></div>;
  }

  if (!contentItem) {
    return <div className="single-content-container"><p>Content not found or inaccessible.</p></div>;
  }

  return (
    <div className="single-content-container">
      <button onClick={handleBackButtonClick} className="back-button">← Back to Creator</button>

      <div className="content-display">
        {contentItem.type === 'photo' ? (
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
