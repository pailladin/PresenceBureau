const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

module.exports = { getSupabaseClient };
