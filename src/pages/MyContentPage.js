import React, { useState, useEffect, useCallback, useRef } from 'react'; // NEW: Added useRef
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
import VideoPlayerModal from '../components/VideoPlayerModal'; // Added VideoPlayerModal for better video viewing
import './MyContentPage.css';

// NEW: Default video thumbnail placeholder
const DEFAULT_VIDEO_THUMBNAIL_PLACEHADER = 'https://via.placeholder.com/200x150?text=Video';

function MyContentPage() {
  const { isLoggedIn, isVisitorSubscribed } = useAuth();
  const [myContent, setMyContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [currentSlideshowPhotos, setCurrentSlideshowPhotos] = useState([]);
  const [currentSlideshowCaption, setCurrentSlideshowCaption] = useState('');
  const [userProfileType, setUserProfileType] = useState(null);
  
  // For video modal
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  const [slideshowContext, setSlideshowContext] = useState({ creatorId: null, isPremiumContent: false, contentType: 'photo' });

  // NEW: Ref to manage video elements for hover autoplay
  const videoRefs = useRef({});

  const logView = useCallback(async (contentId, creatorId, contentType, isPremiumContent) => {
    console.log('--- Attempting to log view (MyContentPage) ---');
    console.log('Content ID:', contentId);
    console.log('Creator ID (for view logging):', creatorId);
    console.log('Content Type (for view logging):', contentType);
    console.log('Is Premium Content:', isPremiumContent);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const viewerEmailToLog = user?.email || localStorage.getItem('subscriberEmail') || null;

      console.log('Viewer Email (to log):', viewerEmailToLog);

      if (isPremiumContent && viewerEmailToLog && isVisitorSubscribed) {
        console.log(`Checking for existing view for premium content ${contentId} by ${viewerEmailToLog}`);
        const { data: existingViews, error: checkError } = await supabase
          .from('views')
          .select('id')
          .eq('content_id', contentId)
          .eq('viewer_email', viewerEmailToLog)
          .limit(1);

        if (checkError) {
          console.error('Error checking for existing view (MyContentPage):', checkError);
        } else if (existingViews && existingViews.length > 0) {
          console.log(`Duplicate view prevented for premium content ${contentId} by ${viewerEmailToLog}`);
          return;
        }
      }
      
      console.log('Values to insert:', {
        content_id: contentId,
        creator_id: creatorId,
        content_type: contentType,
        viewer_email: viewerEmailToLog,
        viewed_at: new Date().toISOString(),
      });

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
        console.error('Supabase INSERT Error (MyContentPage):', insertError);
      } else {
        console.log('View successfully logged for contentId (MyContentPage):', contentId);
      }
    } catch (err) {
      console.error('Error in logView function (MyContentPage):', err);
    }
    console.log('--- End log view attempt (MyContentPage) ---');
  }, [isVisitorSubscribed]);

  useEffect(() => {
    const fetchMyContent = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!isLoggedIn) {
          throw new Error("You must be logged in to view your content.");
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("User not found.");
        }
        const creatorId = user.id;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', creatorId)
          .single();
        
        if (profileError) throw profileError;
        setUserProfileType(profileData.user_type);

        const bucketName = 'content';

        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        // UPDATED: Fetch all content directly with no limit
        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('id, created_at, storage_path, thumbnail_path, title, caption, group_id, content_type, profiles(user_type)')
          .eq('creator_id', creatorId)
          .order('created_at', { ascending: false });

        if (contentError) throw contentError;
        
        console.log("Content data fetched:", contentData.length, "items");

        const allMyContent = [];

        if (contentData) {
          // FIXED: Improved handling of photo groups
          // Create a map to track which photos have been processed
          const processedPhotoIds = new Set();
          
          // First process all photo groups
          const photoGroups = {};
          
          contentData.forEach(item => {
            if (item.content_type === 'photo' && item.group_id) {
              if (!photoGroups[item.group_id]) {
                photoGroups[item.group_id] = {
                  id: item.group_id,
                  type: 'photo_group',
                  uploadDate: item.created_at,
                  caption: item.caption,
                  photos: [],
                  creator_id: creatorId,
                  content_type: 'photo',
                  profiles: item.profiles,
                };
              }
              
              photoGroups[item.group_id].photos.push({
                id: item.id,
                url: getPublicUrl(item.storage_path),
                storagePath: item.storage_path,
                creator_id: creatorId,
                isPremiumContent: item.profiles?.user_type === 'premium_creator',
              });
              
              // Mark this photo as processed
              processedPhotoIds.add(item.id);
            }
          });

          // Add all photo groups to content
          Object.values(photoGroups).forEach(group => allMyContent.push(group));
          
          // Process individual photos (those without a group_id)
          contentData.forEach(item => {
            if (item.content_type === 'photo' && !processedPhotoIds.has(item.id) && !item.group_id) {
              allMyContent.push({
                id: item.id,
                type: 'photo',
                url: getPublicUrl(item.storage_path),
                thumbnail: getPublicUrl(item.storage_path),
                title: item.caption || 'Photo',
                uploadDate: item.created_at,
                caption: item.caption,
                storagePath: item.storage_path,
                creator_id: creatorId,
                content_type: 'photo',
                profiles: item.profiles,
                isPremiumContent: item.profiles?.user_type === 'premium_creator',
              });
            }
          });

          // Process videos
          const videos = contentData.filter(item => item.content_type === 'video');
          videos.forEach(video => {
            allMyContent.push({
              id: video.id,
              type: 'video',
              thumbnail: video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER,
              videoUrl: getPublicUrl(video.storage_path),
              title: video.title || 'Video',
              uploadDate: video.created_at,
              caption: video.caption,
              storagePath: video.storage_path,
              creator_id: creatorId,
              content_type: 'video',
              profiles: video.profiles,
              isPremiumContent: video.profiles?.user_type === 'premium_creator',
            });
          });
        }

        // Sort by upload date
        allMyContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        console.log("Processed content items:", allMyContent.length);
        
        setMyContent(allMyContent);

      } catch (err) {
        setError(err.message || 'Failed to fetch your content.');
        console.error('Error fetching my content:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isLoggedIn) {
      fetchMyContent();
    } else {
      setLoading(false);
      setError("Please log in to view your content.");
    }
  }, [isLoggedIn, isVisitorSubscribed]);

  const openSlideshow = (item) => {
    const isPremiumContent = userProfileType === 'premium_creator';
    
    // Handle both photo groups and individual photos
    let photosForSlideshow = [];
    
    if (item.type === 'photo_group' && item.photos) {
      photosForSlideshow = item.photos.map(p => ({
        id: p.id,
        url: p.url,
        caption: item.caption,
        creator_id: item.creator_id,
        isPremiumContent: isPremiumContent,
        type: 'photo',
      }));
    } else if (item.type === 'photo') {
      photosForSlideshow = [{
        id: item.id,
        url: item.url,
        caption: item.caption,
        creator_id: item.creator_id,
        isPremiumContent: isPremiumContent,
        type: 'photo',
      }];
    }

    setCurrentSlideshowPhotos(photosForSlideshow);
    setCurrentSlideshowCaption(item.caption);
    setIsSlideshowOpen(true);

    setSlideshowContext({
      creatorId: item.creator_id,
      isPremiumContent: isPremiumContent,
      contentType: 'photo',
    });
  };

  const closeSlideshow = () => {
    setIsSlideshowOpen(false);
    setCurrentSlideshowPhotos([]);
    setCurrentSlideshowCaption('');
    setSlideshowContext({ creatorId: null, isPremiumContent: false, contentType: 'photo' });
  };
  
  const openVideoModal = (item) => {
    const isPremiumContent = userProfileType === 'premium_creator';
    logView(item.id, item.creator_id, item.content_type, isPremiumContent);
    
    setCurrentVideo({
      id: item.id,
      url: item.videoUrl,
      thumbnailUrl: item.thumbnail,
      title: item.title,
      caption: item.caption,
      creator_id: item.creator_id,
      content_type: item.content_type,
      isPremiumContent: isPremiumContent,
    });
    
    setIsVideoModalOpen(true);
  };
  
  const closeVideoModal = () => {
    setIsVideoModalOpen(false);
    setCurrentVideo(null);
  };

  const handleVideoPlay = (item) => {
    const isPremiumContent = userProfileType === 'premium_creator';
    logView(item.id, item.creator_id, item.content_type, isPremiumContent);
  };

  // NEW: Video hover handlers for autoplay
  const handleVideoMouseEnter = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.muted = true; // Mute is often required for autoplay
      video.play().catch(error => console.error("Video autoplay failed on hover:", error));
    }
  };

  const handleVideoMouseLeave = (itemId) => {
    const video = videoRefs.current[itemId];
    if (video) {
      video.pause();
      video.currentTime = 0; // Reset video to start
    }
  };

  return (
    <div className="my-content-container">
      <h2>My Content</h2>
      <p>Here you can view all your uploaded photos and videos.</p>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading your content...</p>
      ) : myContent.length === 0 ? (
        <p>You haven't uploaded any content yet. Start sharing!</p>
      ) : (
        <div className="my-content-grid">
          {myContent.map((item) => (
            <div key={item.id} className="content-card">
              {item.type === 'photo_group' ? (
                <div className="photo-group-card-content" onClick={() => openSlideshow(item)}>
                  <img 
                    src={item.photos && item.photos.length > 0 ? item.photos[0].url : ''} 
                    alt={item.caption || 'Photo group'} 
                    className="content-thumbnail" 
                  />
                  <div className="group-overlay">
                    <span className="group-icon">📸</span>
                    <p>{item.photos ? item.photos.length : 0} Photos</p>
                  </div>
                  <div className="content-details">
                    <h4>{item.caption || 'Photo Group'}</h4>
                    <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : item.type === 'photo' ? (
                <div className="photo-card-content" onClick={() => openSlideshow(item)}>
                  <img 
                    src={item.url} 
                    alt={item.caption || 'Photo'} 
                    className="content-thumbnail" 
                  />
                  <div className="content-details">
                    <h4>{item.caption || 'Photo'}</h4>
                    <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                // Video card with improved click handling
                <div 
                  className="video-card-content"
                  onMouseEnter={() => handleVideoMouseEnter(item.id)}
                  onMouseLeave={() => handleVideoMouseLeave(item.id)}
                  onClick={() => openVideoModal(item)}
                >
                  <video
                    ref={el => (videoRefs.current[item.id] = el)}
                    poster={item.thumbnail}
                    className="content-thumbnail"
                    muted
                    playsInline
                    onPlay={() => handleVideoPlay(item)}
                  >
                    <source src={item.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <div className="play-overlay">
                    <span className="play-icon">▶️</span>
                  </div>
                  <div className="content-details">
                    <h4>{item.title || 'No Title'}</h4>
                    <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                    {item.caption && <p className="video-caption">{item.caption}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isSlideshowOpen && (
        <PhotoSlideshowModal
          photos={currentSlideshowPhotos}
          caption={currentSlideshowCaption}
          onClose={closeSlideshow}
          logView={logView}
          creatorId={slideshowContext.creatorId}
          contentType={slideshowContext.contentType}
          isPremiumContent={slideshowContext.isPremiumContent}
        />
      )}
      
      {isVideoModalOpen && currentVideo && (
        <VideoPlayerModal
          video={currentVideo}
          onClose={closeVideoModal}
          logView={logView}
          creatorId={currentVideo.creator_id}
          contentType={currentVideo.content_type}
          isPremiumContent={currentVideo.isPremiumContent}
        />
      )}
    </div>
  );
}

export default MyContentPage;
