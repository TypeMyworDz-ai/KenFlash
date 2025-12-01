import React, { useState, useEffect, useCallback, useRef } from 'react'; // NEW: Added useRef
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoSlideshowModal from '../components/PhotoSlideshowModal';
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
  const [creatorProfileType, setCreatorProfileType] = useState(null);

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
          .select('creator_type')
          .eq('id', creatorId)
          .single();
        
        if (profileError) throw profileError;
        setCreatorProfileType(profileData.creator_type);

        const bucketName = 'content';

        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('id, created_at, storage_path, thumbnail_path, title, caption, group_id, content_type, profiles(creator_type)')
          .eq('creator_id', creatorId)
          .order('created_at', { ascending: false });

        if (contentError) throw contentError;

        const allMyContent = [];

        if (contentData) {
          const photoGroups = {};
          const photos = contentData.filter(item => item.content_type === 'photo');

          photos.forEach(photo => {
            if (!photoGroups[photo.group_id]) {
              photoGroups[photo.group_id] = {
                id: photo.group_id,
                type: 'photo_group',
                uploadDate: photo.created_at,
                caption: photo.caption,
                photos: [],
                creator_id: creatorId,
                content_type: 'photo',
                profiles: photo.profiles,
              };
            }
            photoGroups[photo.group_id].photos.push({
              id: photo.id,
              url: getPublicUrl(photo.storage_path),
              storagePath: photo.storage_path,
              creator_id: creatorId,
              isPremiumContent: photo.profiles?.creator_type === 'premium_creator',
            });
          });

          Object.values(photoGroups).forEach(group => allMyContent.push(group));

          const videos = contentData.filter(item => item.content_type === 'video');
          videos.forEach(video => {
            allMyContent.push({
              id: video.id,
              type: 'video',
              // UPDATED: Use a default placeholder if thumbnail_path is null/invalid
              thumbnail: video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : DEFAULT_VIDEO_THUMBNAIL_PLACEHADER,
              videoUrl: getPublicUrl(video.storage_path),
              title: video.title,
              uploadDate: video.created_at,
              caption: video.caption,
              storagePath: video.storage_path,
              creator_id: creatorId,
              content_type: 'video',
              profiles: video.profiles,
              isPremiumContent: video.profiles?.creator_type === 'premium_creator',
            });
          });
        }

        allMyContent.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
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
    const isPremiumContent = creatorProfileType === 'premium_creator';
    
    const photosForSlideshow = item.photos.map(p => ({
      id: p.id,
      url: p.url,
      caption: item.caption,
      creator_id: item.creator_id,
      isPremiumContent: isPremiumContent,
      type: 'photo',
    }));

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

  const handleVideoPlay = (item) => {
    const isPremiumContent = creatorProfileType === 'premium_creator';
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

      {error && <p className="error-message">&gt;{error}</p>}

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
                  <img src={item.photos[0].url} alt={item.caption || 'Photo group'} className="content-thumbnail" />
                  <div className="group-overlay">
                    <span className="group-icon">📸</span>
                    <p>{item.photos.length} Photos</p>
                  </div>
                  <div className="content-details">
                    <h4>{item.caption || 'Photo Group'}</h4>
                    <p>Uploaded: {new Date(item.uploadDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                // UPDATED: Video card with autoplay on hover and ref
                <div 
                  className="video-card-content"
                  onMouseEnter={() => handleVideoMouseEnter(item.id)} // NEW: Autoplay on hover
                  onMouseLeave={() => handleVideoMouseLeave(item.id)} // NEW: Pause on leave
                >
                  <video
                    ref={el => (videoRefs.current[item.id] = el)} // NEW: Attach ref
                    controls
                    src={item.videoUrl}
                    poster={item.thumbnail} // Now uses the robust thumbnail
                    className="content-thumbnail"
                    muted // NEW: Muted for autoplay
                    playsInline // NEW: For autoplay on iOS
                    onPlay={() => handleVideoPlay(item)}
                  >
                    Your browser does not support the video tag.
                  </video>
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
    </div>
  );
}

export default MyContentPage;
