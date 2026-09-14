import type {
  ClubRelation,
  MessagePreferences,
  MyProfile,
  NotificationKind,
  NotificationPreferences,
} from '@/features/profile/types';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** The signed-in user's profile and clubs. `null` if the profile does not exist (yet). */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const [profile, clubs] = await Promise.all([
    client()
      .from('profile')
      .select('id, display_name, nudges_enabled, recap_enabled')
      .eq('id', userId)
      .maybeSingle(),
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
    nudgesEnabled: profile.data.nudges_enabled,
    recapEnabled: profile.data.recap_enabled,
  };
}

/** Turns match-day suggestions or the season recap on or off. */
export async function updateMessagePreferences(userId: string, preferences: MessagePreferences) {
  const { error } = await client()
    .from('profile')
    .update({
      ...(preferences.nudgesEnabled === undefined ? {} : { nudges_enabled: preferences.nudgesEnabled }),
      ...(preferences.recapEnabled === undefined ? {} : { recap_enabled: preferences.recapEnabled }),
    })
    .eq('id', userId);
  if (error) throw error;
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

const NOTIFICATION_KINDS: readonly NotificationKind[] = ['kickoff_change', 'weather', 'group_movement', 'new_stamp'];

function isNotificationKind(value: string): value is NotificationKind {
  return NOTIFICATION_KINDS.some((kind) => kind === value);
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await client()
    .from('notification_preference')
    .select('kind, enabled')
    .eq('profile_id', userId);
  if (error) throw error;
  const preferences: NotificationPreferences = {};
  for (const row of data) {
    if (isNotificationKind(row.kind)) preferences[row.kind] = row.enabled;
  }
  return preferences;
}

export async function saveNotificationPreference(userId: string, kind: NotificationKind, enabled: boolean) {
  const { error } = await client()
    .from('notification_preference')
    .upsert({ profile_id: userId, kind, enabled }, { onConflict: 'profile_id,kind' });
  if (error) throw error;
}
