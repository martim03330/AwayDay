import type { ClubRelation, MyProfile } from '@/features/profile/types';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** The signed-in user's profile and clubs. `null` if the profile does not exist (yet). */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const [profile, clubs] = await Promise.all([
    client().from('profile').select('id, display_name').eq('id', userId).maybeSingle(),
    client().from('profile_club').select('relation, club_id').eq('profile_id', userId),
  ]);
  if (profile.error) throw profile.error;
  if (clubs.error) throw clubs.error;
  if (!profile.data) return null;

  const clubFor = (relation: ClubRelation) =>
    clubs.data.find((row) => row.relation === relation)?.club_id ?? null;

  return {
    id: profile.data.id,
    displayName: profile.data.display_name,
    supporterClubId: clubFor('supporter'),
    hometownClubId: clubFor('hometown'),
  };
}

/** Sets (or removes, with `null`) one of the user's clubs. RLS only lets people change their own. */
export async function saveProfileClub(userId: string, relation: ClubRelation, clubId: string | null) {
  if (clubId === null) {
    const { error } = await client()
      .from('profile_club')
      .delete()
      .eq('profile_id', userId)
      .eq('relation', relation);
    if (error) throw error;
    return;
  }

  const { error } = await client()
    .from('profile_club')
    .upsert({ profile_id: userId, relation, club_id: clubId }, { onConflict: 'profile_id,relation' });
  if (error) throw error;
}
