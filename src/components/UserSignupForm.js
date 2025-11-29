import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UserSignupForm.css';

function UserSignupForm({ creatorType }) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    officialName: '',
    email: '',
    nickname: '',
    mpesaNumber: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    agreedToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nicknameError, setNicknameError] = useState(null);
  const [ageError, setAgeError] = useState(null);

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

  const validateAge = (dob) => {
    if (!dob) {
      setAgeError('Date of Birth is required.');
      return false;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      setAgeError('You must be at least 18 years old to sign up.');
      return false;
    }
    setAgeError(null);
    return true;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (name === 'nickname') {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        checkNicknameUniqueness(value);
      }, 500);
    }
    if (name === 'dateOfBirth') {
      validateAge(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNicknameError(null);
    setAgeError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    // Age validation only for normal creators
    if (creatorType === 'normal' && !validateAge(formData.dateOfBirth)) {
      setLoading(false);
      return;
    }

    // Mpesa Number validation only for premium creators
    if (creatorType === 'premium' && !formData.mpesaNumber) {
      setError("Mpesa Number is required for premium creators.");
      setLoading(false);
      return;
    }

    // Terms and Conditions must be agreed to for both creator types
    if (!formData.agreedToTerms) {
      setError("You must agree to the Terms & Conditions and Privacy Policy.");
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
        // Determine role and approval status based on creatorType
        const role = creatorType === 'premium' ? 'premium_creator' : 'normal_creator';
        const isApproved = creatorType === 'normal';

        // 2. Create profile entry in 'profiles' table
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              official_name: formData.officialName,
              nickname: formData.nickname,
              mpesa_number: creatorType === 'premium' ? formData.mpesaNumber : null,
              email: formData.email,
              role: role,
              is_approved: isApproved,
              creator_type: role,
              date_of_birth: creatorType === 'normal' ? formData.dateOfBirth : null,
            },
          ]);

        if (profileError) {
          throw profileError;
        }

        console.log('User registered and profile created:', authData.user);
        login(role, isApproved);

        if (creatorType === 'normal') {
          navigate('/user-dashboard');
        } else {
          navigate('/user-verification');
        }
      } else {
        setError("Registration successful! Please check your email to verify your account before proceeding.");
        login(creatorType === 'premium' ? 'premium_creator' : 'normal_creator', creatorType === 'normal');
        if (creatorType === 'normal') {
          navigate('/user-dashboard');
        } else {
          navigate('/user-verification');
        }
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
      <h2 className="signup-title">{creatorType === 'premium' ? 'Sign Up as Premium Creator' : 'Sign Up as Free Creator'}</h2>
      <p className="signup-tagline">Join Draftey and share your creativity! Ensure your nickname is unique.</p>
      <form onSubmit={handleSubmit} className="signup-form">
        <div className="form-group">
          <label htmlFor="officialName">{creatorType === 'normal' ? 'Name:' : 'One Mpesa registered Name:'}</label>
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
        {creatorType === 'normal' && (
          <div className="form-group">
            <label htmlFor="dateOfBirth">Date of Birth:</label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              required
              disabled={loading}
            />
            {ageError && <p className="error-message">{ageError}</p>}
          </div>
        )}
        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="agreedToTerms"
            name="agreedToTerms"
            checked={formData.agreedToTerms}
            onChange={handleChange}
            disabled={loading}
          />
          <label htmlFor="agreedToTerms">
            I agree to the{' '}
            <Link to="/terms" className="policy-link">Terms & Conditions</Link> and{' '}
            <Link to="/privacy" className="policy-link">Privacy Policy</Link>
          </label>
        </div>
        {creatorType === 'premium' && (
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
        )}
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
        {error && <p className="error-message full-width-error">{error}</p>}
        <button
          type="submit"
          className="submit-button"
          disabled={loading || nicknameError || (creatorType === 'normal' && ageError) || !formData.agreedToTerms}
        >
          {loading ? 'Registering...' : 'Next'}
        </button>
      </form>
    </div>
  );
}

export default UserSignupForm;
