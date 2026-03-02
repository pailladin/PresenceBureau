const { randomUUID } = require("node:crypto");
const express = require("express");

const MEMBERS_TABLE = "presence_members";
const DAYS_TABLE = "presence_days";
const DAYS_PER_WEEK = 5;

function createEmptyDayArray() {
  return Array(DAYS_PER_WEEK).fill("empty");
}

function createEmptyWeekPlanning(memberCount) {
  return Array.from({ length: memberCount }, () => createEmptyDayArray());
}

function parseIsoDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(Date.UTC(year, monthIndex, day));
}

function toIsoDateUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekKeyAndDayIndex(workDate) {
  const parsed = parseIsoDate(workDate);
  if (!parsed) {
    return null;
  }

  const dayOfWeek = parsed.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  if (mondayOffset < 0 || mondayOffset >= DAYS_PER_WEEK) {
    return null;
  }

  const monday = new Date(parsed);
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);

  return {
    weekKey: toIsoDateUtc(monday),
    dayIndex: mondayOffset,
  };
}

function buildDateFromWeekKeyAndDayIndex(weekKey, dayIndex) {
  const monday = parseIsoDate(weekKey);
  if (!monday || dayIndex < 0 || dayIndex >= DAYS_PER_WEEK) {
    return null;
  }

  const date = new Date(monday);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return toIsoDateUtc(date);
}

function normalizeStatusKey(value) {
  if (typeof value !== "string") {
    return "empty";
  }
  const trimmed = value.trim();
  return trimmed || "empty";
}

function normalizeDayEntry(entry) {
  if (typeof entry === "string") {
    const key = normalizeStatusKey(entry);
    return { am: key, pm: key };
  }

  if (entry && typeof entry === "object" && entry.type === "half") {
    return {
      am: normalizeStatusKey(entry.am),
      pm: normalizeStatusKey(entry.pm),
    };
  }

  return { am: "empty", pm: "empty" };
}

function buildPayloadFromRows(memberRows, dayRows) {
  const members = memberRows.map((member) => ({
    id: member.id,
    name: member.name,
    avatar: member.avatar || "",
    defaultPlanning: createEmptyDayArray(),
  }));

  const memberIndexById = new Map(members.map((member, index) => [member.id, index]));
  const weeks = new Map();

  dayRows.forEach((dayRow) => {
    const memberIndex = memberIndexById.get(dayRow.member_id);
    if (memberIndex === undefined) {
      return;
    }

    const weekAndDay = getWeekKeyAndDayIndex(dayRow.work_date);
    if (!weekAndDay) {
      return;
    }

    const { weekKey, dayIndex } = weekAndDay;
    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, createEmptyWeekPlanning(members.length));
    }

    const morning = normalizeStatusKey(dayRow.morning_status);
    const afternoon = normalizeStatusKey(dayRow.afternoon_status);
    const value = morning === afternoon
      ? morning
      : { type: "half", am: morning, pm: afternoon };

    weeks.get(weekKey)[memberIndex][dayIndex] = value;
  });

  const orderedWeeks = Object.fromEntries(
    Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b))
  );

  return {
    members,
    customStatuses: [],
    weeks: orderedWeeks,
  };
}

async function clearAllPresenceData(supabase) {
  const { error: daysError } = await supabase
    .from(DAYS_TABLE)
    .delete()
    .not("member_id", "is", null);
  if (daysError) {
    return daysError;
  }

  const { error: membersError } = await supabase
    .from(MEMBERS_TABLE)
    .delete()
    .not("id", "is", null);
  return membersError;
}

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

    const membersResult = await supabase
      .from(MEMBERS_TABLE)
      .select("id, name, avatar, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (membersResult.error) {
      res.status(500).json({ error: "STATE_READ_FAILED", details: membersResult.error.message });
      return;
    }

    const dayResult = await supabase
      .from(DAYS_TABLE)
      .select("member_id, work_date, morning_status, afternoon_status");

    if (dayResult.error) {
      res.status(500).json({ error: "STATE_READ_FAILED", details: dayResult.error.message });
      return;
    }

    const payload = buildPayloadFromRows(membersResult.data || [], dayResult.data || []);
    res.json({
      payload,
      updatedAt: new Date().toISOString(),
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

    const normalizedMembers = [];
    if (Array.isArray(payload.members)) {
      payload.members.forEach((member, index) => {
        if (!member || typeof member !== "object") {
          return;
        }

        const name = typeof member.name === "string" ? member.name.trim() : "";
        if (!name) {
          return;
        }

        const providedId = typeof member.id === "string" ? member.id.trim() : "";
        const id = providedId || randomUUID();
        const avatar = typeof member.avatar === "string" ? member.avatar.trim() : "";

        normalizedMembers.push({
          id,
          name,
          avatar,
          sort_order: index,
        });
      });
    }

    if (normalizedMembers.length === 0) {
      const clearError = await clearAllPresenceData(supabase);
      if (clearError) {
        res.status(500).json({ error: "STATE_WRITE_FAILED", details: clearError.message });
        return;
      }

      res.json({ ok: true });
      return;
    }

    const upsertMembersResult = await supabase
      .from(MEMBERS_TABLE)
      .upsert(normalizedMembers, { onConflict: "id" });

    if (upsertMembersResult.error) {
      res.status(500).json({ error: "STATE_WRITE_FAILED", details: upsertMembersResult.error.message });
      return;
    }

    const existingMembersResult = await supabase
      .from(MEMBERS_TABLE)
      .select("id");

    if (existingMembersResult.error) {
      res.status(500).json({ error: "STATE_WRITE_FAILED", details: existingMembersResult.error.message });
      return;
    }

    const currentIds = new Set(normalizedMembers.map((member) => member.id));
    const idsToDelete = (existingMembersResult.data || [])
      .map((member) => member.id)
      .filter((id) => !currentIds.has(id));

    if (idsToDelete.length > 0) {
      const deleteMembersResult = await supabase
        .from(MEMBERS_TABLE)
        .delete()
        .in("id", idsToDelete);

      if (deleteMembersResult.error) {
        res.status(500).json({ error: "STATE_WRITE_FAILED", details: deleteMembersResult.error.message });
        return;
      }
    }

    const memberRowsByIndex = normalizedMembers.map((member) => member.id);
    const dayRows = [];
    const weeks = payload.weeks;

    if (weeks && typeof weeks === "object") {
      Object.entries(weeks).forEach(([weekKey, weekPlanning]) => {
        if (!Array.isArray(weekPlanning) || !parseIsoDate(weekKey)) {
          return;
        }

        for (let memberIndex = 0; memberIndex < memberRowsByIndex.length; memberIndex += 1) {
          const memberPlanning = Array.isArray(weekPlanning[memberIndex]) ? weekPlanning[memberIndex] : [];

          for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
            const dayEntry = normalizeDayEntry(memberPlanning[dayIndex]);
            if (dayEntry.am === "empty" && dayEntry.pm === "empty") {
              continue;
            }

            const workDate = buildDateFromWeekKeyAndDayIndex(weekKey, dayIndex);
            if (!workDate) {
              continue;
            }

            dayRows.push({
              member_id: memberRowsByIndex[memberIndex],
              work_date: workDate,
              morning_status: dayEntry.am,
              afternoon_status: dayEntry.pm,
            });
          }
        }
      });
    }

    const clearDaysResult = await supabase
      .from(DAYS_TABLE)
      .delete()
      .in("member_id", memberRowsByIndex);

    if (clearDaysResult.error) {
      res.status(500).json({ error: "STATE_WRITE_FAILED", details: clearDaysResult.error.message });
      return;
    }

    if (dayRows.length > 0) {
      const insertDaysResult = await supabase
        .from(DAYS_TABLE)
        .insert(dayRows);

      if (insertDaysResult.error) {
        res.status(500).json({ error: "STATE_WRITE_FAILED", details: insertDaysResult.error.message });
        return;
      }
    }

    res.json({ ok: true });
  });

  return router;
}

module.exports = createApiRouter;
