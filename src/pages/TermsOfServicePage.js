import React from 'react';
import './TermsOfServicePage.css'; // We'll create this CSS file next

function TermsOfServicePage() {
  return (
    <div className="terms-container">
      <h1>Terms of Service</h1>
      <p className="last-updated">Last Updated: November 2025</p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using KenyaFlashing ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to any part of these terms, please do not use the Platform.
        </p>
      </section>

      <section>
        <h2>2. User Accounts and Registration</h2>
        <p>
          To create a content creator account, you must provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
        </p>
      </section>

      <section>
        <h2>3. Content Creator Responsibilities</h2>
        <p>
          As a content creator on KenyaFlashing, you agree to:
        </p>
        <ul>
          <li>Upload only original content that you own or have the right to distribute.</li>
          <li>Comply with all applicable laws and regulations.</li>
          <li><strong>NOT post naked, sexually explicit, or pornographic photos or videos.</strong></li>
          <li>NOT post content that is violent, hateful, discriminatory, or promotes illegal activities.</li>
          <li>NOT post content that violates the privacy or intellectual property rights of others.</li>
          <li>NOT engage in harassment, bullying, or abusive behavior toward other users.</li>
        </ul>
      </section>

      <section>
        <h2>4. Content Moderation and Removal</h2>
        <p>
          KenyaFlashing reserves the right to review, moderate, and remove any content that violates these Terms of Service. We may also suspend or terminate accounts that repeatedly violate our policies.
        </p>
      </section>

      <section>
        <h2>5. Subscription and Payments</h2>
        <p>
          Subscriptions are non-refundable. By subscribing, you authorize KenyaFlashing to charge your payment method for the selected plan. Subscription plans include:
        </p>
        <ul>
          <li>5-Hour Plan: USD 1</li>
          <li>1-Week Plan: USD 10</li>
          <li>1-Month Plan: USD 20</li>
        </ul>
      </section>

      <section>
        <h2>6. Earnings and Payouts</h2>
        <p>
          Content creators earn money based on the number of views their content receives. The rate is 10 KES per 1000 views. Earnings are calculated monthly and paid via M-Pesa. KenyaFlashing reserves the right to modify the payment structure with 30 days' notice.
        </p>
      </section>

      <section>
        <h2>7. Intellectual Property Rights</h2>
        <p>
          You retain all rights to your original content. By uploading content to KenyaFlashing, you grant the Platform a non-exclusive license to display, distribute, and promote your content to subscribers.
        </p>
      </section>

      <section>
        <h2>8. Limitation of Liability</h2>
        <p>
          KenyaFlashing is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform.
        </p>
      </section>

      <section>
        <h2>9. Dispute Resolution</h2>
        <p>
          Any disputes arising from these Terms of Service shall be governed by the laws of Kenya and resolved through arbitration or mediation.
        </p>
      </section>

      <section>
        <h2>10. Changes to Terms</h2>
        <p>
          KenyaFlashing reserves the right to modify these Terms of Service at any time. Changes will be effective upon posting to the Platform. Your continued use of the Platform constitutes acceptance of the modified terms.
        </p>
      </section>

      <section>
        <h2>11. Contact Us</h2>
        <p>
          If you have questions about these Terms of Service, please contact us at support@kenyaflashing.com.
        </p>
      </section>
    </div>
  );
}

export default TermsOfServicePage;
