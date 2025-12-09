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
      let wasAuthUserPresent = false; // Flag to track if authUser was successfully retrieved
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('AuthContext: supabase.auth.getUser() result:', authUser);

        if (authUser) {
          wasAuthUserPresent = true; // Set flag
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
            // Fallback to viewer if profile not found or error, but keep user logged in
            setUserType('viewer');
            setIsUserApproved(false);
            localStorage.setItem('userType', 'viewer');
            localStorage.setItem('isUserApproved', 'false');
            setIsLoggedIn(true); // Keep isLoggedIn true if authUser was present
            localStorage.setItem('isLoggedIn', 'true');
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
            // Keep isLoggedIn true if authUser was present
            localStorage.setItem('userType', 'viewer');
            localStorage.setItem('isUserApproved', 'false');
            setIsLoggedIn(true); // Ensure isLoggedIn is true if authUser was present
            localStorage.setItem('isLoggedIn', 'true');
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
        if (wasAuthUserPresent) {
          // An error occurred AFTER authUser was found (likely profile fetch issue)
          setUserType('viewer');
          setIsUserApproved(false);
          localStorage.setItem('userType', 'viewer');
          localStorage.setItem('isUserApproved', 'false');
          setIsLoggedIn(true); // Keep logged in
          localStorage.setItem('isLoggedIn', 'true');
          // Do not clear user or set isLoggedIn to false
        } else {
          // Error before or during authUser retrieval, or authUser was never present
          setUser(null);
          setUserType('viewer');
          setIsUserApproved(false);
          setIsLoggedIn(false);
          localStorage.removeItem('userType');
          localStorage.removeItem('isUserApproved');
          localStorage.removeItem('isLoggedIn');
        }
      } finally {
        console.log('--- AuthContext: Finished fetchCurrentUserProfile ---');
      }
    };

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthContext: Supabase auth state changed event:', _event, 'Session:', session);
      // Only re-fetch profile if an actual session exists or was signed in/refreshed
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || session) {
        fetchCurrentUserProfile();
      } else if (_event === 'SIGNED_OUT') {
        // Explicitly handle sign out to clear all states
        setUser(null);
        setUserType('viewer');
        setIsUserApproved(false);
        setIsLoggedIn(false);
        localStorage.removeItem('userType');
        localStorage.removeItem('isUserApproved');
        localStorage.removeItem('isLoggedIn');
        console.log('AuthContext: Auth state changed to SIGNED_OUT. States cleared.');
      }
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
      // fetchCurrentUserProfile(); // Removed direct call to avoid potential race with onAuthStateChange
    }, 100); 
  };

  // UPDATED: subscribeVisitor now returns a Promise with success/error information
  const subscribeVisitor = async (email, planName) => {
    try {
      const now = new Date();
      let expiryTime;

      if (planName === '1 Day Plan') {
        expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      } else if (planName === '2 Hour Plan') {
        expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      } else {
        console.error("Unknown plan duration provided:", planName);
        return { success: false, error: "Unknown plan duration provided" };
      }

      // Generate a unique transaction reference
      const transactionRef = `KORAPAY_${email.split('@')[0]}_${Date.now()}`;

      // Try to create subscription using a direct SQL query via RPC
      // This approach bypasses RLS policies
      const { error } = await supabase.rpc('create_subscription', {
        p_email: email,
        p_plan: planName,
        p_expiry_time: expiryTime.toISOString(),
        p_transaction_ref: transactionRef
      });

      if (error) {
        console.error('Error creating subscription via RPC:', error);
        
        // Fallback approach: Try to use service role client if available
        // Note: This is a workaround and may need to be adjusted based on your setup
        try {
          // Create a simple POST request to your own backend endpoint that handles this
          const response = await fetch('/api/create-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              planName,
              expiryTime: expiryTime.toISOString(),
              transactionRef
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to create subscription via API');
          }
        } catch (apiError) {
          console.error('Error in API fallback:', apiError);
          return { success: false, error: error.message };
        }
      }

      // Update local state regardless of which method worked
      setIsVisitorSubscribed(true);
      setVisitorEmail(email);
      localStorage.setItem('visitorEmail', email);
      localStorage.setItem('subscriptionExpiryTime', expiryTime.toISOString());
      
      return { success: true };
    } catch (err) {
      console.error('Error in subscribeVisitor:', err);
      return { success: false, error: err.message };
    }
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
    console.log('AuthContext: logout function called from:', new Error().stack); // Added call stack log
    try {
      await supabase.auth.signOut();
      console.log('AuthContext: Supabase sign out successful.');
      // The onAuthStateChange listener will handle clearing states
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
