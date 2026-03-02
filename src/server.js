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

app.use(express.json());
app.use("/api", createApiRouter({ roomCapacity, supabase }));

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.APP_CONFIG = ${JSON.stringify({ roomCapacity })};`);
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
