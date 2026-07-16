import { PageSEO } from "@/components/page-seo";

export default function Terms() {
  const lastUpdated = "July 16, 2025";

  return (
    <>
      <PageSEO
        title="Terms of Service"
        description="Read the terms and conditions for using xtraWordinary."
        path="/terms"
      />
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using xtraWordinary (the "Service"), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
              You may use the Service as a guest without an account, but creating an account
              constitutes additional acceptance of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
            <p>
              You must be at least 13 years old to create an account. By registering, you confirm
              that you meet this requirement. If you are under 18, you represent that you have
              permission from a parent or guardian to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Your Account</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must provide accurate information when creating your account.</li>
              <li>You may not create more than one account or impersonate another person.</li>
              <li>Notify us immediately if you suspect unauthorised access to your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use bots, scripts, or automated tools to play games or manipulate scores.</li>
              <li>Exploit bugs or vulnerabilities to gain an unfair advantage.</li>
              <li>Harass, abuse, or threaten other users.</li>
              <li>Post offensive, defamatory, or illegal content in comments or your display name.</li>
              <li>Attempt to interfere with or disrupt the Service or its servers.</li>
              <li>Use the Service for any unlawful purpose.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or permanently ban accounts that violate these rules,
              with or without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Scores and Leaderboards</h2>
            <p>
              Scores submitted to the global leaderboard must reflect genuine gameplay. We reserve
              the right to remove scores that appear to be the result of cheating, exploits, or
              automated play. Leaderboard positions and rankings are provided for entertainment
              purposes and carry no monetary value.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Premium Subscriptions</h2>
            <p className="mb-3">
              xtraWordinary offers optional Premium features available through a paid subscription.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Subscriptions are billed on the cycle displayed at the time of purchase.</li>
              <li>You may cancel your subscription at any time. Access continues until the end of the current billing period.</li>
              <li>We do not offer refunds for partial billing periods unless required by applicable law.</li>
              <li>We reserve the right to change Premium pricing with reasonable advance notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. User Content</h2>
            <p>
              You retain ownership of comments and other content you post on the Service. By
              posting content, you grant us a non-exclusive, royalty-free licence to display that
              content as part of operating the Service. You are solely responsible for the content
              you post and its legality. We may remove content that violates these terms or that
              is reported by other users as inappropriate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p>
              All game designs, artwork, code, and content created by xtraWordinary are our
              property and protected by applicable intellectual property laws. You may not
              reproduce, distribute, or create derivative works from any part of the Service
              without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disclaimers</h2>
            <p>
              The Service is provided "as is" without warranties of any kind, express or implied.
              We do not guarantee that the Service will be uninterrupted, error-free, or free of
              harmful components. Game scores and data may be lost in the event of technical
              failures, though we make reasonable efforts to prevent data loss.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, xtraWordinary shall not be liable for any
              indirect, incidental, special, or consequential damages arising from your use of or
              inability to use the Service, even if we have been advised of the possibility of
              such damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will update the "last updated" date
              at the top of this page. Continued use of the Service after changes take effect
              constitutes your acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
            <p>
              Questions about these Terms can be directed to us via the{" "}
              <a href="/about" className="text-primary underline underline-offset-4">About page</a>.
            </p>
          </section>

        </div>
      </div>
    </>
  );
}
