import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './CreatorVideosPage.css';

function CreatorVideosPage() {
  const { userId } = useParams();
  const { user, isVisitorSubscribed } = useAuth();
  const [videos, setVideos] = useState([]);
  const [suggestedVideos, setSuggestedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedVideoId, setSelectedVideoId] = useState(null);

  const allAvailableVideosPlaceholder = useMemo(() => [
    { id: 'sugg_vid1', creatorId: 'other1', creatorName: 'Explorer', title: 'Random Clip 1', thumbnail: 'https://via.placeholder.com/300x300?text=Sugg+Video+1', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 'sugg_vid2', creatorId: 'other2', creatorName: 'Art Lover', title: 'Awesome View', thumbnail: 'https://via.placeholder.com/300x300?text=Sugg+Video+2', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 'sugg_vid3', creatorId: 'other3', creatorName: 'Traveler', title: 'City Tour', thumbnail: 'https://via.placeholder.com/300x300?text=Sugg+Video+3', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 'sugg_vid4', creatorId: 'other4', creatorName: 'Foodie', title: 'Cooking Show', thumbnail: 'https://via.placeholder.com/300x300?text=Sugg+Video+4', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  ], []);

  const shuffleArray = useCallback((array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Track view when video is opened
  const trackView = useCallback(async (videoId) => {
    if (!isVisitorSubscribed) return;

    try {
      const viewerEmail = user?.email || `anonymous-${Date.now()}`;
      await supabase.from('views').insert({
        creator_id: userId,
        viewer_email: viewerEmail,
        content_type: 'video',
        content_id: videoId,
        viewed_at: new Date().toISOString(),
      });
      console.log('View tracked for video:', videoId);
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  }, [userId, isVisitorSubscribed, user]);

  useEffect(() => {
    const fetchCreatorVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const bucketName = 'content';

        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('id, created_at, storage_path, thumbnail_path, title, caption')
          .eq('creator_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (videosError) throw videosError;

        if (videosData) {
          const formattedVideos = videosData.map(video => ({
            id: video.id,
            title: video.title,
            uploadDate: video.created_at,
            thumbnail: video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : getPublicUrl(video.storage_path),
            videoUrl: getPublicUrl(video.storage_path),
            caption: video.caption,
          }));
          setVideos(formattedVideos);
        }

        const { data: allVideosForSuggestions, error: suggestionsError } = await supabase
          .from('videos')
          .select('id, creator_id, storage_path, thumbnail_path, title, caption, profiles(nickname)')
          .neq('creator_id', userId)
          .eq('is_active', true);

        if (suggestionsError) throw suggestionsError;

        let formattedSuggestions = [];
        if (allVideosForSuggestions) {
          formattedSuggestions = allVideosForSuggestions.map(video => ({
            id: video.id,
            creatorId: video.creator_id,
            creatorName: video.profiles ? video.profiles.nickname : 'Unknown',
            title: video.title,
            thumbnail: video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : getPublicUrl(video.storage_path),
            videoUrl: getPublicUrl(video.storage_path),
            caption: video.caption,
          }));
        }

        if (formattedSuggestions.length < 4) {
          const remainingSlots = 4 - formattedSuggestions.length;
          const shuffledPlaceholders = shuffleArray(allAvailableVideosPlaceholder).slice(0, remainingSlots);
          setSuggestedVideos([...formattedSuggestions, ...shuffledPlaceholders]);
        } else {
          const randomized = shuffleArray(formattedSuggestions).slice(0, 4);
          setSuggestedVideos(randomized);
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch videos.');
        console.error('Error fetching videos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorVideos();
  }, [userId, shuffleArray, allAvailableVideosPlaceholder]);

  const openVideo = (videoId) => {
    setSelectedVideoId(videoId);
    trackView(videoId);
  };

  const closeVideo = () => {
    setSelectedVideoId(null);
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  return (
    <div className="creator-videos-container">
      <h2>Videos</h2>
      <p>Browse all videos from this creator (Latest to Oldest)</p>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading videos...</p>
      ) : videos.length === 0 ? (
        <p>This creator has not uploaded any videos yet.</p>
      ) : (
        <div className="videos-grid">
          {videos.map((video) => (
            <div key={video.id} className="video-card" onClick={() => openVideo(video.id)}>
              <div className="video-thumbnail-container">
                <video src={video.videoUrl} poster={video.thumbnail} className="video-thumbnail" muted preload="metadata" controls>
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="video-details">
                <h4 className="video-title">{video.title}</h4>
                <p className="video-upload-date">{new Date(video.uploadDate).toLocaleDateString()}</p>
                {video.caption && <p className="video-caption">{video.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVideo && (
        <div className="video-overlay" onClick={closeVideo}>
          <div className="video-player-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeVideo}>&times;</button>
            <div className="video-player-container">
              <iframe
                width="100%"
                height="500"
                src={selectedVideo.videoUrl}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <h3 className="video-player-title">{selectedVideo.title}</h3>
            {selectedVideo.caption && <p className="video-player-caption">{selectedVideo.caption}</p>}
          </div>
        </div>
      )}

      {suggestedVideos.length > 0 && (
        <div className="suggested-section">
          <h3>Explore More</h3>
          <p>Check out videos from other amazing creators!</p>
          <div className="suggested-videos-grid">
            {suggestedVideos.map((suggested) => (
              <div key={suggested.id} className="suggested-video-card">
                <div className="suggested-video-thumbnail-container">
                  <video src={suggested.videoUrl} poster={suggested.thumbnail} className="suggested-video-thumbnail" muted preload="metadata" controls>
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="suggested-details">
                  <h4 className="suggested-video-title">{suggested.title}</h4>
                  <p className="suggested-creator-name">{suggested.creatorName}</p>
                  {suggested.caption && <p className="suggested-caption">{suggested.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreatorVideosPage;
