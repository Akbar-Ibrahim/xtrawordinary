/**
 * Share routes — server-side HTML pages returned for social sharing bots.
 *
 * /share/challenge/:challengeId
 *   Looks up the challenge and sender name, emits a minimal HTML page with
 *   personalised Open Graph / Twitter Card meta tags, then redirects the
 *   actual visitor to the live game URL with the challenge parameter.
 */

import type { Express } from "express";
import { storage } from "../storage";
import { gamesData } from "../game-data";
import { SITE_NAME, SITE_BASE_URL } from "../seo";

// Build a slug → game lookup once at module load.
const gameBySlug = new Map(gamesData.map((g) => [g.slug, g]));

/** Escape a string for safe use inside an HTML attribute value or text node. */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build a minimal HTML page that:
 *  1. Presents personalised OG / Twitter Card meta tags to social crawlers.
 *  2. Immediately redirects human visitors to the game URL.
 */
function buildSharePage(opts: {
  title: string;
  description: string;
  ogImage: string;
  canonicalUrl: string;
  redirectUrl: string;
}): string {
  const { title, description, ogImage, canonicalUrl, redirectUrl } = opts;
  const e = esc;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${e(title)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${e(title)}" />
  <meta property="og:description" content="${e(description)}" />
  <meta property="og:image" content="${e(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="675" />
  <meta property="og:url" content="${e(canonicalUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${e(SITE_NAME)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${e(title)}" />
  <meta name="twitter:description" content="${e(description)}" />
  <meta name="twitter:image" content="${e(ogImage)}" />

  <!-- Redirect human visitors immediately -->
  <meta http-equiv="refresh" content="0; url=${e(redirectUrl)}" />
  <link rel="canonical" href="${e(canonicalUrl)}" />

  <script>
    // Instant JS redirect (before the meta-refresh fires).
    window.location.replace(${JSON.stringify(redirectUrl)});
  </script>
</head>
<body>
  <p>Redirecting you to the challenge… <a href="${e(redirectUrl)}">Click here</a> if nothing happens.</p>
</body>
</html>`;
}

export function registerShareRoutes(app: Express): void {
  /**
   * GET /share/challenge/:challengeId
   *
   * Social crawlers receive a personalised OG preview:
   *   "Alex challenged you to Letter Hunt! Can you beat their score?"
   *
   * Human visitors are immediately redirected to:
   *   /game/:slug?challenge=:challengeId
   */
  app.get("/share/challenge/:challengeId", async (req, res) => {
    const id = parseInt(req.params.challengeId, 10);
    if (isNaN(id) || id <= 0) {
      return res.redirect("/duels");
    }

    try {
      const challenge = await storage.getFriendChallenge(id);

      // Unknown challenge — fall back to duels lobby.
      if (!challenge) {
        return res.redirect("/duels");
      }

      // Non-pending challenges (completed, declined, cancelled) are no longer
      // active invitations — redirect directly to the game so users can still
      // view the result, but don't show a misleading "you've been challenged" preview.
      if (challenge.status !== "pending") {
        return res.redirect(`/game/${challenge.gameSlug}?challenge=${id}`);
      }

      const gameRedirectUrl = `/game/${challenge.gameSlug}?challenge=${id}`;

      // Look up game and sender in parallel.
      const [sender, game] = await Promise.all([
        storage.getUserById(challenge.senderId),
        Promise.resolve(gameBySlug.get(challenge.gameSlug)),
      ]);

      const senderName = sender?.name ?? "Someone";
      const gameName = game?.name ?? challenge.gameSlug;
      const ogImagePath = game?.ogImage ?? null;
      const ogImage = ogImagePath
        ? `${SITE_BASE_URL}${ogImagePath}`
        : `${SITE_BASE_URL}/og-image.png`;

      const title = `${senderName} challenged you to ${gameName}! | ${SITE_NAME}`;
      const description = `Can you beat ${senderName}'s score in ${gameName}? Accept the challenge now on ${SITE_NAME}.`;
      const canonicalUrl = `${SITE_BASE_URL}/share/challenge/${id}`;

      const html = buildSharePage({
        title,
        description,
        ogImage,
        canonicalUrl,
        redirectUrl: gameRedirectUrl,
      });

      res
        .status(200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          // Short cache: personalised content, but status rarely changes
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        })
        .end(html);
    } catch (err) {
      console.error("[share] Error rendering challenge share page:", err);
      // On any error just send the user to the game directly.
      return res.redirect(`/game/letter-hunt`);
    }
  });
}
