import { PageSEO } from "@/components/page-seo";

export default function Privacy() {
  const lastUpdated = "August 27, 2026";

  return (
    <>
      <PageSEO
        title="Privacy Policy"
        description="Learn how xtraWordinary collects, uses, and protects your personal information."
        path="/privacy"
      />
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
            <p>
              xtraWordinary is a web-based vocabulary and word games platform. We offer a collection
              of interactive word games for entertainment and vocabulary improvement. This policy
              explains what information we collect when you use the site and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-medium mb-2">If you play as a guest (no account)</h3>
            <p className="mb-4">
              Your game statistics and progress are stored locally in your browser. We also collect
              limited first-party usage counts using random visitor and session identifiers so we
              can understand site visits, game starts, and completed games. These identifiers do
              not contain your name, email address, or raw IP address.
            </p>
            <h3 className="text-base font-medium mb-2">If you create an account</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li><strong>Email address</strong> — used to identify your account and send verification or password reset emails.</li>
              <li><strong>Display name</strong> — shown on leaderboards and your public profile.</li>
              <li><strong>Password</strong> — stored as a one-way hash (bcrypt). We never store or transmit your plaintext password.</li>
              <li><strong>Game data</strong> — scores, achievements, streaks, and statistics associated with your account.</li>
            </ul>
            <h3 className="text-base font-medium mb-2">If you sign in with Google</h3>
            <p>
              We receive your name and email address from Google. No other Google account data is
              accessed. We do not post to your Google account on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To create and manage your account.</li>
              <li>To display your scores on leaderboards and your public profile.</li>
              <li>To send transactional emails (account verification, password resets). We do not send marketing emails.</li>
              <li>To track your progress, streaks, and achievements across sessions.</li>
              <li>To enable social features such as friend challenges, groups, and multiplayer duels.</li>
              <li>To measure daily visitors, sessions, registrations, game starts, and game completion rates so we can improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Cookies and Sessions</h2>
            <p>
              We use a session cookie to keep you signed in between visits. This cookie contains
              only a session identifier — no personal data. It expires when you log out or after
              a period of inactivity. For first-party usage counts, we store a random visitor
              identifier and a random session identifier in secure, first-party cookies. These
              cookies are not readable by page scripts. A new analytics session begins after 30
              minutes of inactivity. We do not use
              third-party analytics, tracking pixels, or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limited Usage Analytics</h2>
            <p>
              Our first-party analytics record the page route, event time, game name and play mode
              for game starts and completions, and whether a registration succeeded. We do not
              record answer text, keystrokes, raw IP addresses, detailed device profiles, or
              individual click streams. Reports are available only to administrators and are
              grouped using UTC calendar days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Sharing</h2>
            <p className="mb-3">
              We do not sell, rent, or share your personal information with third parties for
              marketing purposes. We share data only in the following limited circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Email delivery (Resend)</strong> — your email address is passed to Resend solely to deliver transactional emails you requested.</li>
              <li><strong>Google OAuth</strong> — if you use Google sign-in, authentication is handled directly between your browser and Google.</li>
              <li><strong>Payment processing</strong> — if you purchase a Premium subscription, payment is processed by our payment provider. We do not store your card details.</li>
              <li><strong>Legal requirements</strong> — we may disclose information if required by law or to protect the safety of users.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Public Information</h2>
            <p>
              Your display name, scores, and achievements may be visible to other users on
              leaderboards, group pages, and your public profile. Comments you post in the app
              are visible to other users. If you want to keep your activity private, you can
              play as a guest without creating an account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you would like
              your account and associated data deleted, please contact us and we will process your
              request promptly. Raw first-party analytics events are kept for no more than 730 days
              (approximately 24 months) and are automatically deleted after the configured retention
              period. Administrator reports and CSV exports contain aggregate counts rather than raw
              visitor or session identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Security</h2>
            <p>
              We take reasonable steps to protect your information, including password hashing,
              encrypted connections (HTTPS), and HTTP security headers. No method of transmission
              or storage is 100% secure, but we work to maintain industry-standard protections.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
            <p>
              xtraWordinary is not directed at children under 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has provided
              us with personal information, please contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. The "last updated" date at the top of
              this page will reflect any changes. Continued use of the site after changes
              constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
            <p>
              If you have questions about this privacy policy or how your data is handled, please
              reach out via the contact information on our{" "}
              <a href="/about" className="text-primary underline underline-offset-4">About page</a>.
            </p>
          </section>

        </div>
      </div>
    </>
  );
}
