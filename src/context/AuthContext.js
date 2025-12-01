import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const storedLoginStatus = localStorage.getItem('isLoggedIn');
    return storedLoginStatus === 'true';
  });

  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(() => { 
    return localStorage.getItem('userType') || 'viewer';
  });

  const [isUserApproved, setIsUserApproved] = useState(() => {
    const storedApprovalStatus = localStorage.getItem('isUserApproved');
    return storedApprovalStatus === 'true';
  });

  const [isVisitorSubscribed, setIsVisitorSubscribed] = useState(false);
  const [visitorEmail, setVisitorEmail] = useState(() => {
    return localStorage.getItem('visitorEmail') || null;
  });

  // Check subscription validity on app load
  useEffect(() => {
    const checkSubscriptionValidity = async () => {
      const storedEmail = localStorage.getItem('visitorEmail');
      const storedExpiryTime = localStorage.getItem('subscriptionExpiryTime');

      if (storedEmail && storedExpiryTime) {
        const expiryTime = new Date(storedExpiryTime);
        const now = new Date();

        if (now < expiryTime) {
          setVisitorEmail(storedEmail);
          setIsVisitorSubscribed(true);
        } else {
          localStorage.removeItem('visitorEmail');
          localStorage.removeItem('subscriptionExpiryTime');
          setIsVisitorSubscribed(false);
          setVisitorEmail(null);
        }
      }
    };

    checkSubscriptionValidity();
  }, []);

  // Fetch current user and their profile (including user_type) on app load or auth state change
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      console.log('--- AuthContext: Starting fetchCurrentUserProfile ---');
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('AuthContext: supabase.auth.getUser() result:', authUser);

        if (authUser) {
          setUser(authUser);
          console.log('AuthContext: Authenticated user ID:', authUser.id);
          
          // Fetch user's profile to get user_type and is_approved status
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('user_type, is_approved')
            .eq('id', authUser.id)
            .single();

          console.log('AuthContext: Profile fetch result:', { data: profile, error: profileError });

          if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
            console.error('AuthContext: Error fetching user profile from DB:', profileError.message);
            // Fallback to viewer if profile not found or error
            setUserType('viewer');
            setIsUserApproved(false);
            setIsLoggedIn(false); // If profile fetching fails, assume not fully logged in
            localStorage.removeItem('isLoggedIn');
          } else if (profile) {
            console.log('AuthContext: Fetched profile user_type:', profile.user_type);
            console.log('AuthContext: Fetched profile is_approved:', profile.is_approved);
            
            setUserType(profile.user_type);
            setIsUserApproved(profile.is_approved);
            localStorage.setItem('userType', profile.user_type);
            localStorage.setItem('isUserApproved', profile.is_approved.toString());
            setIsLoggedIn(true); // Ensure isLoggedIn is true if user is found
            localStorage.setItem('isLoggedIn', 'true');
          } else {
            console.warn('AuthContext: No profile found for authenticated user. Defaulting to viewer.');
            setUserType('viewer');
            setIsUserApproved(false);
            setIsLoggedIn(false);
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userType');
            localStorage.removeItem('isUserApproved');
          }
        } else {
          console.log('AuthContext: No authenticated user found. Clearing states.');
          // No authenticated user, clear states
          setUser(null);
          setUserType('viewer');
          setIsUserApproved(false);
          setIsLoggedIn(false);
          localStorage.removeItem('userType');
          localStorage.removeItem('isUserApproved');
          localStorage.removeItem('isLoggedIn');
        }
      } catch (err) {
        console.error('AuthContext: Error during initial user/profile fetch (catch block):', err.message);
        // Ensure states are reset on error
        setUser(null);
        setUserType('viewer');
        setIsUserApproved(false);
        setIsLoggedIn(false);
        localStorage.removeItem('userType');
        localStorage.removeItem('isUserApproved');
        localStorage.removeItem('isLoggedIn');
      } finally {
        console.log('--- AuthContext: Finished fetchCurrentUserProfile ---');
      }
    };

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthContext: Supabase auth state changed event:', _event, 'Session:', session);
      fetchCurrentUserProfile(); // Re-fetch profile on auth state change
    });
    
    fetchCurrentUserProfile(); // Initial fetch on component mount

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array means this runs once on mount and handles its own updates

  const login = async (type, approvedStatus = false) => { // Made login async
    console.log('AuthContext: login function called with type:', type, 'approvedStatus:', approvedStatus);
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
    setUserType(type);
    localStorage.setItem('userType', type);
    setIsUserApproved(approvedStatus);
    localStorage.setItem('isUserApproved', approvedStatus.toString());
    
    // After login, immediately trigger a profile fetch to ensure state is fully consistent
    // A small delay might be needed to ensure session is fully established
    setTimeout(() => {
      console.log('AuthContext: Triggering profile refetch after login...');
      // This will be handled by the onAuthStateChange listener, but a direct call can be a fallback
      // Alternatively, the onAuthStateChange listener is typically sufficient
    }, 100); 
  };

  const subscribeVisitor = (email, planName) => {
    const now = new Date();
    let expiryTime;

    if (planName === '1 Day Plan') {
      expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    } else {
      console.error("Unknown plan duration provided:", planName);
      return;
    }

    setIsVisitorSubscribed(true);
    setVisitorEmail(email);
    localStorage.setItem('visitorEmail', email);
    localStorage.setItem('subscriptionExpiryTime', expiryTime.toISOString());
  };

  const checkExistingSubscription = async (email) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('email', email)
        .gt('expiry_time', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setIsVisitorSubscribed(true);
        setVisitorEmail(email);
        localStorage.setItem('visitorEmail', email);
        localStorage.setItem('subscriptionExpiryTime', data.expiry_time);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error checking existing subscription:', err);
      return false;
    }
  };

  const logout = async () => {
    console.log('AuthContext: logout function called.');
    try {
      await supabase.auth.signOut();
      console.log('AuthContext: Supabase sign out successful.');
      // Clear all auth-related states and local storage
      setIsLoggedIn(false);
      localStorage.removeItem('isLoggedIn');
      setUserType('viewer');
      localStorage.removeItem('userType');
      setIsUserApproved(false);
      localStorage.removeItem('isUserApproved');
      setUser(null);
      setIsVisitorSubscribed(false);
      setVisitorEmail(null);
      localStorage.removeItem('visitorEmail');
      localStorage.removeItem('subscriptionExpiryTime');
    } catch (error) {
      console.error('AuthContext: Error during Supabase sign out:', error.message);
      // Even if Supabase sign out fails, clear local state for a clean logout experience
      setIsLoggedIn(false);
      localStorage.removeItem('isLoggedIn');
      setUserType('viewer');
      localStorage.removeItem('userType');
      setIsUserApproved(false);
      localStorage.removeItem('isUserApproved');
      setUser(null);
      setIsVisitorSubscribed(false);
      setVisitorEmail(null);
      localStorage.removeItem('visitorEmail');
      localStorage.removeItem('subscriptionExpiryTime');
    } finally {
      console.log('AuthContext: Logout process finished.');
    }
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, userType, isUserApproved, isVisitorSubscribed, visitorEmail, login, subscribeVisitor, checkExistingSubscription, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
