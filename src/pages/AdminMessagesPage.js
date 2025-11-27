import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminMessagesPage.css'; // We'll create this CSS file next

// Define an admin email for testing purposes (should match ADMIN_EMAIL in AuthContext or AdminDashboardPage)
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function AdminMessagesPage() {
  const navigate = useNavigate();
  const { logout } = useAuth(); // Assuming useAuth provides logout
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminId, setAdminId] = useState(null);
  const [creatorsWithMessages, setCreatorsWithMessages] = useState([]); // List of creators who have messaged
  const [selectedCreatorId, setSelectedCreatorId] = useState(null); // The creator whose chat is currently open
  const [currentChatMessages, setCurrentChatMessages] = useState([]); // Messages for the selected creator
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null); // For auto-scrolling to the latest message

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Admin authentication check
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === ADMIN_EMAIL) {
        setAdminId(user.id);
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        logout();
        navigate('/');
      }
    };
    checkAdminStatus();
  }, [navigate, logout]);

  // Fetch creators who have sent messages to admin
  useEffect(() => {
    if (!adminId) return;

    const fetchCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        // Corrected: Explicitly select profiles via sender_id relationship using an alias
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('sender_id, sender_profile:profiles!sender_id(id, nickname, official_name)') // Use an alias 'sender_profile'
          .eq('receiver_id', adminId)
          .neq('sender_id', adminId) // Ensure sender is not admin itself
          .order('sent_at', { ascending: false });

        if (fetchError) throw fetchError;

        const uniqueCreators = {};
        data?.forEach(msg => {
          if (msg.sender_profile) { // Use the alias here
            uniqueCreators[msg.sender_profile.id] = msg.sender_profile;
          }
        });
        setCreatorsWithMessages(Object.values(uniqueCreators));

      } catch (err) {
        setError(err.message || 'Failed to fetch creators with messages.');
        console.error('Error fetching creators for admin chat:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreators();
  }, [adminId]);

  // Fetch messages for selected creator and set up real-time subscription
  useEffect(() => {
    if (!adminId || !selectedCreatorId) {
      setCurrentChatMessages([]); // Clear messages if no creator is selected
      return;
    }

    const fetchChatMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .or(`(sender_id.eq.${adminId},receiver_id.eq.${selectedCreatorId}),(sender_id.eq.${selectedCreatorId},receiver_id.eq.${adminId})`)
          .order('sent_at', { ascending: true });

        if (fetchError) throw fetchError;
        setCurrentChatMessages(data || []);

        // Mark messages from this creator to admin as read
        const unreadMessagesFromCreator = data?.filter(msg => msg.sender_id === selectedCreatorId && msg.receiver_id === adminId && !msg.is_read);
        if (unreadMessagesFromCreator && unreadMessagesFromCreator.length > 0) {
          const messageIdsToMarkRead = unreadMessagesFromCreator.map(msg => msg.id);
          const { error: readError } = await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', messageIdsToMarkRead);
          if (readError) console.error('Error marking messages as read:', readError);
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch chat messages.');
        console.error('Error fetching chat messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatMessages();

    // Set up real-time subscription for new messages
    const messageChannel = supabase
      .channel(`admin_chat_${selectedCreatorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${selectedCreatorId}.or.receiver_id=eq.${selectedCreatorId}` // Filter for messages involving this creator
        },
        (payload) => {
          const newMessageData = payload.new;
          // Ensure the new message is relevant to the currently selected chat
          const isRelevant = (newMessageData.sender_id === adminId && newMessageData.receiver_id === selectedCreatorId) ||
                             (newMessageData.sender_id === selectedCreatorId && newMessageData.receiver_id === adminId);

          if (isRelevant) {
            setCurrentChatMessages((prevMessages) => [...prevMessages, newMessageData]);
            // Mark new message as read if admin is viewing it
            if (newMessageData.receiver_id === adminId && !newMessageData.is_read) {
              supabase.from('messages').update({ is_read: true }).eq('id', newMessageData.id).then(({ error }) => {
                if (error) console.error('Error marking message as read:', error);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel); // Clean up subscription on unmount
    };
  }, [adminId, selectedCreatorId]);

  useEffect(() => {
    scrollToBottom(); // Scroll to bottom on messages update
  }, [currentChatMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !adminId || !selectedCreatorId) return;

    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('messages').insert([
        {
          sender_id: adminId,
          receiver_id: selectedCreatorId,
          message_text: newMessage.trim(),
          sent_at: new Date().toISOString(),
          is_read: false, // Messages sent are initially unread by receiver
        },
      ]);

      if (insertError) throw insertError;

      setNewMessage(''); // Clear input
    } catch (err) {
      setError(err.message || 'Failed to send message.');
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedCreatorId) { // Only show full loading if not just switching chats
    return <div className="admin-messages-container"><p>Loading admin chat interface...</p></div>;
  }

  if (error) {
    return <div className="admin-messages-container"><p className="error-message">{error}</p></div>;
  }

  if (!adminId) {
    return <div className="admin-messages-container"><p>Authenticating admin...</p></div>;
  }

  const selectedCreator = creatorsWithMessages.find(c => c.id === selectedCreatorId);

  return (
    <div className="admin-messages-container">
      <h2>Admin Message Center</h2>
      <p>Manage conversations with content creators.</p>

      <div className="admin-chat-layout">
        <div className="creator-list-panel">
          <h3>Creators</h3>
          {creatorsWithMessages.length === 0 ? (
            <p className="no-creators">No creators have sent messages yet.</p>
          ) : (
            <ul className="creator-list">
              {creatorsWithMessages.map(creator => (
                <li
                  key={creator.id}
                  className={`creator-list-item ${selectedCreatorId === creator.id ? 'active' : ''}`}
                  onClick={() => setSelectedCreatorId(creator.id)}
                >
                  {creator.nickname || creator.official_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="chat-area-panel">
          {selectedCreatorId ? (
            <>
              <h3>Chat with {selectedCreator?.nickname || selectedCreator?.official_name}</h3>
              <div className="chat-box">
                <div className="messages-display">
                  {currentChatMessages.length === 0 ? (
                    <p className="no-messages">No messages yet. Start a conversation!</p>
                  ) : (
                    currentChatMessages.map((msg, index) => (
                      <div
                        key={msg.id || index}
                        className={`message ${msg.sender_id === adminId ? 'sent' : 'received'}`}
                      >
                        <p className="message-text">{msg.message_text}</p>
                        <span className="message-time">
                          {new Date(msg.sent_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="message-input-form">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your reply..."
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading || !newMessage.trim()}>
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Select a creator from the left to view their messages.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminMessagesPage;
