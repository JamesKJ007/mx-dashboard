export default function TermsPage() {
  const termsText = `
Terms of Service (Beta)

Last Updated: December 15, 2025

Welcome to MyPlane MX (the "Service"), operated by MyPlane ("we," "us," or "our"). By creating an account or using the Service, you agree to these Terms of Service ("Terms").

1. Beta Software Notice
MyPlane MX is provided as beta software for testing and feedback purposes. The Service may contain bugs, errors, or incomplete features and may change, be modified, suspended, or discontinued at any time without notice.
The Service is provided "as is" and "as available", without warranties of any kind, express or implied.

2. Eligibility & Accounts
You must provide accurate and complete information when creating an account.
You are responsible for maintaining the confidentiality of your login credentials.
You are responsible for all activity that occurs under your account.
Accounts are provided on a limited-access basis during beta testing.

3. License & Acceptable Use
We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for its intended purpose.
You agree not to:
- Copy, modify, reverse engineer, decompile, or attempt to extract source code or logic from the Service.
- Share screenshots, recordings, workflows, calculations, benchmarks, or documentation of the Service outside your organization without written permission.
- Use the Service to design, develop, fund, or support a competing product or service.
- Resell, sublicense, or commercially exploit the Service.
- Circumvent security, access controls, or usage limitations.

4. Ownership & Intellectual Property
All software, algorithms, calculations, analytics, benchmarks, designs, interfaces, and content within the Service are the exclusive property of MyPlane.
No rights are granted except as expressly stated in these Terms.

5. User Data & Content
You retain ownership of the data you input into the Service.
By using the Service, you grant MyPlane permission to store, process, analyze, and display this data solely to operate, improve, and support the Service.
During beta testing, data may be modified or removed as part of testing.

6. Admin Access & Monitoring
Designated administrators may have access to aggregated or account-level data for the purposes of support, troubleshooting, analytics, and product improvement.

7. Termination
We may suspend or terminate your access to the Service at any time, with or without notice.

8. Limitation of Liability
To the fullest extent permitted by law, MyPlane shall not be liable for any indirect, incidental, special, consequential, or loss-of-use damages arising out of or related to your use of the Service.

9. Changes to These Terms
We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the updated Terms.

10. Contact
Questions about these Terms may be sent to:
support@myplanemx.com
`;

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Terms of Service</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {termsText}
      </pre>
    </main>
  );
}
