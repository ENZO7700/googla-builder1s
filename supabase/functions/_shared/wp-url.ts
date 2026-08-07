// Normalizes a user-entered WordPress site URL into a clean REST base.
// Handles: uppercase schemes ("Https://"), trailing slashes, and admin/login
// suffixes that users copy from the browser ("/wp-admin", "/wp-login.php",
// "/wp-json", "/wp-admin/index.php").
export function normalizeWpBaseUrl(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  // lowercase only the scheme part
  s = s.replace(/^([A-Za-z]+):\/\//, (_m, p) => `${p.toLowerCase()}://`);
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return s.replace(/\/+$/, "");
  }
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  url.search = "";

  let path = url.pathname
    .replace(/\/+$/, "")
    .replace(/\/wp-admin(\/.*)?$/i, "")
    .replace(/\/wp-login\.php$/i, "")
    .replace(/\/wp-json(\/.*)?$/i, "")
    .replace(/\/index\.php$/i, "")
    .replace(/\/+$/, "");
  url.pathname = path;

  return url.toString().replace(/\/+$/, "");
}

// Host (no scheme, no path) — used for WordPress.com site-scoped REST paths.
export function wpComSiteHost(raw: string): string {
  const base = normalizeWpBaseUrl(raw);
  return base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
