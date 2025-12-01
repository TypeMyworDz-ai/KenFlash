import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './AdminContentModerationPage.css';

function AdminContentModerationPage() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const bucketName = 'content';

        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        // Fetch all content from merged table
        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('id, created_at, creator_id, storage_path, thumbnail_path, title, caption, content_type, is_active, profiles(nickname, official_name)')
          .order('created_at', { ascending: false });

        if (contentError) throw contentError;

        // Combine and format content
        const allContent = [];

        if (contentData) {
          contentData.forEach(item => {
            allContent.push({
              id: item.id,
              type: item.content_type,
              creatorId: item.creator_id,
              creatorNickname: item.profiles ? item.profiles.nickname : 'Unknown Creator',
              url: getPublicUrl(item.storage_path),
              thumbnail: item.thumbnail_path ? getPublicUrl(item.thumbnail_path) : getPublicUrl(item.storage_path),
              videoUrl: getPublicUrl(item.storage_path),
              title: item.title,
              caption: item.caption,
              uploadDate: item.created_at,
              storagePath: item.storage_path,
              isActive: item.is_active,
            });
          });
        }

        // Sort by upload date (latest first)
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
  }, []);

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
        .remove([storagePath]);

      if (storageError) {
        throw storageError;
      }
      console.log(`File removed from storage: ${storagePath}`);

      // 2. Delete record from the content table
      const { error: dbError } = await supabase
        .from('content')
        .delete()
        .eq('id', contentId);

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
