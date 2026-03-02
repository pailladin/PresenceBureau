const express = require("express");

const STATE_ROW_ID = "global";
const STATE_TABLE = "presence_state";

function createApiRouter({ roomCapacity, supabase }) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "presence-api" });
  });

  router.get("/config", (_req, res) => {
    res.json({ roomCapacity });
  });

  router.get("/state", async (_req, res) => {
    if (!supabase) {
      res.status(503).json({ error: "SUPABASE_NOT_CONFIGURED" });
      return;
    }

    const { data, error } = await supabase
      .from(STATE_TABLE)
      .select("payload, updated_at")
      .eq("id", STATE_ROW_ID)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: "STATE_READ_FAILED", details: error.message });
      return;
    }

    res.json({
      payload: data?.payload || null,
      updatedAt: data?.updated_at || null,
    });
  });

  router.put("/state", async (req, res) => {
    if (!supabase) {
      res.status(503).json({ error: "SUPABASE_NOT_CONFIGURED" });
      return;
    }

    const payload = req.body?.payload;
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ error: "INVALID_PAYLOAD" });
      return;
    }

    const { error } = await supabase
      .from(STATE_TABLE)
      .upsert({ id: STATE_ROW_ID, payload }, { onConflict: "id" });

    if (error) {
      res.status(500).json({ error: "STATE_WRITE_FAILED", details: error.message });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}

module.exports = createApiRouter;
