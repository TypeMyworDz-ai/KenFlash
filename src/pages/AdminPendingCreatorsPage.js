import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import AdminDocumentViewerModal from '../components/AdminDocumentViewerModal'; // Import the new modal component
import './AdminPendingCreatorsPage.css';

function AdminPendingCreatorsPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // State to control modal visibility
  const [selectedUserDocs, setSelectedUserDocs] = useState([]); // State to hold documents for the modal

  useEffect(() => {
    const fetchPendingUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_approved', false)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }
        setPendingUsers(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch pending users.');
        console.error('Error fetching pending users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPendingUsers();
  }, []);

  const handleApproveUser = async (userId) => {
    if (!window.confirm(`Are you sure you want to approve user ${userId}?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId);

      if (error) {
        throw error;
      }
      setPendingUsers(pendingUsers.filter(user => user.id !== userId));
      alert(`User ${userId} approved successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to approve user.');
      console.error('Error approving user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocs = (userProfile) => {
    const bucketName = 'verification-docs';

    const getPublicUrl = (path) => {
      if (!path) return null;
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
      return data.publicUrl;
    };

    const docs = [
      { label: 'ID Front', url: getPublicUrl(userProfile.id_front_url) },
      { label: 'ID Back', url: getPublicUrl(userProfile.id_back_url) },
      { label: 'Full Picture Front', url: getPublicUrl(userProfile.full_pic_front_url) },
      { label: 'Full Picture Back', url: getPublicUrl(userProfile.full_pic_back_url) },
    ].filter(doc => doc.url !== null); // Filter out null URLs

    if (docs.length === 0) {
      alert("No verification documents found for this user.");
      return;
    }

    setSelectedUserDocs(docs);
    setIsModalOpen(true); // Open the modal
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUserDocs([]);
  };

  return (
    <div className="admin-pending-creators-container">
      <h2>Pending Creator Approvals</h2>
      <p>Review new content creators' verification documents and approve their accounts.</p>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading pending creators...</p>
      ) : pendingUsers.length === 0 ? (
        <p>No pending creators to approve at this time.</p>
      ) : (
        <div className="pending-creators-grid">
          {pendingUsers.map((user) => (
            <div key={user.id} className="creator-review-card">
              <h3>{user.nickname} ({user.official_name})</h3>
              <p>Mpesa: {user.mpesa_number}</p>
              <p>Registered: {new Date(user.created_at).toLocaleDateString()}</p>
              <div className="card-actions">
                <button onClick={() => handleViewDocs(user)} className="view-docs-button">View Documents</button>
                <button onClick={() => handleApproveUser(user.id)} className="approve-button">Approve</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <AdminDocumentViewerModal
          documents={selectedUserDocs}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default AdminPendingCreatorsPage;
