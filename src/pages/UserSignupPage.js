import React from 'react';
import UserSignupForm from '../components/UserSignupForm'; // Ensure this import path is correct and it's importing UserSignupForm

function UserSignupPage() {
  return (
    <div>
      <h2>User Sign Up</h2>
      <p>Join KenyaFlashing as a content creator.</p>
      <UserSignupForm /> {/* This should render the UserSignupForm */}
    </div>
  );
}

export default UserSignupPage;
