import type { Dimension, Finding, LaunchProject, Scan, Severity } from './types';
import { uid } from './utils';

export const DEMO_PROJECT_ID = 'proj_demo_h4ck3d_ecommerce';

export const demoProject: LaunchProject = {
  id: DEMO_PROJECT_ID,
  name: 'H4CK3D Sample E-commerce App',
  url: 'https://demo.h4ck3d-shop.example.com',
  appType: 'ecommerce',
  config: { collectsPersonalData: true, usesPayments: true, hasAuth: true, storesUserContent: true },
  createdAt: '2026-04-01T09:00:00.000Z',
  isDemo: true,
};

function f(p: Omit<Finding, 'id' | 'source'> & { source?: 'real' | 'demo' }): Finding {
  return { id: uid('find'), source: p.source ?? 'demo', ...p };
}

const FINDING_CSP = (): Finding => f({
  dimension: 'security', severity: 'critical',
  title: 'Missing Content Security Policy header',
  explanation: 'Your app does not send a Content-Security-Policy (CSP) HTTP response header. CSP is the browser-level allowlist that decides which scripts, styles, and resources may load.',
  whyItMatters: 'Without CSP, a single injected <script> from an XSS, a compromised dependency, or a malicious ad can execute in your users\' browsers and steal sessions, payment data, or personal information.',
  recommendedFix: 'Add a strict Content-Security-Policy header to every HTML response. Start in report-only mode, then enforce. Pin script-src to your own origin and explicit trusted CDNs only.',
  builderPrompt: `Add a strict Content-Security-Policy header to all HTML responses in this app.
- Set the header in middleware so it covers every route, including SSR and API HTML responses.
- Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
- Also add: X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=(), microphone=(), geolocation=()
- README: one-line note on how to extend script-src for new third parties.`,
});

const FINDING_HTTPS = (): Finding => f({
  dimension: 'security', severity: 'high',
  title: 'No HTTPS redirect configured',
  explanation: 'Requests to http:// versions of your URLs are served instead of being 301-redirected to https://. The HSTS header is also missing.',
  whyItMatters: 'Plain-HTTP requests can be intercepted on hostile networks. Without HSTS, attackers can downgrade users from HTTPS to HTTP and harvest credentials, cookies, or payment details.',
  recommendedFix: 'Force-redirect all http:// traffic to https:// with a 301, and emit Strict-Transport-Security with a long max-age and includeSubDomains.',
  builderPrompt: `Enforce HTTPS for this app.
- Add a server middleware (or hosting redirect rule) that 301-redirects every http:// request to its https:// equivalent.
- On every HTTPS response add: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- Verify by curl -I http://<host> shows a 301 to https://, and curl -I https://<host> includes the HSTS header.`,
});

const FINDING_ALT_TEXT = (): Finding => f({
  dimension: 'accessibility', severity: 'medium',
  title: 'Images missing alt text',
  explanation: 'Multiple <img> elements on the home page and product pages have no alt attribute or use empty alt for meaningful images.',
  whyItMatters: 'Screen-reader users get no description of the image, harming accessibility and WCAG 2.1 AA compliance. It also hurts image SEO.',
  recommendedFix: 'Add descriptive alt text to every meaningful image. Use alt="" only for purely decorative images.',
  builderPrompt: `Audit every <img> usage in this project for accessibility.
- For each meaningful image, add a descriptive alt attribute that conveys purpose, not just content.
- For purely decorative images, set alt="" and aria-hidden="true".
- Add an ESLint rule (jsx-a11y/alt-text) and fix all reported issues.
- Print a final list of files changed and any images that need a human-written alt.`,
});

const FINDING_PWA_THEME = (): Finding => f({
  dimension: 'pwa', severity: 'low',
  title: 'PWA manifest missing theme_color',
  explanation: 'manifest.webmanifest is served but does not define a theme_color, and the matching <meta name="theme-color"> tag is absent.',
  whyItMatters: 'Without theme_color, the browser address bar and the PWA splash screen fall back to default colors, breaking your brand identity on installed PWAs.',
  recommendedFix: 'Set theme_color and background_color in manifest.webmanifest and add a matching <meta name="theme-color"> tag in <head>.',
  builderPrompt: `Polish PWA branding for this app.
- In manifest.webmanifest set theme_color and background_color to the brand primary and brand surface.
- In index.html add <meta name="theme-color" content="#0f172a"> inside <head>.
- Verify the manifest validates with no warnings using DevTools > Application > Manifest.`,
});

const FINDING_SW = (): Finding => f({
  dimension: 'pwa', severity: 'info',
  title: 'Consider adding a service worker for offline support',
  explanation: 'No service worker is registered. The app falls back to the browser\'s network error page when users go offline.',
  whyItMatters: 'A small offline shell turns connection blips into a graceful experience, and is required for true PWA installability across all platforms.',
  recommendedFix: 'Register a minimal service worker that pre-caches the app shell and returns a friendly offline page on navigation failure.',
  builderPrompt: `Add a minimal service worker to this app.
- Register /sw.js from main.tsx (production only).
- Pre-cache: /, /offline, the favicon, and the manifest.
- On fetch failures for navigation requests, respond with /offline.
- Add an /offline route with the app logo and a Retry button.`,
});

const FINDING_PRIVACY_POLICY = (): Finding => f({
  dimension: 'privacy', severity: 'high',
  title: 'Privacy policy not linked from the footer',
  explanation: 'The site collects personal data and processes payments, but no privacy policy link is reachable from the global footer.',
  whyItMatters: 'GDPR, CCPA, and most app store policies require an accessible privacy policy. Missing it can block launch and erodes user trust.',
  recommendedFix: 'Publish a privacy policy page and link it from the global footer and the checkout flow.',
  builderPrompt: `Add a privacy policy page and surface it everywhere required.
- Create /privacy with sections: Data we collect, How we use it, Third parties, Your rights, Contact.
- Add a Privacy link in the global footer and at the bottom of the checkout page.
- Add a brief consent line near the email input on signup.`,
});

const FINDING_LCP = (): Finding => f({
  dimension: 'performance', severity: 'medium',
  title: 'Largest Contentful Paint above 2.5s on mobile',
  explanation: 'PageSpeed reports an LCP of ~3.4s on a simulated mobile connection. The hero image is a 1.8MB unoptimized JPEG.',
  whyItMatters: 'LCP is a Core Web Vital. Slow LCP correlates strongly with bounce on e-commerce, especially on mobile where most traffic lives.',
  recommendedFix: 'Serve the hero with modern formats (AVIF/WebP), explicit width/height, and preload the LCP image.',
  builderPrompt: `Optimize home page LCP.
- Convert the hero image to <img> with width/height and srcset for AVIF + WebP at 1200/800/400 widths.
- Add <link rel="preload" as="image" imagesrcset> for the LCP image in index.html.
- Lazy-load any below-the-fold images.
- Re-measure LCP and report the new value.`,
});

const FINDING_NO_LABELS = (): Finding => f({
  dimension: 'accessibility', severity: 'high',
  title: 'Form inputs missing associated <label> elements',
  explanation: 'Several inputs on the checkout and signup pages have placeholders only and no associated <label>.',
  whyItMatters: 'Screen readers cannot announce the field\'s purpose, and autofill quality drops. This fails WCAG 1.3.1 and 4.1.2.',
  recommendedFix: 'Wrap or associate every input with a <label htmlFor="...">. Visually hide the label with sr-only if the design needs it.',
  builderPrompt: `Make every form input in this app accessible.
- For each <input>, <select>, <textarea>, add a <label htmlFor> matching the input id.
- If the design hides the label, use a Tailwind sr-only class instead of removing it.
- Add eslint-plugin-jsx-a11y rule label-has-associated-control.`,
});

function makeScan(projectId: string, isoDate: string, scores: Scan['scores'], findings: Finding[], summary: string): Scan {
  return {
    id: uid('scan'), projectId, createdAt: isoDate, scores, findings,
    sources: { security: 'demo', performance: 'demo', accessibility: 'demo', pwa: 'demo', privacy: 'demo' },
    summary,
  };
}

export const demoScans: Scan[] = [
  makeScan(DEMO_PROJECT_ID, '2026-04-02T10:15:00.000Z',
    { overall: 48, security: 35, performance: 52, accessibility: 55, pwa: 40, privacy: 58 },
    [FINDING_CSP(), FINDING_HTTPS(), FINDING_NO_LABELS(), FINDING_ALT_TEXT(), FINDING_PWA_THEME(), FINDING_SW(), FINDING_PRIVACY_POLICY(), FINDING_LCP()],
    'Initial baseline scan. Critical security gaps and missing privacy policy.'),
  makeScan(DEMO_PROJECT_ID, '2026-04-15T16:42:00.000Z',
    { overall: 64, security: 58, performance: 60, accessibility: 70, pwa: 55, privacy: 78 },
    [FINDING_CSP(), FINDING_ALT_TEXT(), FINDING_PWA_THEME(), FINDING_SW(), FINDING_LCP()],
    'HTTPS enforced and privacy policy published. CSP and PWA polish still pending.'),
  makeScan(DEMO_PROJECT_ID, '2026-05-04T08:20:00.000Z',
    { overall: 86, security: 88, performance: 82, accessibility: 90, pwa: 78, privacy: 92 },
    [FINDING_PWA_THEME(), FINDING_SW()],
    'Strong launch readiness. Only PWA polish items remain.'),
];

export const fallbackFindingsLibrary: Record<Dimension, Finding[]> = {
  security: [FINDING_CSP(), FINDING_HTTPS()],
  performance: [FINDING_LCP()],
  accessibility: [FINDING_ALT_TEXT(), FINDING_NO_LABELS()],
  pwa: [FINDING_PWA_THEME(), FINDING_SW()],
  privacy: [FINDING_PRIVACY_POLICY()],
};

export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const acc: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const x of findings) acc[x.severity]++;
  return acc;
}
