export default function TermsPage() {
  const termsText = `
Terms of Service — MyPlaneMX

Effective Date: December 21, 2025
Last Updated: December 21, 2025

These Terms of Service ("Terms") govern your access to and use of the MyPlaneMX website, web application, and related services (collectively, the "Service"). The Service is operated by MyPlaneMX ("MyPlaneMX," "we," "us," or "our").

By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

1. Eligibility
You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service. By using the Service, you represent that you meet this requirement.

2. Accounts
You may be required to create an account to use the Service. You agree to provide accurate, current information and to keep it updated.
You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.

3. Nature of the Service (Informational Only)
MyPlaneMX provides tools for tracking, organizing, and analyzing aircraft-related cost and maintenance data you enter.
The Service does NOT provide:
- Aircraft maintenance advice
- Airworthiness determinations
- FAA regulatory or compliance guidance
- Legal, financial, or tax advice

You are solely responsible for verifying accuracy, ensuring compliance, and making all operational and maintenance decisions.

4. License and Acceptable Use
We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for its intended purpose.

You agree NOT to:
- Copy, modify, reverse engineer, decompile, or attempt to extract source code, algorithms, or logic
- Share screenshots, recordings, workflows, benchmarks, calculations, or documentation outside your organization without written permission
- Use the Service to build, fund, or support a competing product or service
- Resell, sublicense, or commercially exploit the Service
- Circumvent security measures, access controls, or usage limits

5. Intellectual Property
All software, designs, interfaces, algorithms, analytics, benchmarks, and content within the Service (excluding your data) are the exclusive property of MyPlaneMX and are protected by intellectual property laws.
No rights are granted except as expressly stated in these Terms.

6. User Data
You retain ownership of the data you enter into the Service.
By using the Service, you grant MyPlaneMX a limited license to host, store, process, analyze, and display your data solely to operate, support, and improve the Service.

7. Admin Access and Monitoring
Authorized administrators may access aggregated or account-level data for the purposes of:
- Customer support
- Troubleshooting
- Analytics
- Product improvement

8. Termination
You may stop using the Service at any time.
We may suspend or terminate access to the Service if you violate these Terms or if your use poses risk to the Service, other users, or MyPlaneMX.

9. Disclaimer of Warranties
THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."
TO THE MAXIMUM EXTENT PERMITTED BY LAW, MYPLANEMX DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
We do not guarantee uninterrupted access or error-free operation.

10. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, MYPLANEMX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR LOSS-OF-USE DAMAGES ARISING FROM OR RELATED TO THE SERVICE.
IN NO EVENT SHALL MYPLANEMX’S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE PRIOR 12 MONTHS (OR $100 IF NO FEES WERE PAID).

11. Changes to These Terms
We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.

12. Governing Law
These Terms are governed by the laws of the United States and the state in which MyPlaneMX operates, without regard to conflict-of-law principles.

13. Contact
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
