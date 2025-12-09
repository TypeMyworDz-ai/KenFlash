import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import ForgotPasswordPage from './pages/ForgotPasswordPage'; // FIXED: Corrected import path
import UserDashboardPage from './pages/UserDashboardPage';
import UserProfileViewPage from './pages/UserProfileViewPage';
import SingleContentPage from './pages/SingleContentPage';
import SubscriptionPage from './pages/SubscriptionPage';
import UserPendingApprovalPage from './pages/UserPendingApprovalPage';
import UploadContentPage from './pages/UploadContentPage';
import ChooseUploadTypePage from './pages/ChooseUploadTypePage';
import MyViewsPage from './pages/MyViewsPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
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
import AdCampaignManagementPage from './pages/AdCampaignManagementPage';
import PayForAdPage from './pages/PayForAdPage';
import MobileUploadContentPage from './pages/MobileUploadContentPage'; 
import { Capacitor } from '@capacitor/core';


function TrafficLogger() {
  const location = useLocation();
  const { user, isVisitorSubscribed, visitorEmail, userType } = useAuth(); 

  useEffect(() => {
    const logTraffic = async () => {
      try {
        const { data: authUser } = await supabase.auth.getUser();

        const userId = authUser.user?.id || null;
        const email = authUser.user?.email || visitorEmail || null;
        const subscribedStatus = isVisitorSubscribed || (user?.id && userType === 'creator'); 

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
  }, [location.pathname, location.search, user, isVisitorSubscribed, visitorEmail, userType]); 

  return null;
}

function App() {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(Capacitor.isNativePlatform('android'));
  }, []);

  const CurrentNavbar = isAndroid ? MobileNavbar : Navbar;
  const CurrentHomePage = isAndroid ? MobileHomePage : HomePage;

  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
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
                <Route path="/upload-content" element={<UploadContentPage />} /> 
                <Route path="/my-views" element={<MyViewsPage />} />
                <Route path="/my-content" element={<MyContentPage />} />
                <Route path="/profile-settings" element={<ProfileSettingsPage />} />
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/messages" element={<CreatorMessagesPage />} />
                <Route path="/admin-messages" element={<AdminMessagesPage />} />
                <Route path="/admin-traffic" element={<AdminTrafficPage />} />
                <Route path="/ad-campaign-management" element={<AdCampaignManagementPage />} />
                <Route path="/profile/:userId" element={<UserProfileViewPage />} />
                <Route path="/content/:contentId" element={<SingleContentPage />} />
                <Route path="/subscribe" element={<SubscriptionPage />} />
                <Route path="/pay-for-ad/:campaignId" element={<PayForAdPage />} />
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
                <Route path="/mobile-upload-content" element={<MobileUploadContentPage />} />
              </Routes>
            </div>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
