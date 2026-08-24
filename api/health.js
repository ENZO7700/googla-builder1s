/** Vercel serverless health probe — no secrets, no dependencies. */
export default function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      status: "ok",
      service: "larsenevans-wpbox",
      timestamp: new Date().toISOString(),
    }),
  );
}
