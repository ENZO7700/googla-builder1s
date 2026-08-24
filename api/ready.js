/** Vercel readiness probe — confirms the deployment serves API routes. */
export default function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      status: "ready",
      service: "larsenevans-wpbox",
      timestamp: new Date().toISOString(),
    }),
  );
}
