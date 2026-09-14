// Deletes the account of the user who calls it. The service role key only exists here, never in the app.
// The caller is authenticated below (verify_jwt is off so it also works with the new API keys).
import { createClient } from 'npm:@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'not_authenticated' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only a valid user access token passes: the publishable key or an expired session do not.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'not_authenticated' });

  // The profile and its clubs go with the auth user (on delete cascade).
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('delete-account failed:', deleteError.message);
    return json(500, { error: 'delete_failed' });
  }

  return json(200, { deleted: true });
});
