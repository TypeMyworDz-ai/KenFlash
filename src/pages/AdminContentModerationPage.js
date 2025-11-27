import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Uncommented and now actively used
import './AdminContentModerationPage.css';

function AdminContentModerationPage() {
  const [content, setContent] = useState([]); // Will store combined photos and videos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const bucketName = 'content'; // The bucket where user content is stored

        // Helper function to get public URL from storage path
        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        // 1. Fetch all photos
        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('id, created_at, creator_id, storage_path, caption, profiles(nickname, official_name)')
          .order('created_at', { ascending: false }); // Order by latest first

        if (photosError) throw photosError;

        // 2. Fetch all videos
        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('id, created_at, creator_id, storage_path, thumbnail_path, title, caption, profiles(nickname, official_name)')
          .order('created_at', { ascending: false }); // Order by latest first

        if (videosError) throw videosError;

        // Combine and format content
        const allContent = [];

        // Process photos
        if (photosData) {
          photosData.forEach(photo => {
            allContent.push({
              id: photo.id,
              type: 'photo',
              creatorId: photo.creator_id,
              creatorNickname: photo.profiles ? photo.profiles.nickname : 'Unknown Creator',
              url: getPublicUrl(photo.storage_path), // Construct public URL
              uploadDate: photo.created_at,
              caption: photo.caption,
              storagePath: photo.storage_path, // Keep storage path for deletion
            });
          });
        }

        // Process videos
        if (videosData) {
          videosData.forEach(video => {
            allContent.push({
              id: video.id,
              type: 'video',
              creatorId: video.creator_id,
              creatorNickname: video.profiles ? video.profiles.nickname : 'Unknown Creator',
              thumbnail: getPublicUrl(video.thumbnail_path || video.storage_path), // Use thumbnail or video path
              videoUrl: getPublicUrl(video.storage_path), // Construct public URL
              title: video.title,
              uploadDate: video.created_at,
              caption: video.caption,
              storagePath: video.storage_path, // Keep storage path for deletion
            });
          });
        }

        // Sort combined content by upload date (latest first)
        allContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        setContent(allContent);

      } catch (err) {
        setError(err.message || 'Failed to fetch content for moderation.');
        console.error('Error fetching content:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllContent();
  }, []); // Empty dependency array means this runs once on mount

  const handleTakeDownContent = async (contentId, contentType, storagePath) => {
    if (!window.confirm(`Are you sure you want to take down this ${contentType} (${contentId})? This will permanently delete it.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Delete file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('content')
        .remove([storagePath]); // Pass the full storage path

      if (storageError) {
        throw storageError;
      }
      console.log(`File removed from storage: ${storagePath}`);

      // 2. Delete record from the database table (photos or videos)
      let dbError;
      if (contentType === 'photo') {
        const { error } = await supabase.from('photos').delete().eq('id', contentId);
        dbError = error;
      } else if (contentType === 'video') {
        const { error } = await supabase.from('videos').delete().eq('id', contentId);
        dbError = error;
      }

      if (dbError) {
        throw dbError;
      }
      console.log(`Content record removed from DB: ${contentType} ${contentId}`);

      // Update UI: remove the content from the list
      setContent(prevContent => prevContent.filter(item => item.id !== contentId));
      alert(`${contentType} ${contentId} taken down successfully!`);

    } catch (err) {
      setError(err.message || `Failed to take down ${contentType}.`);
      console.error(`Error taking down ${contentType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-content-moderation-container">
      <h2>Content Moderation</h2>
      <p>Review and manage all uploaded photos and videos.</p>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading all content...</p>
      ) : content.length === 0 ? (
        <p>No content has been uploaded yet.</p>
      ) : (
        <div className="content-grid">
          {content.map((item) => (
            <div key={item.id} className="content-card">
              {item.type === 'photo' ? (
                <img src={item.url} alt={`Content by ${item.creatorNickname}`} className="content-thumbnail" />
              ) : (
                <div className="video-thumbnail-wrapper">
                  <video controls src={item.videoUrl} poster={item.thumbnail} className="content-thumbnail">
                    Your browser does not support the video tag.
                  </video>
                  {/* <span className="play-icon-overlay">▶</span> */} {/* Removed play icon overlay for native video controls */}
                </div>
              )}
              <div className="content-details">
                <h4>{item.type === 'photo' ? item.caption || 'No Caption' : item.title}</h4>
                <p>Creator: {item.creatorNickname}</p>
                <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                <button onClick={() => handleTakeDownContent(item.id, item.type, item.storagePath)} className="takedown-button">Take Down</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminContentModerationPage;
