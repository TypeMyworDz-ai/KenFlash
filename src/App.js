import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext'; // Import ThemeProvider
import { supabase } from './supabaseClient';
import './App.css';
import Navbar from './components/Navbar';
import MobileNavbar from './components/MobileNavbar';
import HomePage from './pages/HomePage';
import MobileHomePage from './pages/MobileHomePage';
import LoginPage from './pages/LoginPage';
import UserSignupPage from './pages/UserSignupPage';
import UserVerificationPage from './pages/UserVerificationPage';
import UserSignupSuccessPage from './pages/UserSignupSuccessPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import UserDashboardPage from './pages/UserDashboardPage';
import UserProfileViewPage from './pages/UserProfileViewPage';
import SubscriptionPage from './pages/SubscriptionPage';
import PaystackCallback from './pages/PaystackCallback';
import UserPendingApprovalPage from './pages/UserPendingApprovalPage';
import UploadPhotosPage from './pages/UploadPhotosPage';
import UploadVideosPage from './pages/UploadVideosPage';
import ChooseUploadTypePage from './pages/ChooseUploadTypePage';
import MyViewsPage from './pages/MyViewsPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import CreatorPhotosPage from './pages/CreatorPhotosPage';
import CreatorVideosPage from './pages/CreatorVideosPage';
import PaymentHistoryPage from './pages/PaymentHistoryPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import MyProfilePage from './pages/MyProfilePage';
import CreatorMessagesPage from './pages/CreatorMessagesPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminContentModerationPage from './pages/AdminContentModerationPage';
import AdminPendingCreatorsPage from './pages/AdminPendingCreatorsPage';
import AdminManageViewersPage from './pages/AdminManageViewersPage';
import MyContentPage from './pages/MyContentPage';
import AdminViewCreatorProfilePage from './pages/AdminViewCreatorProfilePage';
import AdminAllCreatorsPage from './pages/AdminAllCreatorsPage';
import AdminCreatorContentPage from './pages/AdminCreatorContentPage';
import AdminPaymentOverviewsPage from './pages/AdminPaymentOverviewsPage';
import AdminMessagesPage from './pages/AdminMessagesPage';
import AdminTrafficPage from './pages/AdminTrafficPage';
import AdminManageAdsPage from './pages/AdminManageAdsPage';
import { Capacitor } from '@capacitor/core';


// Component to handle traffic logging
function TrafficLogger() {
  const location = useLocation();
  const { user, isVisitorSubscribed, visitorEmail } = useAuth();

  useEffect(() => {
    const logTraffic = async () => {
      try {
        const { data: authUser } = await supabase.auth.getUser();

        const userId = authUser.user?.id || null;
        const email = authUser.user?.email || visitorEmail || null;
        const subscribedStatus = isVisitorSubscribed || (user?.id && user?.role === 'creator');

        await supabase.from('traffic_logs').insert({
          user_id: userId,
          viewer_email: email,
          page_path: location.pathname + location.search,
          is_subscribed: subscribedStatus,
          visited_at: new Date().toISOString(),
        });
        console.log('Traffic logged for path:', location.pathname);
      } catch (error) {
        console.error('Error logging traffic:', error.message);
      }
    };

    logTraffic();
  }, [location.pathname, location.search, user, isVisitorSubscribed, visitorEmail]);

  return null;
}

function App() {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(Capacitor.isNativePlatform('android'));
  }, []);

  // Determine which Navbar to render
  const CurrentNavbar = isAndroid ? MobileNavbar : Navbar;
  // Determine which HomePage to render
  const CurrentHomePage = isAndroid ? MobileHomePage : HomePage;

  return (
    <Router>
      <AuthProvider>
        <ThemeProvider> {/* Wrap the entire application with ThemeProvider */}
          <div className="App">
            <CurrentNavbar />
            <div className="content">
              <TrafficLogger />
              <Routes>
                <Route path="/" element={<CurrentHomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/user-signup" element={<UserSignupPage />} />
                <Route path="/user-verification" element={<UserVerificationPage />} />
                <Route path="/user-signup-success" element={<UserSignupSuccessPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/user-dashboard" element={<UserDashboardPage />} />
                <Route path="/choose-upload-type" element={<ChooseUploadTypePage />} />
                <Route path="/upload-photos" element={<UploadPhotosPage />} />
                <Route path="/upload-videos" element={<UploadVideosPage />} />
                <Route path="/my-views" element={<MyViewsPage />} />
                <Route path="/my-content" element={<MyContentPage />} />
                <Route path="/profile-settings" element={<ProfileSettingsPage />} />
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/messages" element={<CreatorMessagesPage />} />
                <Route path="/admin-messages" element={<AdminMessagesPage />} />
                <Route path="/admin-traffic" element={<AdminTrafficPage />} />
                <Route path="/admin-manage-ads" element={<AdminManageAdsPage />} />
                <Route path="/profile/:userId" element={<UserProfileViewPage />} />
                <Route path="/profile/:userId/photos" element={<CreatorPhotosPage />} />
                <Route path="/profile/:userId/videos" element={<CreatorVideosPage />} />
                <Route path="/subscribe" element={<SubscriptionPage />} />
                <Route path="/paystack-callback" element={<PaystackCallback />} />
                <Route path="/user-pending-approval" element={<UserPendingApprovalPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/payment-history" element={<PaymentHistoryPage />} />
                <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin-content-moderation" element={<AdminContentModerationPage />} />
                <Route path="/admin-pending-creators" element={<AdminPendingCreatorsPage />} />
                <Route path="/admin-manage-viewers" element={<AdminManageViewersPage />} />
                <Route path="/admin-creator-profile/:creatorId" element={<AdminViewCreatorProfilePage />} />
                <Route path="/admin-all-creators" element={<AdminAllCreatorsPage />} />
                <Route path="/admin-creator-content/:creatorId" element={<AdminCreatorContentPage />} />
                <Route path="/admin-payment-overviews" element={<AdminPaymentOverviewsPage />} />
              </Routes>
            </div>
          </div>
        </ThemeProvider> {/* End of ThemeProvider */}
      </AuthProvider>
    </Router>
  );
}

export default App;
