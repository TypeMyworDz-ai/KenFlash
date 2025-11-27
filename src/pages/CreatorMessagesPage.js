import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CreatorMessagesPage.css';

function CreatorMessagesPage() {
  const navigate = useNavigate();
  const { userRole } = useAuth(); // Assuming userRole is available from AuthContext
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const messagesEndRef = useRef(null); // For auto-scrolling to the latest message

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch Admin ID and current user ID
  useEffect(() => {
    const setupChat = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || userRole !== 'creator') {
          navigate('/login'); // Redirect if not logged in or not a creator
          return;
        }
        setCurrentUserId(user.id);

        // Fetch Admin profile (assuming one admin for simplicity, with role 'admin')
        const { data: adminData, error: adminError } = await supabase
          .from('profiles')
          .select('id, nickname')
          .eq('role', 'admin')
          .single();

        if (adminError) throw adminError;
        if (!adminData) {
          setError('Admin profile not found. Cannot initiate chat.');
          setLoading(false);
          return;
        }
        setAdminProfile(adminData);

      } catch (err) {
        setError(err.message || 'Failed to set up chat.');
        console.error('Chat setup error:', err);
      } finally {
        setLoading(false);
      }
    };

    setupChat();
  }, [navigate, userRole]);

  // Fetch messages and set up real-time subscription
  useEffect(() => {
    if (!currentUserId || !adminProfile) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .or(`(sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}),(sender_id.eq.${adminProfile.id},receiver_id.eq.${adminProfile.id})`)
          .order('sent_at', { ascending: true });

        if (fetchError) throw fetchError;
        setMessages(data || []);
      } catch (err) {
        setError(err.message || 'Failed to fetch messages.');
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Set up real-time subscription for new messages
    const messageChannel = supabase
      .channel('messages_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${adminProfile.id}.or.receiver_id=eq.${adminProfile.id}` // Filter for messages involving this creator and admin
        },
        (payload) => {
          // Check if the new message is relevant to this specific chat
          const newMessageData = payload.new;
          const isRelevant = (newMessageData.sender_id === currentUserId && newMessageData.receiver_id === adminProfile.id) ||
                             (newMessageData.sender_id === adminProfile.id && newMessageData.receiver_id === currentUserId);

          if (isRelevant) {
            setMessages((prevMessages) => [...prevMessages, newMessageData]);
            // Mark message as read if it's for the current user and they are viewing it
            if (newMessageData.receiver_id === currentUserId && !newMessageData.is_read) {
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
  }, [currentUserId, adminProfile]);

  useEffect(() => {
    scrollToBottom(); // Scroll to bottom on messages update
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId || !adminProfile) return;

    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('messages').insert([
        {
          sender_id: currentUserId,
          receiver_id: adminProfile.id,
          message_text: newMessage.trim(),
          sent_at: new Date().toISOString(),
          is_read: false, // Messages sent are initially unread by receiver
        },
      ]);

      if (insertError) throw insertError;

      setNewMessage(''); // Clear input
      // The real-time subscription will add the message to the state
    } catch (err) {
      setError(err.message || 'Failed to send message.');
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="creator-messages-container"><p>Loading chat...</p></div>;
  }

  if (error) {
    return <div className="creator-messages-container"><p className="error-message">{error}</p></div>;
  }

  if (!adminProfile) {
    return <div className="creator-messages-container"><p>Admin chat is currently unavailable.</p></div>;
  }

  return (
    <div className="creator-messages-container">
      <h2>Chat with Admin ({adminProfile.nickname})</h2>
      <div className="chat-box">
        <div className="messages-display">
          {messages.length === 0 ? (
            <p className="no-messages">No messages yet. Start a conversation!</p>
          ) : (
            messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`message ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}
              >
                <p className="message-text">{msg.message_text}</p>
                <span className="message-time">
                  {new Date(msg.sent_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} /> {/* Scroll target */}
        </div>
        <form onSubmit={handleSendMessage} className="message-input-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !newMessage.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreatorMessagesPage;
