/**
 * Server-side SEO meta-tag resolution and injection.
 *
 * `injectMetaTags` is called by both server/static.ts (production) and
 * server/vite.ts (development) before the HTML is sent to the browser, so
 * every crawler — including social-sharing bots that never execute JavaScript —
 * receives the correct title, description, and Open Graph tags for the
 * specific page requested.
 *
 * The existing client-side PageSEO / react-helmet-async component is kept in
 * place; it continues to handle browser-tab updates after client-side
 * navigation.
 */

import { gamesData } from "./game-data";

export const SITE_NAME = "xtraWordinary";
export const SITE_BASE_URL = "https://xtrawordinary.app";

const DEFAULT_OG_IMAGE = `${SITE_BASE_URL}/og-image.png`;
const SITE_DEFAULT_TITLE = `${SITE_NAME} - Free Word Games Collection`;
const SITE_DEFAULT_DESC =
  "Challenge your vocabulary with 25+ free word games. Play Letter Hunt, Word Chain, Anagrams, Duels, daily challenges, and more.";

interface PageMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage: string;
}

// Build a slug → game lookup once at module load (synchronous, no DB needed).
const gameBySlug = new Map(gamesData.map((g) => [g.slug, g]));

// Known static routes — title + description; ogImage is optional (falls back to DEFAULT_OG_IMAGE).
const STATIC_ROUTES: Record<string, Pick<PageMeta, "title" | "description"> & { ogImage?: string }> = {
  "/": {
    title: `${SITE_NAME} - Free Word Games Collection`,
    description:
      "Play 25+ free vocabulary and word games. Challenge your brain with Letter Hunt, Word Chain, Anagrams, Duels, and more.",
  },
  "/daily": {
    title: `Daily Challenge | ${SITE_NAME}`,
    description:
      "A new word game challenge every day. Play today's puzzle and see how you rank on the daily leaderboard.",
    ogImage: `${SITE_BASE_URL}/og/daily.png`,
  },
  "/leaderboard": {
    title: `Global Leaderboard | ${SITE_NAME}`,
    description:
      "See the top word game players on xtraWordinary. Compare your scores across all games.",
    ogImage: `${SITE_BASE_URL}/og/leaderboard.png`,
  },
  "/duels": {
    title: `Duels | ${SITE_NAME}`,
    description:
      "Challenge other players to real-time 1-on-1 word game duels. Turn-based or race format.",
    ogImage: `${SITE_BASE_URL}/og/duels.png`,
  },
  "/duels/leaderboard": {
    title: `Duel Rankings | ${SITE_NAME}`,
    description: "See the top-ranked players in xtraWordinary 1-on-1 word game duels.",
    ogImage: `${SITE_BASE_URL}/og/duels-leaderboard.png`,
  },
  "/word-wars": {
    title: `Word Wars | ${SITE_NAME}`,
    description:
      "Enter solo bracket tournaments — compete in best-of-3 duel series to become Word Wars champion.",
    ogImage: `${SITE_BASE_URL}/og/word-wars.png`,
  },
  "/guild-wars": {
    title: `Guild Wars | ${SITE_NAME}`,
    description: "Group vs group bracket tournaments — rally your guild and compete for glory.",
    ogImage: `${SITE_BASE_URL}/og/guild-wars.png`,
  },
  "/about": {
    title: `About | ${SITE_NAME}`,
    description:
      "Learn about xtraWordinary — a collection of 25+ word games built to improve vocabulary and challenge your brain.",
    ogImage: `${SITE_BASE_URL}/og/about.png`,
  },
  "/pricing": {
    title: `Premium Pricing | ${SITE_NAME}`,
    description:
      "Unlock Premium features on xtraWordinary — custom game modes, exclusive stats, and more.",
    ogImage: `${SITE_BASE_URL}/og/pricing.png`,
  },
  "/groups": {
    title: `Groups | ${SITE_NAME}`,
    description:
      "Join or create word game groups, compete in group rounds, and climb your group's leaderboard.",
    ogImage: `${SITE_BASE_URL}/og/groups.png`,
  },
  "/groups/browse": {
    title: `Browse Groups | ${SITE_NAME}`,
    description:
      "Discover public word game groups to join, compete in rounds, and meet other vocabulary enthusiasts.",
    ogImage: `${SITE_BASE_URL}/og/groups-browse.png`,
  },
  "/privacy": {
    title: `Privacy Policy | ${SITE_NAME}`,
    description: "Privacy policy for xtraWordinary.",
  },
  "/terms": {
    title: `Terms of Service | ${SITE_NAME}`,
    description: "Terms of service for xtraWordinary.",
  },
};

/** Resolve the page-specific meta for a given URL pathname (no query string). */
export function resolvePageMeta(pathname: string): PageMeta {
  const path = pathname.split("?")[0].split("#")[0] || "/";

  // /game/:slug
  const gameMatch = path.match(/^\/game\/([^/]+)$/);
  if (gameMatch) {
    const slug = gameMatch[1];
    const game = gameBySlug.get(slug);
    if (game) {
      const title = `${game.name} | ${SITE_NAME}`;
      const description = `Play ${game.name} — ${
        game.description ?? "a fun vocabulary challenge on xtraWordinary."
      }`;
      const ogImage = game.ogImage
        ? `${SITE_BASE_URL}${game.ogImage}`
        : DEFAULT_OG_IMAGE;
      return {
        title,
        description,
        canonicalUrl: `${SITE_BASE_URL}/game/${slug}`,
        ogImage,
      };
    }
  }

  // Known static routes
  const staticMeta = STATIC_ROUTES[path];
  if (staticMeta) {
    return {
      ...staticMeta,
      canonicalUrl: `${SITE_BASE_URL}${path}`,
      ogImage: staticMeta.ogImage ?? DEFAULT_OG_IMAGE,
    };
  }

  // Fallback: site defaults
  return {
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESC,
    canonicalUrl: `${SITE_BASE_URL}${path}`,
    ogImage: DEFAULT_OG_IMAGE,
  };
}

/** Escape a string for safe use in an HTML attribute value or text node. */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build an inline JSON-LD <script> block for the given pathname.
 * Returns an empty string when no structured data applies to the route.
 */
function buildJsonLd(pathname: string, meta: PageMeta): string {
  let schema: object | null = null;

  // /game/:slug → VideoGame (subtype of SoftwareApplication)
  const gameMatch = pathname.match(/^\/game\/([^/]+)$/);
  if (gameMatch) {
    const slug = gameMatch[1];
    const game = gameBySlug.get(slug);
    if (game) {
      schema = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: game.name,
        description:
          game.description ?? "A free vocabulary word game on xtraWordinary.",
        url: meta.canonicalUrl,
        image: meta.ogImage,
        applicationCategory: "WordGame",
        operatingSystem: "Web Browser",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_BASE_URL,
        },
      };
    }
  }

  // Home page → WebSite with Sitelinks Searchbox
  if (pathname === "/" || pathname === "") {
    schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_BASE_URL,
      description: meta.description,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_BASE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    };
  }

  if (!schema) return "";

  // Use </script> split to prevent the literal string from closing the tag
  const json = JSON.stringify(schema, null, 2);
  return `<script type="application/ld+json">${json}<\/script>`;
}

/**
 * Replace the `<!-- __SEO_HEAD__ -->` placeholder in the HTML template with
 * the correct meta tags for `pathname`. Returns the modified HTML string.
 */
export function injectMetaTags(html: string, pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  const meta = resolvePageMeta(path);
  const e = esc;

  const metaTags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.canonicalUrl)}" />`,
    `<meta property="og:image" content="${e(meta.ogImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="675" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.canonicalUrl)}" />`,
  ].join("\n    ");

  const jsonLd = buildJsonLd(path, meta);
  const seoBlock = jsonLd ? `${metaTags}\n    ${jsonLd}` : metaTags;

  return html.replace("<!-- __SEO_HEAD__ -->", seoBlock);
}
