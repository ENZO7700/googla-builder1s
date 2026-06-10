// Real (best-effort heuristic) launch audit.
// Performs network probes against a target URL and returns a Scan-shaped JSON.
// Note: this is NOT a Lighthouse replacement — no headless browser, no Core Web Vitals.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Dimension = 'security' | 'performance' | 'accessibility' | 'pwa' | 'privacy';

interface Finding {
  id: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  explanation: string;
  whyItMatters: string;
  recommendedFix: string;
  builderPrompt: string;
  source: 'real' | 'demo';
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const SEVERITY_PENALTY: Record<Severity, number> = { critical: 28, high: 18, medium: 10, low: 5, info: 2 };

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal, redirect: init.redirect ?? 'follow' }); }
  finally { clearTimeout(t); }
}

function f(p: Omit<Finding, 'id' | 'source'>): Finding {
  return { id: uid('find'), source: 'real', ...p };
}

// ---- individual checks ----

async function checkSecurityHeaders(url: string, html: Response | null): Promise<Finding[]> {
  if (!html) return [];
  const findings: Finding[] = [];
  const h = html.headers;
  const get = (k: string) => h.get(k.toLowerCase());

  if (!get('content-security-policy')) findings.push(f({
    dimension: 'security', severity: 'critical',
    title: 'Missing Content-Security-Policy header',
    explanation: `${url} responded without a Content-Security-Policy header.`,
    whyItMatters: 'Without CSP, an XSS or compromised dependency can run arbitrary scripts and exfiltrate user data.',
    recommendedFix: 'Add a strict CSP starting in report-only mode.',
    builderPrompt: `Add a strict Content-Security-Policy header to all HTML responses for ${url}.\nPolicy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests\nAlso add: X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=(), microphone=(), geolocation=().`,
  }));
  if (!get('strict-transport-security')) findings.push(f({
    dimension: 'security', severity: 'high',
    title: 'Missing Strict-Transport-Security (HSTS) header',
    explanation: 'Response did not include HSTS.',
    whyItMatters: 'Attackers can downgrade users to HTTP and intercept credentials.',
    recommendedFix: 'Emit Strict-Transport-Security: max-age=63072000; includeSubDomains; preload on every HTTPS response.',
    builderPrompt: `Add header Strict-Transport-Security: max-age=63072000; includeSubDomains; preload to all HTTPS responses on ${url}.`,
  }));
  if (!get('x-content-type-options')) findings.push(f({
    dimension: 'security', severity: 'low',
    title: 'Missing X-Content-Type-Options header',
    explanation: 'Header X-Content-Type-Options not set to nosniff.',
    whyItMatters: 'Browsers may MIME-sniff responses, enabling some XSS variants.',
    recommendedFix: 'Add X-Content-Type-Options: nosniff to all responses.',
    builderPrompt: `Add X-Content-Type-Options: nosniff header to all responses on ${url}.`,
  }));
  if (!get('referrer-policy')) findings.push(f({
    dimension: 'security', severity: 'low',
    title: 'Missing Referrer-Policy header',
    explanation: 'No Referrer-Policy header set.',
    whyItMatters: 'Sensitive URL data may leak to third parties via the Referer header.',
    recommendedFix: 'Set Referrer-Policy: strict-origin-when-cross-origin.',
    builderPrompt: `Add Referrer-Policy: strict-origin-when-cross-origin header to all responses on ${url}.`,
  }));
  if (!get('permissions-policy')) findings.push(f({
    dimension: 'security', severity: 'info',
    title: 'No Permissions-Policy header',
    explanation: 'No Permissions-Policy header configured.',
    whyItMatters: 'Embedded third-party iframes can request powerful APIs (camera, geolocation) without restrictions.',
    recommendedFix: 'Add a restrictive Permissions-Policy denying unused APIs.',
    builderPrompt: `Add Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=() header to all responses on ${url}.`,
  }));
  return findings;
}

async function checkHttpsRedirect(url: string): Promise<Finding[]> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return [];
    const httpUrl = `http://${u.host}${u.pathname}`;
    const resp = await fetchWithTimeout(httpUrl, { method: 'GET', redirect: 'manual' }, 8000);
    const loc = resp.headers.get('location') ?? '';
    const redirected = resp.status >= 300 && resp.status < 400 && loc.toLowerCase().startsWith('https://');
    if (!redirected) {
      return [f({
        dimension: 'security', severity: 'high',
        title: 'HTTP not redirected to HTTPS',
        explanation: `Plain http:// requests to ${u.host} returned ${resp.status} without redirecting to https://.`,
        whyItMatters: 'Users on hostile networks can be downgraded to HTTP and have traffic intercepted.',
        recommendedFix: 'Add a permanent (301) redirect from all http:// URLs to their https:// equivalents.',
        builderPrompt: `Configure ${u.host} to 301-redirect every http:// request to its https:// equivalent at the edge / hosting layer. Verify with: curl -I http://${u.host}`,
      })];
    }
  } catch { /* network error - skip */ }
  return [];
}

async function checkPwa(baseUrl: string, html: string | null): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);
  const manifestMatch = html?.match(/<link[^>]+rel=["']manifest["'][^>]*href=["']([^"']+)["']/i);
  const themeColorMatch = html?.match(/<meta[^>]+name=["']theme-color["']/i);

  if (!manifestMatch) {
    findings.push(f({
      dimension: 'pwa', severity: 'medium',
      title: 'No web app manifest linked',
      explanation: 'index.html is missing <link rel="manifest">.',
      whyItMatters: 'Without a manifest the site is not installable as a PWA on any platform.',
      recommendedFix: 'Add manifest.webmanifest and link it from <head>.',
      builderPrompt: `Create manifest.webmanifest with name, short_name, start_url, display: "standalone", theme_color, background_color, and 192/512 icons. Link it from <head> via <link rel="manifest" href="/manifest.webmanifest">. Target site: ${baseUrl}.`,
    }));
  } else {
    try {
      const mUrl = new URL(manifestMatch[1], u.origin).toString();
      const mResp = await fetchWithTimeout(mUrl, {}, 5000);
      if (!mResp.ok) throw new Error('manifest fetch failed');
      const m = await mResp.json().catch(() => ({}));
      if (!m.theme_color) findings.push(f({
        dimension: 'pwa', severity: 'low',
        title: 'PWA manifest missing theme_color',
        explanation: 'manifest is served but has no theme_color.',
        whyItMatters: 'Address bar and PWA splash fall back to default colors.',
        recommendedFix: 'Set theme_color in manifest.webmanifest.',
        builderPrompt: `Add theme_color and background_color (matching brand) to manifest.webmanifest for ${baseUrl}.`,
      }));
      if (!Array.isArray(m.icons) || m.icons.length === 0) findings.push(f({
        dimension: 'pwa', severity: 'medium',
        title: 'PWA manifest missing icons',
        explanation: 'manifest has no icons array.',
        whyItMatters: 'PWA cannot be installed without icons.',
        recommendedFix: 'Add 192×192 and 512×512 icons to manifest.icons.',
        builderPrompt: `Add 192x192 and 512x512 PNG icons to manifest.webmanifest icons[] for ${baseUrl}.`,
      }));
    } catch {
      findings.push(f({
        dimension: 'pwa', severity: 'low',
        title: 'Manifest could not be fetched or parsed',
        explanation: `Linked manifest at ${manifestMatch[1]} did not return valid JSON.`,
        whyItMatters: 'Browsers will ignore an invalid manifest, breaking installability.',
        recommendedFix: 'Verify the manifest URL returns valid JSON with the correct content-type.',
        builderPrompt: `Fix the web app manifest at ${manifestMatch[1]} on ${baseUrl} so it returns valid JSON with content-type application/manifest+json.`,
      }));
    }
  }

  if (!themeColorMatch) findings.push(f({
    dimension: 'pwa', severity: 'info',
    title: 'No <meta name="theme-color"> in <head>',
    explanation: 'HTML head is missing the theme-color meta tag.',
    whyItMatters: 'Mobile browser UI chrome won\'t match brand color.',
    recommendedFix: 'Add <meta name="theme-color" content="#..."> in <head>.',
    builderPrompt: `Add <meta name="theme-color" content="#0f172a"> inside <head> in index.html for ${baseUrl}.`,
  }));
  return findings;
}

function checkAccessibility(html: string | null): Finding[] {
  if (!html) return [];
  const out: Finding[] = [];
  if (!/<html[^>]+lang=/i.test(html)) out.push(f({
    dimension: 'accessibility', severity: 'medium',
    title: '<html> missing lang attribute',
    explanation: 'The root <html> element has no lang attribute.',
    whyItMatters: 'Screen readers cannot pick the correct pronunciation engine.',
    recommendedFix: 'Add lang="en" (or appropriate code) to <html>.',
    builderPrompt: `Set the lang attribute on the root <html> tag in index.html to the primary content language.`,
  }));
  if (!/<title>[^<]{1,}<\/title>/i.test(html)) out.push(f({
    dimension: 'accessibility', severity: 'medium',
    title: 'Missing or empty <title>',
    explanation: 'Page has no <title>.',
    whyItMatters: 'Hurts SEO, accessibility, and tab navigation.',
    recommendedFix: 'Add a descriptive <title> per page.',
    builderPrompt: `Ensure every route renders a unique, descriptive <title> via react-helmet or document.title updates.`,
  }));
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const noAlt = imgs.filter(t => !/\balt=/i.test(t)).length;
  if (noAlt > 0) out.push(f({
    dimension: 'accessibility', severity: 'high',
    title: `${noAlt} <img> tag${noAlt === 1 ? '' : 's'} without alt attribute`,
    explanation: `Found ${noAlt} of ${imgs.length} images without an alt attribute on the home page HTML.`,
    whyItMatters: 'Screen readers cannot announce these images. Fails WCAG 1.1.1.',
    recommendedFix: 'Add descriptive alt to meaningful images, alt="" to decorative ones.',
    builderPrompt: `Add alt attributes to every <img> in this project. Meaningful images: descriptive alt. Decorative images: alt="" + aria-hidden="true". Add eslint jsx-a11y/alt-text rule.`,
  }));
  return out;
}

function checkPerformance(html: string | null, htmlBytes: number, ttfbMs: number, encoding: string | null): Finding[] {
  const out: Finding[] = [];
  if (ttfbMs > 1500) out.push(f({
    dimension: 'performance', severity: 'medium',
    title: `Slow TTFB: ${Math.round(ttfbMs)}ms`,
    explanation: `Time-to-first-byte was ${Math.round(ttfbMs)}ms.`,
    whyItMatters: 'High TTFB tanks LCP and search rankings.',
    recommendedFix: 'Add edge caching / CDN in front of the origin, enable HTTP/2 or HTTP/3.',
    builderPrompt: `Investigate slow TTFB on this site. Add a CDN (Cloudflare/Vercel Edge) in front of the origin and enable HTTP/3.`,
  }));
  if (!encoding || !/gzip|br|deflate/i.test(encoding)) out.push(f({
    dimension: 'performance', severity: 'medium',
    title: 'HTML not served compressed',
    explanation: `Response Content-Encoding was "${encoding ?? 'none'}".`,
    whyItMatters: 'Uncompressed HTML wastes bandwidth and slows first paint.',
    recommendedFix: 'Enable gzip or brotli compression at the edge.',
    builderPrompt: `Enable Brotli (or gzip fallback) compression for HTML/JS/CSS responses at the hosting layer.`,
  }));
  if (htmlBytes > 200_000) out.push(f({
    dimension: 'performance', severity: 'low',
    title: `Large HTML payload (${Math.round(htmlBytes / 1024)} KB)`,
    explanation: 'Initial HTML document is unusually large.',
    whyItMatters: 'Large HTML delays parsing and first paint, especially on mobile.',
    recommendedFix: 'Move inline data to async fetches, defer below-the-fold sections.',
    builderPrompt: `Reduce initial HTML size on this site by moving inlined JSON to lazy fetches and deferring below-the-fold sections.`,
  }));
  if (html) {
    const blocking = (html.match(/<script\b(?![^>]*\b(?:async|defer|type=["']module["'])\b)[^>]*src=/gi) ?? []).length;
    if (blocking > 0) out.push(f({
      dimension: 'performance', severity: 'medium',
      title: `${blocking} render-blocking <script> tag${blocking === 1 ? '' : 's'}`,
      explanation: 'Found scripts without async/defer/module in <head>.',
      whyItMatters: 'Blocking scripts delay LCP and FCP.',
      recommendedFix: 'Add defer or type="module" to non-critical scripts.',
      builderPrompt: `Find render-blocking <script src="..."> tags in index.html and add defer or type="module" where safe.`,
    }));
  }
  return out;
}

function checkPrivacy(html: string | null): Finding[] {
  if (!html) return [];
  const out: Finding[] = [];
  const hasPrivacy = /href=["'][^"']*(privacy|gdpr|datenschutz)[^"']*["']/i.test(html);
  if (!hasPrivacy) out.push(f({
    dimension: 'privacy', severity: 'high',
    title: 'No privacy policy link found in HTML',
    explanation: 'No <a href> containing "privacy" was found in the page HTML.',
    whyItMatters: 'GDPR/CCPA require an accessible privacy policy link, and app stores will reject builds without one.',
    recommendedFix: 'Publish /privacy and link it from the global footer.',
    builderPrompt: `Create a /privacy page (Data we collect, How we use it, Third parties, Your rights, Contact) and link it from the global footer for this site.`,
  }));
  const cookieMention = /(cookie|consent)/i.test(html);
  if (!cookieMention) out.push(f({
    dimension: 'privacy', severity: 'low',
    title: 'No cookie / consent banner detected',
    explanation: 'HTML does not mention cookies or consent.',
    whyItMatters: 'EU visitors must be given a real consent choice for non-essential cookies.',
    recommendedFix: 'Add a GDPR-compliant consent banner if any non-essential cookies/analytics are used.',
    builderPrompt: `Add a GDPR-compliant cookie consent banner to this site. Reject by default, accept must be explicit, store choice in localStorage.`,
  }));
  return out;
}

// ---- score from findings ----
function scoreFromFindings(findings: Finding[], dim: Dimension): number {
  let score = 100;
  for (const f of findings) if (f.dimension === dim) score -= SEVERITY_PENALTY[f.severity];
  return clamp(score);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const url: string = body?.url;
    const projectId: string = body?.projectId ?? 'unknown';
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Invalid url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const t0 = Date.now();
    let resp: Response | null = null;
    let html: string | null = null;
    let htmlBytes = 0;
    let networkError: string | null = null;
    try {
      resp = await fetchWithTimeout(url, { headers: { 'User-Agent': 'LaunchReadinessBot/1.0 (+lovable)' } }, 12_000);
      html = await resp.text();
      htmlBytes = new TextEncoder().encode(html).length;
    } catch (e) {
      networkError = (e as Error).message;
    }
    const ttfbMs = Date.now() - t0;

    if (!resp) {
      return new Response(JSON.stringify({
        error: `Could not reach ${url}: ${networkError ?? 'unknown error'}`,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [secHdrFindings, httpsFindings, pwaFindings] = await Promise.all([
      checkSecurityHeaders(url, resp),
      checkHttpsRedirect(url),
      checkPwa(url, html),
    ]);
    const a11y = checkAccessibility(html);
    const perf = checkPerformance(html, htmlBytes, ttfbMs, resp.headers.get('content-encoding'));
    const priv = checkPrivacy(html);

    const findings = [...secHdrFindings, ...httpsFindings, ...pwaFindings, ...a11y, ...perf, ...priv];

    const scores = {
      security: scoreFromFindings(findings, 'security'),
      performance: scoreFromFindings(findings, 'performance'),
      accessibility: scoreFromFindings(findings, 'accessibility'),
      pwa: scoreFromFindings(findings, 'pwa'),
      privacy: scoreFromFindings(findings, 'privacy'),
      overall: 0,
    };
    scores.overall = clamp((scores.security + scores.performance + scores.accessibility + scores.pwa + scores.privacy) / 5);

    const scan = {
      id: uid('scan'),
      projectId,
      createdAt: new Date().toISOString(),
      scores,
      findings,
      sources: { security: 'real', performance: 'real', accessibility: 'real', pwa: 'real', privacy: 'real' } as const,
      summary: findings.length === 0
        ? `Real scan: clean across all dimensions for ${url}.`
        : `Real scan: ${findings.length} findings across ${new Set(findings.map(x => x.dimension)).size} dimensions. TTFB ${ttfbMs}ms, HTML ${Math.round(htmlBytes / 1024)} KB.`,
    };

    return new Response(JSON.stringify({ scan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
