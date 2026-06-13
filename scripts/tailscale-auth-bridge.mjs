import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

loadLocalEnvFiles();

const BIND_HOST = process.env.TAILSCALE_AUTH_BIND_HOST || "127.0.0.1";
const BRIDGE_PORT = parseNumber(process.env.TAILSCALE_AUTH_BRIDGE_PORT, 8787);
const SUPABASE_URL = mustGetEnv("SUPABASE_URL", process.env.VITE_SUPABASE_URL);
const SUPABASE_PUBLISHABLE_KEY = mustGetEnv(
  "SUPABASE_PUBLISHABLE_KEY",
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
const TAILSCALE_SUPABASE_EMAIL = mustGetEnv(
  "TAILSCALE_SUPABASE_EMAIL",
  process.env.TAILSCALE_SUPABASE_EMAIL || process.env.WPBOX_EMAIL,
);
const TAILSCALE_SUPABASE_PASSWORD = mustGetEnv(
  "TAILSCALE_SUPABASE_PASSWORD",
  process.env.TAILSCALE_SUPABASE_PASSWORD || process.env.WPBOX_PASSWORD,
);
const tailscaleIdentity = getTailscaleIdentity();
const ALLOWED_ORIGINS = parseCsvSet(
  mustGetEnv("TAILSCALE_AUTH_ALLOWED_ORIGINS", getDefaultAllowedOrigins(tailscaleIdentity)),
);
const ALLOWED_LOGINS = parseCsvSet(
  mustGetEnv("TAILSCALE_ALLOWED_LOGINS", tailscaleIdentity.loginName || ""),
);

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function mustGetEnv(name, fallback = "") {
  const value = (fallback || process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function loadLocalEnvFiles() {
  const projectRoot = process.cwd();
  const candidates = [
    path.join(projectRoot, ".env.local"),
    path.join(projectRoot, ".env"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");

    for (const rawLine of content.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      let value = rawValue.trim();
      if (
        (value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function getTailscaleIdentity() {
  try {
    const raw = execFileSync("tailscale", ["status", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const data = JSON.parse(raw);
    const self = data?.Self || {};
    const users = data?.User || {};
    const userProfile = users[String(self.UserID)] || {};
    const dnsName = typeof self.DNSName === "string" ? self.DNSName.replace(/\.$/u, "") : "";
    const loginName = typeof userProfile.LoginName === "string" ? userProfile.LoginName.trim().toLowerCase() : "";

    return {
      dnsName,
      loginName,
    };
  } catch (_error) {
    return {
      dnsName: "",
      loginName: "",
    };
  }
}

function getDefaultAllowedOrigins(identity) {
  const defaults = [
    process.env.WPBOX_PROD_URL || "",
    identity.dnsName ? `https://${identity.dnsName}` : "",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return defaults.join(",");
}

function parseNumber(raw, fallback) {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsvSet(raw) {
  return new Set(
    String(raw || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function getAllowedOrigin(origin) {
  const normalized = origin.trim().toLowerCase();
  return ALLOWED_ORIGINS.has(normalized) ? origin : null;
}

async function drainRequest(req) {
  for await (const _chunk of req) {
    // Body is intentionally ignored; draining keeps the socket tidy.
  }
}

function writeJson(res, statusCode, payload, allowedOrigin = null) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }

  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const origin = getHeaderValue(req.headers.origin);
  const allowedOrigin = origin ? getAllowedOrigin(origin) : null;
  const isSessionPath = requestUrl.pathname === "/" || requestUrl.pathname === "/session";

  if (requestUrl.pathname === "/health") {
    writeJson(res, 200, {
      ok: true,
      bindHost: BIND_HOST,
      bridgePort: BRIDGE_PORT,
      mode: "tailscale-serve",
    }, allowedOrigin);
    return;
  }

  if (!isSessionPath) {
    writeJson(res, 404, { ok: false, error: "Not found" }, allowedOrigin);
    return;
  }

  if (req.method === "OPTIONS") {
    if (!allowedOrigin) {
      writeJson(res, 403, { ok: false, error: "Origin not allowed" });
      return;
    }
    res.writeHead(204, {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "Vary": "Origin",
    });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { ok: false, error: "Method not allowed" }, allowedOrigin);
    return;
  }

  await drainRequest(req);

  if (!allowedOrigin) {
    writeJson(res, 403, { ok: false, error: "Origin not allowed" });
    return;
  }

  const tailscaleUserLogin = getHeaderValue(req.headers["tailscale-user-login"]).trim().toLowerCase();
  if (!tailscaleUserLogin) {
    writeJson(res, 403, {
      ok: false,
      error: "Missing Tailscale identity. Access this endpoint through tailscale serve.",
    }, allowedOrigin);
    return;
  }

  if (!ALLOWED_LOGINS.has(tailscaleUserLogin)) {
    writeJson(res, 403, {
      ok: false,
      error: "Tailscale user is not allowed to auto-login.",
    }, allowedOrigin);
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TAILSCALE_SUPABASE_EMAIL,
    password: TAILSCALE_SUPABASE_PASSWORD,
  });

  if (error || !data.session) {
    writeJson(res, 502, {
      ok: false,
      error: "Supabase session mint failed.",
    }, allowedOrigin);
    return;
  }

  writeJson(res, 200, {
    ok: true,
    tailscaleUserLogin,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  }, allowedOrigin);
});

server.listen(BRIDGE_PORT, BIND_HOST, () => {
  console.log(`[tailscale-auth-bridge] listening on http://${BIND_HOST}:${BRIDGE_PORT}`);
  console.log("[tailscale-auth-bridge] expose it with: tailscale serve --bg --set-path /session http://127.0.0.1:" + BRIDGE_PORT);
  if (tailscaleIdentity.dnsName) {
    console.log("[tailscale-auth-bridge] suggested VITE_TAILSCALE_AUTH_URL=https://" + tailscaleIdentity.dnsName + "/session");
  }
});
