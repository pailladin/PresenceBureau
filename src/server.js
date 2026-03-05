require("dotenv").config();

const path = require("node:path");
const express = require("express");

const createApiRouter = require("./routes/api");
const { getSupabaseClient } = require("./lib/supabase");
const { configureNetworkForNode } = require("./lib/network");

const app = express();
const port = Number(process.env.PORT || 3000);
const roomCapacity = Number(process.env.ROOM_CAPACITY || 11);
configureNetworkForNode();
const supabase = getSupabaseClient();

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  next();
});

app.use(express.json());
app.use("/api", createApiRouter({ roomCapacity, supabase }));

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.APP_CONFIG = ${JSON.stringify({
    roomCapacity,
    writeTokenRequired: Boolean(process.env.PRESENCE_WRITE_TOKEN),
  })};`);
});

app.use(express.static(path.join(process.cwd(), "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Serveur Presence démarré sur http://localhost:${port}`);
  });
}

module.exports = app;
