import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import './CreatorPhotosPage.css';

function CreatorPhotosPage() {
  const { userId } = useParams();
  const { user, isVisitorSubscribed } = useAuth();
  const [photoGroups, setPhotoGroups] = useState([]);
  const [suggestedPhotos, setSuggestedPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const allAvailablePhotos = useMemo(() => [
    { id: 'suggest1', creatorId: 'other1', creatorName: 'Explorer', photo: 'https://via.placeholder.com/300x300?text=Explore+1' },
    { id: 'suggest2', creatorId: 'other2', creatorName: 'Art Lover', photo: 'https://via.placeholder.com/300x300?text=Art+2' },
    { id: 'suggest3', creatorId: 'other3', creatorName: 'Traveler', photo: 'https://via.placeholder.com/300x300?text=Travel+3' },
    { id: 'suggest4', creatorId: 'other4', creatorName: 'Foodie', photo: 'https://via.placeholder.com/300x300?text=Food+4' },
    { id: 'suggest5', creatorId: 'other5', creatorName: 'Nature Lover', photo: 'https://via.placeholder.com/300x300?text=Nature+5' },
  ], []);

  const shuffleArray = useCallback((array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Track view when photo is opened
  const trackView = useCallback(async (photoId) => {
    if (!isVisitorSubscribed) return;

    try {
      const viewerEmail = user?.email || `anonymous-${Date.now()}`;
      await supabase.from('views').insert({
        creator_id: userId,
        viewer_email: viewerEmail,
        content_type: 'photo',
        content_id: photoId,
        viewed_at: new Date().toISOString(),
      });
      console.log('View tracked for photo:', photoId);
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  }, [userId, isVisitorSubscribed, user]);

  useEffect(() => {
    const fetchCreatorPhotos = async () => {
      setLoading(true);
      setError(null);
      try {
        const bucketName = 'content';

        const getPublicUrl = (path) => {
          if (!path) return null;
          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          return data.publicUrl;
        };

        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('id, created_at, storage_path, caption, group_id')
          .eq('creator_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (photosError) throw photosError;

        const groupedPhotos = {};
        if (photosData) {
          photosData.forEach(photo => {
            if (!groupedPhotos[photo.group_id]) {
              groupedPhotos[photo.group_id] = {
                id: photo.group_id,
                uploadDate: photo.created_at,
                caption: photo.caption,
                photos: [],
              };
            }
            groupedPhotos[photo.group_id].photos.push({
              id: photo.id,
              url: getPublicUrl(photo.storage_path),
              storagePath: photo.storage_path,
            });
          });
        }
        setPhotoGroups(Object.values(groupedPhotos).sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));

        const { data: allPhotosForSuggestions, error: suggestionsError } = await supabase
          .from('photos')
          .select('id, creator_id, storage_path, caption, profiles(nickname)')
          .neq('creator_id', userId)
          .eq('is_active', true);

        if (suggestionsError) throw suggestionsError;

        if (allPhotosForSuggestions) {
          const formattedSuggestions = allPhotosForSuggestions.map(photo => ({
            id: photo.id,
            creatorId: photo.creator_id,
            creatorName: photo.profiles ? photo.profiles.nickname : 'Unknown',
            photo: getPublicUrl(photo.storage_path),
            caption: photo.caption,
          }));
          const randomized = shuffleArray(formattedSuggestions).slice(0, 4);
          setSuggestedPhotos(randomized);
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch photos.');
        console.error('Error fetching photos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorPhotos();
  }, [userId, shuffleArray, allAvailablePhotos]);

  const openPhotoGroup = (groupId) => {
    setSelectedGroupId(groupId);
    setCurrentPhotoIndex(0);
    // Track view for first photo in group
    const group = photoGroups.find((g) => g.id === groupId);
    if (group) {
      trackView(group.photos[0].id);
    }
  };

  const closePhotoGroup = () => {
    setSelectedGroupId(null);
    setCurrentPhotoIndex(0);
  };

  const goToPreviousPhoto = (e) => {
    e.stopPropagation();
    const group = photoGroups.find((g) => g.id === selectedGroupId);
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
      trackView(group.photos[currentPhotoIndex - 1].id);
    } else if (group) {
      setCurrentPhotoIndex(group.photos.length - 1);
      trackView(group.photos[group.photos.length - 1].id);
    }
  };

  const goToNextPhoto = (e) => {
    e.stopPropagation();
    const group = photoGroups.find((g) => g.id === selectedGroupId);
    if (group && currentPhotoIndex < group.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
      trackView(group.photos[currentPhotoIndex + 1].id);
    } else {
      setCurrentPhotoIndex(0);
      if (group) trackView(group.photos[0].id);
    }
  };

  const selectedGroup = photoGroups.find((g) => g.id === selectedGroupId);

  return (
    <div className="creator-photos-container">
      <h2>Photos</h2>
      <p>Browse all photos from this creator (Latest to Oldest)</p>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading photos...</p>
      ) : photoGroups.length === 0 ? (
        <p>This creator has not uploaded any photos yet.</p>
      ) : (
        <div className="photo-groups-grid">
          {photoGroups.map((group) => (
            <div key={group.id} className="photo-group-card" onClick={() => openPhotoGroup(group.id)}>
              <img src={group.photos[0].url} alt={group.caption || `Photo group by ${userId}`} className="group-thumbnail" />
              <div className="group-overlay">
                <span className="group-icon">📸</span>
                <p>{group.photos.length} Photo(s)</p>
              </div>
              <div className="group-details">
                <h4 className="group-caption">{group.caption || 'No Caption'}</h4>
                <p className="upload-date">{new Date(group.uploadDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedGroup && (
        <div className="lightbox-overlay" onClick={closePhotoGroup}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closePhotoGroup}>&times;</button>
            <div className="slideshow-container">
              <img src={selectedGroup.photos[currentPhotoIndex].url} alt={selectedGroup.caption || `Slideshow photo ${currentPhotoIndex + 1}`} className="slideshow-image" />
              <div className="slideshow-controls">
                <button className="nav-button prev-button" onClick={goToPreviousPhoto}>&lt;</button>
                <span className="photo-counter">{currentPhotoIndex + 1} / {selectedGroup.photos.length}</span>
                <button className="nav-button next-button" onClick={goToNextPhoto}>&gt;</button>
              </div>
              {selectedGroup.caption && <p className="slideshow-caption">{selectedGroup.caption}</p>}
            </div>
          </div>
        </div>
      )}

      {suggestedPhotos.length > 0 && (
        <div className="suggested-section">
          <h3>Explore More</h3>
          <p>Check out photos from other amazing creators!</p>
          <div className="suggested-photos-grid">
            {suggestedPhotos.map((suggested) => (
              <div key={suggested.id} className="suggested-photo-card">
                <img src={suggested.photo} alt={suggested.caption || `Photo by ${suggested.creatorName}`} className="suggested-photo" />
                <div className="suggested-details">
                  <p className="suggested-creator-name">{suggested.creatorName}</p>
                  <p className="suggested-caption">{suggested.caption || 'No Caption'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreatorPhotosPage;
