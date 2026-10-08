import type { MissionPhoto, MissionPhotoInput } from '@/features/missions/types';
import { fotoParaEnviar } from '@/lib/foto-para-enviar';
import { supabase } from '@/lib/supabase';

// Proof photos live in the private `mission-photos` bucket under `<user id>/`. RLS and the Storage policies
// only let people read and write their own folder; the server decides whether a photo is verified.

const BUCKET = 'mission-photos';
/** Signed URLs last an hour; the query that holds them refetches well before that. */
const SIGNED_URL_SECONDS = 60 * 60;

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

export async function fetchMyMissionPhotos(userId: string): Promise<MissionPhoto[]> {
  const { data, error } = await client()
    .from('mission_photo')
    .select('mission_id, storage_path, fixture_id, venue_id, verified, taken_at')
    .eq('profile_id', userId);
  if (error) throw error;
  if (data.length === 0) return [];

  const signed = await client()
    .storage.from(BUCKET)
    .createSignedUrls(
      data.map((row) => row.storage_path),
      SIGNED_URL_SECONDS
    );
  if (signed.error) throw signed.error;
  const urlByPath = new Map(signed.data.map((item) => [item.path, item.signedUrl]));

  return data.map((row) => ({
    missionId: row.mission_id,
    storagePath: row.storage_path,
    url: urlByPath.get(row.storage_path) ?? null,
    fixtureId: row.fixture_id,
    venueId: row.venue_id,
    verified: row.verified,
    takenAt: row.taken_at,
  }));
}

/** Uploads a proof photo and records it. A new photo for the same mission replaces the previous one. */
export async function saveMissionPhoto(userId: string, input: MissionPhotoInput) {
  const bucket = client().storage.from(BUCKET);
  // Re-encoded without metadata (no GPS from where the photo was taken), so always JPEG.
  const { bytes, mimeType } = await fotoParaEnviar(input.uri);
  const path = `${userId}/${input.missionId}-${Date.now()}.${extensionFor(mimeType)}`;

  const upload = await bucket.upload(path, bytes, { contentType: mimeType, upsert: false });
  if (upload.error) throw upload.error;

  const previous = await client()
    .from('mission_photo')
    .select('storage_path')
    .eq('profile_id', userId)
    .eq('mission_id', input.missionId)
    .maybeSingle();

  const { error } = previous.error
    ? previous
    : await client().from('mission_photo').upsert(
        {
          profile_id: userId,
          mission_id: input.missionId,
          storage_path: path,
          fixture_id: input.fixtureId,
          venue_id: input.venueId,
        },
        { onConflict: 'profile_id,mission_id' }
      );
  if (error) {
    // Do not leave an orphan file behind.
    await bucket.remove([path]);
    throw error;
  }

  if (previous.data && previous.data.storage_path !== path) {
    await bucket.remove([previous.data.storage_path]);
  }
}

export async function deleteMissionPhoto(userId: string, missionId: string) {
  const existing = await client()
    .from('mission_photo')
    .select('storage_path')
    .eq('profile_id', userId)
    .eq('mission_id', missionId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) return;

  const { error } = await client()
    .from('mission_photo')
    .delete()
    .eq('profile_id', userId)
    .eq('mission_id', missionId);
  if (error) throw error;

  await client().storage.from(BUCKET).remove([existing.data.storage_path]);
}
