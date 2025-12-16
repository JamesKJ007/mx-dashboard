export default function PrivacyPage() {
  const privacyText = `
Privacy Policy

Last Updated: December 15, 2025

This Privacy Policy explains how MyPlane collects, uses, and protects your information when you use MyPlane MX.

1. Information We Collect
We may collect:
- Account information (name, email address)
- Aircraft information (tail number, make, model, usage data)
- Maintenance and operational data you enter
- Basic usage analytics (logins, feature usage)

2. How We Use Information
We use your information to:
- Operate and maintain the Service
- Improve features and performance
- Provide support and communicate updates
- Analyze aggregated usage trends

We do not sell your personal or aircraft data.

3. Data Sharing
We do not share your data with third parties except:
- When required by law
- With service providers strictly necessary to operate the Service (e.g., hosting and authentication)

4. Data Security
We implement reasonable technical and organizational safeguards to protect your data. However, no system is completely secure.

5. Data Retention & Deletion
You may request deletion of your account and associated data by contacting support@myplanemx.com.
During beta testing, data may be deleted or modified as part of testing or system changes.

6. Children’s Privacy
The Service is not intended for individuals under the age of 13.

7. Changes to This Policy
We may update this Privacy Policy at any time. Continued use of the Service constitutes acceptance of the updated policy.

8. Contact
Questions about this Privacy Policy may be sent to:
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
