import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AdminDocumentViewerModal from '../components/AdminDocumentViewerModal';
import './AdminViewCreatorProfilePage.css';

// Define the admin email for testing purposes
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function AdminViewCreatorProfilePage() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [creatorProfile, setCreatorProfile] = useState(null);
  // Removed creatorEmail state as email will now be part of creatorProfile
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [userDocsForModal, setUserDocsForModal] = useState([]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === ADMIN_EMAIL) {
        setCurrentAdminEmail(user.email);
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        logout();
        navigate('/');
      }
    };
    checkAdminStatus();
  }, [navigate, logout]);

  useEffect(() => {
    if (currentAdminEmail && creatorId) {
      const fetchCreatorData = async () => {
        setLoading(true);
        setError(null);
        try {
          // 1. Fetch profile data (now includes email)
          // Ensure 'email' is selected along with other profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*') 
            .eq('id', creatorId)
            .single();

          if (profileError) {
            throw profileError;
          }

          if (!profileData) {
            setError('Creator profile not found.');
            setLoading(false);
            return;
          }

          // 2. Fetch total views for this creator
          const { count: viewsCount, error: viewsError } = await supabase
            .from('views')
            .select('id', { count: 'exact' })
            .eq('creator_id', creatorId);

          if (viewsError) {
            console.warn('Could not fetch total views:', viewsError.message);
            setTotalViews(0);
          } else {
            setTotalViews(viewsCount || 0);
          }

          const avatarUrl = profileData.avatar_url
            ? supabase.storage.from('avatars').getPublicUrl(profileData.avatar_url).data.publicUrl
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.nickname || profileData.official_name)}&background=random&color=fff`;

          setCreatorProfile({ ...profileData, avatar_url: avatarUrl });

        } catch (err) {
          setError(err.message || 'Failed to fetch creator data.');
          console.error('Error fetching creator data:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCreatorData();
    }
  }, [currentAdminEmail, creatorId]);

  const handleViewDocs = (userProfile) => {
    const bucketName = 'verification-docs';

    const getPublicUrl = (path) => {
      if (!path) return null;
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
      return data.publicUrl;
    };

    const docs = [
      { label: 'Full Picture Front', url: getPublicUrl(userProfile.full_pic_front_url) },
      { label: 'Full Picture Back', url: getPublicUrl(userProfile.full_pic_back_url) },
    ].filter(doc => doc.url !== null);

    if (docs.length === 0) {
      alert("No verification documents found for this user.");
      return;
    }

    setUserDocsForModal(docs);
    setIsDocModalOpen(true);
  };

  const handleCloseDocModal = () => {
    setIsDocModalOpen(false);
    setUserDocsForModal([]);
  };

  const handleDeleteCreatorAccount = async () => {
    if (!window.confirm(`WARNING: Are you sure you want to permanently delete creator ${creatorProfile.nickname}'s account and ALL their content? This action cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    setError(null);

    try {
      // NOTE: This now calls the Edge Function for secure deletion
      const { data: edgeFnData, error: edgeFnError } = await supabase.functions.invoke('delete-creator-user', {
        body: JSON.stringify({ creatorId }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (edgeFnError) throw edgeFnError;
      if (edgeFnData && edgeFnData.error) throw new Error(edgeFnData.error);

      console.log(`Creator account for ${creatorProfile.nickname} (ID: ${creatorId}) has been permanently deleted.`);
      alert(`Creator account for ${creatorProfile.nickname} (ID: ${creatorId}) has been permanently deleted.`);
      navigate('/admin-all-creators');

    } catch (err) {
      setError(err.message || 'Failed to delete creator account. Ensure Edge Function is deployed and accessible.');
      console.error('Error deleting creator account:', err);
    } finally {
      setIsDeleting(false);
    }
  };


  if (!currentAdminEmail) {
    return <div className="admin-view-profile-container">Loading admin status...</div>;
  }

  if (loading) {
    return <div className="admin-view-profile-container"><p>Loading creator profile...</p></div>;
  }

  if (error) {
    return <div className="admin-view-profile-container"><p className="error-message">{error}</p></div>;
  }

  if (!creatorProfile) {
    return <div className="admin-view-profile-container"><p>Creator profile not found.</p></div>;
  }

  return (
    <div className="admin-view-profile-container">
      <h2>Creator Profile: {creatorProfile.nickname}</h2>
      <p>Detailed view of creator's information and statistics.</p>

      <div className="profile-details-grid">
        <div className="profile-card-section">
          <h3>Basic Information</h3>
          <div className="profile-image-container">
            <img src={creatorProfile.avatar_url} alt={`Avatar of ${creatorProfile.nickname}`} className="profile-image" />
          </div>
          <p><strong>Nickname:</strong> {creatorProfile.nickname}</p>
          <p><strong>Official Name:</strong> {creatorProfile.official_name}</p>
          <p><strong>Email:</strong> {creatorProfile.email || 'N/A'}</p> {/* Display email from profileData */}
          <p><strong>Mpesa Number:</strong> {creatorProfile.mpesa_number}</p>
          <p><strong>Bio:</strong> {creatorProfile.bio || 'Not provided'}</p>
          <p><strong>Approved:</strong> {creatorProfile.is_approved ? 'Yes' : 'No'}</p>
          <p><strong>Registered:</strong> {new Date(creatorProfile.created_at).toLocaleDateString()}</p>
        </div>

        <div className="profile-card-section">
          <h3>Verification Documents</h3>
          <p>View the documents submitted by this creator.</p>
          <div className="action-buttons-group"> {/* Wrap buttons in a group */}
            <button
              onClick={() => handleViewDocs(creatorProfile)}
              className="admin-action-button"
              disabled={isDeleting}
            >
              View Documents
            </button>
          </div>
        </div>

        <div className="profile-card-section">
          <h3>Content & Views</h3>
          <p>Total Views: {totalViews.toLocaleString()}</p>
          <div className="action-buttons-group"> {/* Wrap buttons in a group */}
            <Link to={`/admin-creator-content/${creatorId}`} className="admin-action-button" disabled={isDeleting}>View All Content</Link>
          </div>
        </div>

        <div className="profile-card-section">
          <h3>Account Actions</h3>
          <div className="action-buttons-group"> {/* Wrap buttons in a group */}
            {creatorProfile.is_approved ? (
              <button className="admin-action-button warn-button" disabled={isDeleting}>Block Creator (Future)</button>
            ) : (
              <button className="admin-action-button success-button" disabled={isDeleting}>Approve Creator (Future)</button>
            )}
            <button
              onClick={handleDeleteCreatorAccount}
              className="admin-action-button delete-button"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Creator Account'}
            </button>
          </div>
        </div>
      </div>

      {isDocModalOpen && (
        <AdminDocumentViewerModal
          documents={userDocsForModal}
          onClose={handleCloseDocModal}
        />
      )}
    </div>
  );
}

export default AdminViewCreatorProfilePage;
