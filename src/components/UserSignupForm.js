import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UserSignupForm.css';

function UserSignupForm({ userType }) { // Changed prop name to userType
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
    businessName: '', // New field for business accounts
    contactPhone: '', // New field for business accounts
    agreedToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nicknameError, setNicknameError] = useState(null);
  const [ageError, setAgeError] = useState(null);
  const [businessNameError, setBusinessNameError] = useState(null);
  const [contactPhoneError, setContactPhoneError] = useState(null);


  const debounceTimeout = useRef(null);

  const checkNicknameUniqueness = useCallback(async (nickname) => {
    if (!nickname || userType === 'business') { // Nickname not required for business accounts
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
  }, [userType]);

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
    if (name === 'businessName') {
      setBusinessNameError(value.trim() === '' ? 'Business Name is required.' : null);
    }
    if (name === 'contactPhone') {
      setContactPhoneError(value.trim() === '' ? 'Contact Phone is required.' : null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNicknameError(null);
    setAgeError(null);
    setBusinessNameError(null);
    setContactPhoneError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    // Age validation only for 'creator' type
    if (userType === 'creator' && !validateAge(formData.dateOfBirth)) {
      setLoading(false);
      return;
    }

    // Mpesa Number validation only for 'premium_creator' type
    if (userType === 'premium_creator' && !formData.mpesaNumber) {
      setError("Mpesa Number is required for premium creators.");
      setLoading(false);
      return;
    }

    // Business Name and Contact Phone validation for 'business' type
    if (userType === 'business') {
      if (!formData.businessName.trim()) {
        setBusinessNameError('Business Name is required.');
        setLoading(false);
        return;
      }
      if (!formData.contactPhone.trim()) {
        setContactPhoneError('Contact Phone is required.');
        setLoading(false);
        return;
      }
    }

    // Terms and Conditions must be agreed to for all user types
    if (!formData.agreedToTerms) {
      setError("You must agree to the Terms & Conditions and Privacy Policy.");
      setLoading(false);
      return;
    }

    // Check nickname uniqueness only for creator types
    if (userType === 'creator' || userType === 'premium_creator') {
      await checkNicknameUniqueness(formData.nickname);
      if (nicknameError) {
        setLoading(false);
        return;
      }
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
        // Prepare profile data for insertion
        const profileToInsert = {
          id: authData.user.id,
          email: formData.email,
          user_type: userType, // New user_type column
          role: userType, // Aligning role with user_type
          is_approved: userType === 'premium_creator' ? false : true, // Business accounts are approved by default, ads need approval
          
          // Fields specific to creator types
          official_name: (userType === 'creator' || userType === 'premium_creator') ? formData.officialName : null,
          nickname: (userType === 'creator' || userType === 'premium_creator') ? formData.nickname : null,
          mpesa_number: userType === 'premium_creator' ? formData.mpesaNumber : null,
          date_of_birth: userType === 'creator' ? formData.dateOfBirth : null,

          // Fields specific to business type
          business_name: userType === 'business' ? formData.businessName : null,
          contact_phone: userType === 'business' ? formData.contactPhone : null,
        };

        // 2. Create profile entry in 'profiles' table
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileToInsert]);

        if (profileError) {
          throw profileError;
        }

        console.log('User registered and profile created:', authData.user);
        login(userType, profileToInsert.is_approved); // Use userType for role in login context

        // Redirect based on userType
        if (userType === 'creator') {
          navigate('/user-dashboard');
        } else if (userType === 'premium_creator') {
          navigate('/user-verification');
        } else if (userType === 'business') {
          navigate('/admin-manage-ads'); // Redirect to ad management page for businesses
        }
      } else {
        setError("Registration successful! Please check your email to verify your account before proceeding.");
        // If user is not immediately available, assume pending email verification
        login(userType, userType === 'creator'); // Pass userType and default approval
        if (userType === 'creator') {
          navigate('/user-dashboard');
        } else if (userType === 'premium_creator') {
          navigate('/user-verification');
        } else if (userType === 'business') {
          navigate('/admin-manage-ads'); // Redirect to ad management page for businesses
        }
      }

    } catch (err) {
      setError(err.message || "An unexpected error occurred during registration.");
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFormTitle = () => {
    if (userType === 'creator') return 'Sign Up as Free Creator';
    if (userType === 'premium_creator') return 'Sign Up as Premium Creator';
    if (userType === 'business') return 'Sign Up for a Business Account';
    return 'Sign Up';
  };

  return (
    <div className="signup-form-container">
      <h2 className="signup-title">{getFormTitle()}</h2>
      <p className="signup-tagline">Join Draftey and share your creativity!</p>
      <form onSubmit={handleSubmit} className="signup-form">
        {userType === 'business' ? (
          <>
            <div className="form-group">
              <label htmlFor="businessName">Business Name:</label>
              <input
                type="text"
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                required
                disabled={loading}
              />
              {businessNameError && <p className="error-message">{businessNameError}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="contactPhone">Contact Phone:</label>
              <input
                type="tel"
                id="contactPhone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                required
                disabled={loading}
              />
              {contactPhoneError && <p className="error-message">{contactPhoneError}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="officialName">{userType === 'creator' ? 'Name:' : 'One Mpesa registered Name:'}</label>
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
          </>
        )}
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
        {(userType === 'creator') && (
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
        {(userType === 'premium_creator') && (
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
            <Link to="/terms" className="policy-link">Terms &amp; Conditions</Link> and{' '}
            <Link to="/privacy" className="policy-link">Privacy Policy</Link>
          </label>
        </div>
        {error && <p className="error-message full-width-error">{error}</p>}
        <button
          type="submit"
          className="submit-button"
          disabled={loading || nicknameError || ageError || businessNameError || contactPhoneError || !formData.agreedToTerms}
        >
          {loading ? 'Registering...' : 'Next'}
        </button>
      </form>
    </div>
  );
}

export default UserSignupForm;
