export default function PrivacyPage() {
  const privacyText = `
Privacy Policy — MyPlaneMX

Effective Date: December 21, 2025
Last Updated: December 21, 2025

This Privacy Policy explains how MyPlaneMX ("MyPlaneMX," "we," "us," or "our") collects, uses, and protects your information when you use the MyPlaneMX website and web application (the "Service").

1. Information We Collect

A. Information You Provide
We may collect information you voluntarily provide, including:
- Account information (such as email address)
- Aircraft information (tail number, make, model, year)
- Maintenance, operational, and cost data you enter into the Service

B. Information Collected Automatically
When you use the Service, we may automatically collect:
- Usage data (pages viewed, features used)
- Device and browser information
- IP address and approximate location
- Authentication and session data
- Cookies or similar technologies used for login and performance

C. Payment Information
If paid subscriptions are offered, payments are processed by third-party payment providers. MyPlaneMX does not store full payment card details.

2. How We Use Information
We use collected information to:
- Operate, maintain, and provide the Service
- Display analytics, dashboards, and summaries based on your data
- Improve features, performance, and reliability
- Communicate with you regarding updates, support, or service notices
- Monitor usage, prevent abuse, and maintain security
- Comply with legal obligations

We do not sell your personal or aircraft data.

3. Data Sharing
We do not share your data with third parties except in the following limited circumstances:
- With service providers necessary to operate the Service (such as hosting, authentication, and database providers)
- When required by law, subpoena, or legal process
- To protect the rights, safety, or security of MyPlaneMX or users
- As part of a merger, acquisition, or asset sale (with notice where required)

4. Data Security
We implement reasonable administrative, technical, and organizational safeguards to protect your information. However, no system is completely secure, and we cannot guarantee absolute security.

5. Data Retention and Deletion
We retain your information for as long as necessary to provide the Service and comply with legal obligations.
You may request deletion of your account and associated data by contacting:
support@myplanemx.com

During beta testing, data may be modified or deleted as part of testing, debugging, or system changes.

6. Cookies and Similar Technologies
We use cookies or local storage to:
- Keep you logged in
- Remember preferences
- Improve performance and reliability

You may control cookies through your browser settings, though some features may not function correctly if disabled.

7. Children’s Privacy
The Service is not intended for children under the age of 13. We do not knowingly collect personal information from children.

8. Changes to This Privacy Policy
We may update this Privacy Policy from time to time. The "Last Updated" date will reflect changes. Continued use of the Service after updates constitutes acceptance of the revised policy.

9. Contact
If you have questions about this Privacy Policy or your data, contact:
support@myplanemx.com
`;

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Privacy Policy</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {privacyText}
      </pre>
    </main>
  );
}
