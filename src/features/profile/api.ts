import type {
  ClubRelation,
  ProfileCard,
  MessagePreferences,
  MyProfile,
  NotificationKind,
  NotificationPreferences,
} from '@/features/profile/types';
import { base64ParaBytes, lerFicheiroEmBase64 } from '@/lib/ficheiros';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** As fotos de perfil vivem num balde privado: só se abrem com um link assinado, e só para quem tem conta. */
const BALDE_FOTOS = 'avatars';
/** Os links duram uma hora; as consultas que os guardam voltam a perguntar muito antes disso. */
const SEGUNDOS_DO_LINK = 60 * 60;

async function linkDaFoto(caminhos: (string | null)[]): Promise<Record<string, string>> {
  const validos = [...new Set(caminhos.filter((caminho): caminho is string => Boolean(caminho)))];
  if (validos.length === 0) return {};
  const assinados = await client()
    .storage.from(BALDE_FOTOS)
    .createSignedUrls(validos, SEGUNDOS_DO_LINK);
  if (assinados.error) throw assinados.error;
  return Object.fromEntries(
    assinados.data.flatMap((item) => (item.signedUrl ? [[item.path ?? '', item.signedUrl]] : []))
  );
}

/** The signed-in user's profile and clubs. `null` if the profile does not exist (yet). */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const [profile, clubs] = await Promise.all([
    client()
      .from('profile')
      .select(
        'id, display_name, avatar_path, home_city, nudges_enabled, recap_enabled, show_in_rankings, is_admin'
      )
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
    avatarPath: profile.data.avatar_path,
    avatarUrl:
      (await linkDaFoto([profile.data.avatar_path]))[profile.data.avatar_path ?? ''] ?? null,
    homeCity: profile.data.home_city,
    supporterClubId: clubFor('supporter'),
    hometownClubId: clubFor('hometown'),
    nudgesEnabled: profile.data.nudges_enabled,
    recapEnabled: profile.data.recap_enabled,
    showInRankings: profile.data.show_in_rankings,
    isAdmin: profile.data.is_admin,
  };
}

/** Shows or hides the user's name and club in the rankings. */
export async function updateRankingVisibility(userId: string, showInRankings: boolean) {
  const { error } = await client()
    .from('profile')
    .update({ show_in_rankings: showInRankings })
    .eq('id', userId);
  if (error) throw error;
}

/** Turns match-day suggestions or the season recap on or off. */
export async function updateMessagePreferences(userId: string, preferences: MessagePreferences) {
  const { error } = await client()
    .from('profile')
    .update({
      ...(preferences.nudgesEnabled === undefined
        ? {}
        : { nudges_enabled: preferences.nudgesEnabled }),
      ...(preferences.recapEnabled === undefined
        ? {}
        : { recap_enabled: preferences.recapEnabled }),
    })
    .eq('id', userId);
  if (error) throw error;
}

/** Sets (or removes, with `null`) one of the user's clubs. RLS only lets people change their own. */
export async function saveProfileClub(
  userId: string,
  relation: ClubRelation,
  clubId: string | null
) {
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
    .upsert(
      { profile_id: userId, relation, club_id: clubId },
      { onConflict: 'profile_id,relation' }
    );
  if (error) throw error;
}

const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'kickoff_change',
  'weather',
  'group_movement',
  'new_stamp',
  'ride_message',
  'invites',
  'friends',
  'trip_money',
];

function isNotificationKind(value: string): value is NotificationKind {
  return NOTIFICATION_KINDS.some((kind) => kind === value);
}

export async function fetchNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
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

export async function saveNotificationPreference(
  userId: string,
  kind: NotificationKind,
  enabled: boolean
) {
  const { error } = await client()
    .from('notification_preference')
    .upsert({ profile_id: userId, kind, enabled }, { onConflict: 'profile_id,kind' });
  if (error) throw error;
}

export type ProfileRefusal =
  | 'not_signed_in'
  | 'bad_name'
  | 'bad_city'
  | 'bad_path'
  | 'bad_request'
  | 'no_photo'
  | 'not_admin'
  | 'rate_limited'
  | 'unknown';

export class ProfileRefused extends Error {
  readonly reason: ProfileRefusal;

  constructor(reason: ProfileRefusal) {
    super(reason);
    this.name = 'ProfileRefused';
    this.reason = reason;
  }
}

const RECUSAS: ProfileRefusal[] = [
  'not_signed_in',
  'bad_name',
  'bad_city',
  'bad_path',
  'bad_request',
  'no_photo',
  'not_admin',
  'rate_limited',
];

function refusal(error: { message: string }) {
  return new ProfileRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

export async function setDisplayName(name: string) {
  const { error } = await client().rpc('set_display_name', { p_name: name.trim() });
  if (error) throw refusal(error);
}

/** Uma cidade vazia apaga o que lá estava. */
export async function setHomeCity(city: string) {
  const { error } = await client().rpc('set_home_city', { p_city: city.trim() });
  if (error) throw refusal(error);
}

/** Sobe a foto para a pasta da própria pessoa e guarda-a no perfil. Devolve o link já assinado. */
export async function saveProfilePhoto(
  userId: string,
  input: { uri: string; mimeType: string }
): Promise<string | null> {
  const extensao =
    input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/heic' ? 'heic' : 'jpg';
  const caminho = `${userId}/${Date.now()}.${extensao}`;
  const bytes = base64ParaBytes(await lerFicheiroEmBase64(input.uri));

  const subida = await client()
    .storage.from(BALDE_FOTOS)
    .upload(caminho, bytes, { contentType: input.mimeType, upsert: false });
  if (subida.error) throw subida.error;

  const anterior = await client()
    .from('profile')
    .select('avatar_path')
    .eq('id', userId)
    .maybeSingle();

  const { error } = await client().rpc('set_profile_photo', { p_path: caminho });
  if (error) throw refusal(error);

  // A foto antiga já não serve a ninguém: fica só a ocupar espaço.
  const antiga = anterior.data?.avatar_path;
  if (antiga && antiga !== caminho) {
    await client().storage.from(BALDE_FOTOS).remove([antiga]);
  }

  return (await linkDaFoto([caminho]))[caminho] ?? null;
}

export async function clearProfilePhoto(userId: string) {
  const anterior = await client()
    .from('profile')
    .select('avatar_path')
    .eq('id', userId)
    .maybeSingle();
  const { error } = await client().rpc('clear_profile_photo');
  if (error) throw refusal(error);
  if (anterior.data?.avatar_path) {
    await client().storage.from(BALDE_FOTOS).remove([anterior.data.avatar_path]);
  }
}

/** Os cartões destas pessoas, com as fotos já em link assinado. */
export async function fetchProfileCards(profileIds: string[]): Promise<ProfileCard[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = await client().rpc('profile_cards', { p_profile_ids: profileIds });
  if (error) throw error;
  const links = await linkDaFoto(data.map((row) => row.avatar_path));
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    avatarUrl: row.avatar_path ? (links[row.avatar_path] ?? null) : null,
    homeCity: row.home_city,
    memberSince: row.member_since ?? '',
    ridesCompleted: row.rides_completed ?? 0,
    ridesFaults: row.rides_faults ?? 0,
    isMe: row.is_me === true,
  }));
}

/** Denunciar a foto de alguém. Quem administra depois tira-a. */
export async function reportProfilePhoto(profileId: string, reason?: string) {
  const { error } = await client().rpc('report_profile_photo', {
    p_profile_id: profileId,
    p_reason: reason?.trim(),
  });
  if (error) throw refusal(error);
}
