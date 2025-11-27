import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UserSignupForm.css';

function UserSignupForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    officialName: '',
    email: '',
    nickname: '',
    mpesaNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nicknameError, setNicknameError] = useState(null);

  const debounceTimeout = useRef(null);

  const checkNicknameUniqueness = useCallback(async (nickname) => {
    if (!nickname) {
      setNicknameError(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', nickname)
        .single();

      if (error && error.code === 'PGRST116') {
        setNicknameError(null);
      } else if (data) {
        setNicknameError('This nickname is already taken.');
      } else if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error checking nickname uniqueness:', err.message);
      setNicknameError('Failed to check nickname. Please try again.');
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));

    if (name === 'nickname') {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        checkNicknameUniqueness(value);
      }, 500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNicknameError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    await checkNicknameUniqueness(formData.nickname);
    if (nicknameError) {
      setLoading(false);
      return;
    }

    try {
      // 1. Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        if (authError.code === '23505' && authError.message.includes('nickname')) {
          setNicknameError('This nickname is already taken.');
          setError('Registration failed due to a duplicate nickname.');
        } else {
          setError(authError.message || "An unexpected error occurred during registration.");
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        // 2. Create profile entry in 'profiles' table, now including email and role
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              official_name: formData.officialName,
              nickname: formData.nickname,
              mpesa_number: formData.mpesaNumber,
              email: formData.email,
              role: 'creator', // Set the role to 'creator' for new sign-ups
              is_approved: false,
            },
          ]);

        if (profileError) {
          throw profileError;
        }

        console.log('User registered and profile created:', authData.user);
        login('creator', false);
        navigate('/user-verification');
      } else {
        setError("Registration successful! Please check your email to verify your account before proceeding.");
        login('creator', false);
        navigate('/user-verification');
      }

    } catch (err) {
      setError(err.message || "An unexpected error occurred during registration.");
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-form-container">
      <h2>Sign Up as Content Creator</h2>
      <p>Join KenyaFlashing and share your creativity! Ensure your nickname is unique.</p>
      <form onSubmit={handleSubmit} className="signup-form">
        <div className="form-group">
          <label htmlFor="officialName">One Mpesa registered Name:</label>
          <input
            type="text"
            id="officialName"
            name="officialName"
            value={formData.officialName}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>
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
          <label htmlFor="nickname">Nickname (for profile):</label>
          <input
            type="text"
            id="nickname"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            required
            disabled={loading}
          />
          {nicknameError && <p className="error-message nickname-error">{nicknameError}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="mpesaNumber">Mpesa Number:</label>
          <input
            type="tel"
            id="mpesaNumber"
            name="mpesaNumber"
            value={formData.mpesaNumber}
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
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="submit-button" disabled={loading || nicknameError}>
          {loading ? 'Registering...' : 'Next'}
        </button>
      </form>
    </div>
  );
}

export default UserSignupForm;
