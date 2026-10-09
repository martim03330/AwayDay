// Deletes the account of the user who calls it. The service role key only exists here, never in the app.
// The caller is checked with authenticatedCaller (verify_jwt is off so it also works with the new API keys).
// Deleting is permanent, so the session must have signed in during the last 10 minutes: the app asks for the
// password again right before calling this, and a stolen or long-lived session cannot delete the account.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';
import { signedInRecently } from '../_shared/reauthentication.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await authenticatedCaller(request, admin);
  if (!caller) return json(401, { error: 'not_authenticated' });

  if (!signedInRecently(caller.token, Date.now())) {
    return json(403, { error: 'reauthentication_required' });
  }

  // Files in Storage do not follow the database cascade: remove the user's own folders first (mission photos, the
  // profile photo, and tasco photos from before they were moved to `anonimas/`). Group and trip photos stay: they
  // belong to the group's or the trip's memories (docs/DECISOES.md).
  const PAGE = 100;
  for (const bucket of ['mission-photos', 'avatars', 'place-photos']) {
    const photos = admin.storage.from(bucket);
    for (;;) {
      const { data: files, error: listError } = await photos.list(caller.user.id, { limit: PAGE });
      if (listError) {
        console.error(`delete-account could not list ${bucket}:`, listError.message);
        return json(500, { error: 'delete_failed' });
      }
      if (files.length === 0) break;
      const { error: removeError } = await photos.remove(files.map((file) => `${caller.user.id}/${file.name}`));
      if (removeError) {
        console.error(`delete-account could not remove ${bucket}:`, removeError.message);
        return json(500, { error: 'delete_failed' });
      }
      if (files.length < PAGE) break;
    }
  }

  // Everything the user created goes with the auth user (on delete cascade).
  const { error: deleteError } = await admin.auth.admin.deleteUser(caller.user.id);
  if (deleteError) {
    console.error('delete-account failed:', deleteError.message);
    return json(500, { error: 'delete_failed' });
  }

  return json(200, { deleted: true });
});
