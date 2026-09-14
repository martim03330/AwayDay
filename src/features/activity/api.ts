import type { AttendanceStatus, PlaceVisitSource, ReviewInput } from '@/features/activity/types';
import { supabase } from '@/lib/supabase';

// The signed-in user's own activity. RLS only ever lets people read and write their own rows, and the
// database decides from the fixture's kick-off whether "going" or "attended" is allowed.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function toStatus(value: string | undefined): AttendanceStatus | null {
  return value === 'going' || value === 'attended' ? value : null;
}

export async function fetchAttendance(userId: string, fixtureId: string) {
  const { data, error } = await client()
    .from('fixture_attendance')
    .select('status')
    .eq('profile_id', userId)
    .eq('fixture_id', fixtureId)
    .maybeSingle();
  if (error) throw error;
  return toStatus(data?.status);
}

/** Every fixture the user marked as going or attended, by fixture id. */
export async function fetchMyAttendance(userId: string): Promise<Record<string, AttendanceStatus>> {
  const { data, error } = await client()
    .from('fixture_attendance')
    .select('fixture_id, status')
    .eq('profile_id', userId);
  if (error) throw error;

  const byFixture: Record<string, AttendanceStatus> = {};
  for (const row of data) {
    const status = toStatus(row.status);
    if (status) byFixture[row.fixture_id] = status;
  }
  return byFixture;
}

/** Marks or unmarks "going". Never turns a fixture already marked as attended back into "going". */
export async function setGoing(userId: string, fixtureId: string, going: boolean) {
  if (going) {
    const { error } = await client()
      .from('fixture_attendance')
      .upsert(
        { profile_id: userId, fixture_id: fixtureId, status: 'going' },
        { onConflict: 'profile_id,fixture_id', ignoreDuplicates: true }
      );
    if (error) throw error;
    return;
  }

  const { error } = await client()
    .from('fixture_attendance')
    .delete()
    .eq('profile_id', userId)
    .eq('fixture_id', fixtureId)
    .eq('status', 'going');
  if (error) throw error;
}

/** After a fixture: the user was there, with the scores they gave. */
export async function recordReview(userId: string, review: ReviewInput) {
  const attendance = await client()
    .from('fixture_attendance')
    .upsert(
      { profile_id: userId, fixture_id: review.fixtureId, status: 'attended' },
      { onConflict: 'profile_id,fixture_id' }
    );
  if (attendance.error) throw attendance.error;

  const { error } = await client().from('venue_review').upsert(
    {
      profile_id: userId,
      fixture_id: review.fixtureId,
      stadium_score: review.stadium,
      atmosphere_score: review.atmosphere,
      access_score: review.access,
      comment: review.comment.trim(),
    },
    { onConflict: 'profile_id,fixture_id' }
  );
  if (error) throw error;
}

/** Adds a visit to the user's private place history and returns its id. */
export async function recordPlaceVisit(userId: string, placeId: string, source: PlaceVisitSource) {
  const { data, error } = await client()
    .from('place_visit')
    .insert({ profile_id: userId, place_id: placeId, source })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deletePlaceVisit(visitId: string) {
  const { error } = await client().from('place_visit').delete().eq('id', visitId);
  if (error) throw error;
}
