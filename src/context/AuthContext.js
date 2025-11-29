import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const storedLoginStatus = localStorage.getItem('isLoggedIn');
    return storedLoginStatus === 'true';
  });

  const [user, setUser] = useState(null);

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || 'none';
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
          // Subscription is still valid
          setVisitorEmail(storedEmail);
          setIsVisitorSubscribed(true);
        } else {
          // Subscription has expired
          localStorage.removeItem('visitorEmail');
          localStorage.removeItem('subscriptionExpiryTime');
          setIsVisitorSubscribed(false);
          setVisitorEmail(null);
        }
      }
    };

    checkSubscriptionValidity();
  }, []);

  // Fetch current user on app load
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUser(authUser);
        }
      } catch (err) {
        console.error('Error fetching current user:', err.message);
      }
    };

    fetchCurrentUser();
  }, []);

  const login = (role, approvedStatus = false) => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
    setUserRole(role);
    localStorage.setItem('userRole', role);
    setIsUserApproved(approvedStatus);
    localStorage.setItem('isUserApproved', approvedStatus.toString());
  };

  const subscribeVisitor = (email, planName) => {
    const now = new Date();
    let expiryTime;

    // Handle the '1 Day Plan' specifically
    if (planName === '1 Day Plan') {
      expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    } else {
      // Fallback or error handling for unknown plan names
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

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means "no rows found"

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

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setUserRole('none');
    localStorage.removeItem('userRole');
    setIsUserApproved(false);
    localStorage.removeItem('isUserApproved');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, userRole, isUserApproved, isVisitorSubscribed, visitorEmail, login, subscribeVisitor, checkExistingSubscription, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
