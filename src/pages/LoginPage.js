import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

// Define the admin email (should match the one in AdminDashboardPage.js)
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loginMessage, setLoginMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginMessage('');

    if (!formData.email || !formData.password) {
      setLoginMessage('Please enter both email and password.');
      setLoading(false);
      return;
    }

    try {
      // 1. Attempt to sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      // 2. Check if login was successful and user data is available
      if (data.user) {
        // --- Determine user role and approval status ---
        let roleToSet = 'none';
        let isApprovedToSet = false;
        let redirectPath = '/';

        if (data.user.email === ADMIN_EMAIL) {
          // If it's the admin, set role to 'admin' and approved to true
          roleToSet = 'admin';
          isApprovedToSet = true;
          redirectPath = '/admin-dashboard';
        } else {
          // For non-admin users, fetch their profile to check creator type and approval status
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('creator_type, is_approved, role')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error("Error fetching user profile during login:", profileError.message);
            roleToSet = 'creator';
            isApprovedToSet = false;
            redirectPath = '/user-pending-approval';
          } else if (profileData) {
            // Check creator type
            if (profileData.creator_type === 'normal_creator') {
              // Normal creators don't require approval and always go to dashboard
              roleToSet = 'normal_creator';
              isApprovedToSet = true; // Set as approved since normal creators are auto-approved
              redirectPath = '/user-dashboard';
            } else if (profileData.creator_type === 'premium_creator') {
              // Premium creators require approval
              roleToSet = 'premium_creator';
              isApprovedToSet = profileData.is_approved || false;
              redirectPath = profileData.is_approved ? '/user-dashboard' : '/user-pending-approval';
            } else {
              // Fallback for older accounts without creator_type
              roleToSet = profileData.role || 'creator';
              isApprovedToSet = profileData.is_approved || false;
              redirectPath = profileData.is_approved ? '/user-dashboard' : '/user-pending-approval';
            }
          } else {
            // Profile data is null
            roleToSet = 'creator';
            isApprovedToSet = false;
            redirectPath = '/user-pending-approval';
          }
        }

        // Set the authentication context
        login(roleToSet, isApprovedToSet);
        setLoginMessage('Login successful! Redirecting...');
        setTimeout(() => {
          navigate(redirectPath);
        }, 1000);

      } else {
        setLoginMessage('Login failed: User data not found after sign in.');
      }

    } catch (err) {
      setLoginMessage(err.message || 'Login failed. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <p>Log in to your Draftey account.</p>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        {loginMessage && <p className={`login-message ${loginMessage.includes('failed') ? 'error' : ''}`}>{loginMessage}</p>}
        <div className="forgot-password-link">
          <Link to="/forgot-password">Forgot Password?</Link>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
