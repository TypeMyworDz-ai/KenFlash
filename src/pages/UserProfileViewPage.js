import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal';

import './UserProfileViewPage.css';

function UserProfileViewPage() {
  const { userId } = useParams();
  const { isVisitorSubscribed } = useAuth();
  const navigate = useNavigate();
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showSlideshowModal, setShowSlideshowModal] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const getSafePublicUrl = useCallback((bucketName, path) => {
    if (path && typeof path === 'string' && path.trim() !== '') {
      const cleanedPath = path.startsWith('public/') ? path.substring(7) : path;
      const { data, error } = supabase.storage.from(bucketName).getPublicUrl(cleanedPath);
      if (error) {
        console.error(`Error getting public URL for path '${cleanedPath}' in bucket '${bucketName}':`, error);
        return null;
      }
      return data?.publicUrl || null;
    }
    return null;
  }, []);

  const groupPhotos = useCallback((photos) => {
    const groupedPhotosMap = new Map();
    const singlePhotos = [];

    photos.forEach(photo => {
      if (photo.group_id) {
        if (!groupedPhotosMap.has(photo.group_id)) {
          groupedPhotosMap.set(photo.group_id, []);
        }
        groupedPhotosMap.get(photo.group_id).push(photo);
      } else {
        singlePhotos.push(photo);
      }
    });

    const combinedContent = [];
    groupedPhotosMap.forEach((group, group_id) => {
      const sortedGroup = group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      combinedContent.push({
        id: group_id,
        type: 'photo_group',
        photos: sortedGroup,
        url: getSafePublicUrl('content', sortedGroup[0].storage_path),
        caption: sortedGroup[0].caption,
        creator_id: sortedGroup[0].creator_id,
      });
    });

    return [...combinedContent, ...singlePhotos.map(p => ({
      ...p,
      type: 'photo',
      url: getSafePublicUrl('content', p.storage_path)
    }))];
  }, [getSafePublicUrl]);

  useEffect(() => {
    const fetchCreatorData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_path, creator_type, bio, official_name')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          throw profileError;
        }

        if (profileData) {
          const avatarUrl = getSafePublicUrl('avatars', profileData.avatar_path) ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.nickname || profileData.official_name || 'Creator')}&background=random&color=fff`;
          
          setCreatorProfile({ ...profileData, avatar_url: avatarUrl });

          let shouldFetchContent = false;
          if (profileData.creator_type === 'normal_creator') {
            shouldFetchContent = true;
          } else if (profileData.creator_type === 'premium_creator' && isVisitorSubscribed) {
            shouldFetchContent = true;
          }

          if (shouldFetchContent) {
            const { data: photosData, error: photosError } = await supabase
              .from('photos')
              .select('id, storage_path, caption, creator_id, group_id, created_at, profiles(id, nickname, avatar_path, creator_type)')
              .eq('creator_id', userId)
              .order('created_at', { ascending: false });

            const { data: videosData, error: videosError } = await supabase
              .from('videos')
              .select('id, storage_path, thumbnail_path, title, creator_id, created_at, profiles(id, nickname, avatar_path, creator_type)')
              .eq('creator_id', userId)
              .order('created_at', { ascending: false });

            if (photosError) {
              console.error('Error fetching photos:', photosError);
              throw photosError;
            }
            if (videosError) {
              console.error('Error fetching videos:', videosError);
              throw videosError;
            }

            const groupedPhotos = groupPhotos(photosData || []).map(item => ({
              ...item,
              profiles: item.profiles || (photosData.find(p => p.id === item.id)?.profiles)
            }));

            const combinedContent = [
              ...groupedPhotos.map(item => ({
                ...item,
                url: item.url || getSafePublicUrl('content', item.storage_path),
                profiles: item.profiles || profileData,
              })),
              ...(videosData || []).map(item => ({
                ...item,
                type: 'video',
                url: getSafePublicUrl('content', item.storage_path),
                thumbnail: getSafePublicUrl('content', item.thumbnail_path) || getSafePublicUrl('content', item.storage_path),
                profiles: item.profiles || profileData,
              }))
            ];

            const finalContent = combinedContent
              .filter(item => item.url !== null)
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setContent(finalContent);
          } else {
            setContent([]);
          }
        } else {
          setError('Creator profile not found.');
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch creator data.');
        console.error('Error fetching creator data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorData();
  }, [userId, isVisitorSubscribed, getSafePublicUrl, groupPhotos]);

  const openSlideshow = (item) => {
    if (item.type === 'photo_group') {
      setCurrentSlideshowPhotos(item.photos.map(p => ({
        id: p.id,
        url: getSafePublicUrl('content', p.storage_path),
        caption: p.caption,
        creatorNickname: item.profiles?.nickname,
        type: 'photo',
      })));
    } else {
      setCurrentSlideshowPhotos([
        {
          id: item.id,
          url: item.url,
          caption: item.caption,
          creatorNickname: item.profiles?.nickname,
          type: 'photo',
        }
      ]);
    }
    setCurrentSlideshowIndex(0);
    setShowSlideshowModal(true);
  };

  const closeSlideshow = () => {
    setShowSlideshowModal(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowIndex(0);
  };

  const openVideoPlayer = (videoItem) => {
    setCurrentVideo({
      id: videoItem.id,
      url: videoItem.url,
      thumbnailUrl: videoItem.thumbnail,
      title: videoItem.title,
      creatorNickname: videoItem.profiles?.nickname,
    });
    setShowVideoModal(true);
  };

  const closeVideoPlayer = () => {
    setShowVideoModal(false);
    setCurrentVideo(null);
  };

  if (loading) {
    return <div className="user-profile-view-container"><p>Loading creator profile and content...</p></div>;
  }

  if (error) {
    return <div className="user-profile-view-container"><p className="error-message">{error}</p></div>;
  }

  if (!creatorProfile) {
    return <div className="user-profile-view-container"><p>Creator profile not found.</p></div>;
  }

  const displayContentGrid = (creatorProfile.creator_type === 'normal_creator') ||
                             (creatorProfile.creator_type === 'premium_creator' && isVisitorSubscribed);

  return (
    <div className="user-profile-view-container">
      <button onClick={() => navigate(-1)} className="back-button">← Back</button>

      <div className="profile-header">
        <img src={creatorProfile.avatar_url} alt={`Avatar of ${creatorProfile.nickname}`} className="profile-image" />
        <h2 className="profile-nickname">{creatorProfile.nickname}</h2>
        {creatorProfile.bio && <p className="profile-bio">{creatorProfile.bio}</p>}
        {!creatorProfile.bio && <p className="profile-bio">No biography provided yet.</p>}
      </div>

      <div className="creator-content-grid">
        {displayContentGrid ? (
          content.length > 0 ? (
            content.map((item) => (
              <div key={`${item.type}-${item.id}`} className="content-card">
                <div
                  className="content-media"
                  onClick={item.type === 'video' ? () => openVideoPlayer(item) : () => openSlideshow(item)}
                >
                  {item.type === 'photo' || item.type === 'photo_group' ? (
                    <img src={item.url} alt="Creator content" className="content-thumbnail" />
                  ) : (
                    <video controls poster={item.thumbnail} className="content-thumbnail">
                      <source src={item.url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                   <div className="content-overlay">
                    <span className="content-type">
                      {item.type === 'photo_group' ? '📸📸' : item.type === 'photo' ? '📸' : '🎥'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>This creator has no content yet.</p>
          )
        ) : (
          <div className="subscription-call-to-action locked-content-message">
            <p className="subscription-info">
              Subscribe weekly for USD 5 or monthly for USD 10 to unlock this creator's content.
            </p>
            <Link to="/subscribe" className="subscribe-link-button">
              Subscribe Now!
            </Link>
          </div>
        )}
      </div>

      {showSlideshowModal && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          initialIndex={currentSlideshowIndex}
          onClose={closeSlideshow}
        />
      )}

      {showVideoModal && (
        <VideoPlayerModal
          video={currentVideo}
          onClose={closeVideoPlayer}
        />
      )}
    </div>
  );
}

export default UserProfileViewPage;
