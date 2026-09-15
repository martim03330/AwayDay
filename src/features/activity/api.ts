import {
  NoiseMeasurementRefused,
  type AttendanceStatus,
  type NoiseMeasurementRecord,
  type PlaceVisitRecord,
  type PlaceVisitSource,
  type ReviewInput,
  type ReviewRecord,
} from '@/features/activity/types';
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

/**
 * Adds a visit to the user's private place history and returns its id. `visitedAt` is only for bringing
 * visits made without an account into it; the database refuses visits in the future.
 */
export async function recordPlaceVisit(
  userId: string,
  placeId: string,
  source: PlaceVisitSource,
  visitedAt?: string
) {
  const { data, error } = await client()
    .from('place_visit')
    .insert({ profile_id: userId, place_id: placeId, source, visited_at: visitedAt })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deletePlaceVisit(visitId: string) {
  const { error } = await client().from('place_visit').delete().eq('id', visitId);
  if (error) throw error;
}

export async function fetchMyReviews(userId: string): Promise<ReviewRecord[]> {
  const { data, error } = await client()
    .from('venue_review')
    .select(
      'fixture_id, stadium_score, atmosphere_score, access_score, comment, created_at, updated_at'
    )
    .eq('profile_id', userId);
  if (error) throw error;
  return data.map((row) => ({
    fixtureId: row.fixture_id,
    stadium: row.stadium_score,
    atmosphere: row.atmosphere_score,
    access: row.access_score,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchMyPlaceVisits(userId: string): Promise<PlaceVisitRecord[]> {
  const { data, error } = await client()
    .from('place_visit')
    .select('id, place_id, visited_at, source')
    .eq('profile_id', userId)
    .order('visited_at', { ascending: false });
  if (error) throw error;
  return data.flatMap((row) =>
    row.source === 'check-in' || row.source === 'manual'
      ? [{ id: row.id, placeId: row.place_id, visitedAt: row.visited_at, source: row.source }]
      : []
  );
}

/** The user's own score for each tasco they rated, by place id. */
export async function fetchMyPlaceRatings(userId: string): Promise<Record<string, number>> {
  const { data, error } = await client()
    .from('place_rating')
    .select('place_id, score')
    .eq('profile_id', userId);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.place_id, row.score]));
}

export async function savePlaceRating(userId: string, placeId: string, score: number) {
  const { error } = await client()
    .from('place_rating')
    .upsert(
      { profile_id: userId, place_id: placeId, score },
      { onConflict: 'profile_id,place_id' }
    );
  if (error) throw error;
}

export async function fetchMyNoiseMeasurements(userId: string): Promise<NoiseMeasurementRecord[]> {
  const { data, error } = await client()
    .from('noise_measurement')
    .select('id, fixture_id, level, measured_at')
    .eq('profile_id', userId)
    .order('measured_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fixtureId: row.fixture_id,
    level: row.level,
    measuredAt: row.measured_at,
  }));
}

/**
 * Records a valid reading. The server only accepts it while the fixture is being played, with a verified check-in
 * that day near the stadium, and at least 8 minutes after the previous one; otherwise this throws
 * NoiseMeasurementRefused.
 */
export async function recordNoiseMeasurement(
  fixtureId: string,
  level: number
): Promise<NoiseMeasurementRecord> {
  const { data, error } = await client().rpc('record_noise_measurement', {
    p_fixture_id: fixtureId,
    p_level: Math.round(level),
  });
  if (error) {
    if (error.message === 'noise_measurement_too_soon')
      throw new NoiseMeasurementRefused('too-soon');
    if (error.message === 'fixture_not_live') throw new NoiseMeasurementRefused('not-live');
    if (error.message === 'noise_needs_checkin')
      throw new NoiseMeasurementRefused('needs-check-in');
    throw error;
  }
  return {
    id: data.id,
    fixtureId: data.fixture_id,
    level: data.level,
    measuredAt: data.measured_at,
  };
}

/** Ids of the approved dishes the user recommends. Who recommends what is private; only counts are public. */
export async function fetchMyDishRecommendations(userId: string): Promise<string[]> {
  const { data, error } = await client()
    .from('dish_recommendation')
    .select('dish_id')
    .eq('profile_id', userId);
  if (error) throw error;
  return data.map((row) => row.dish_id);
}

/** Recommends an approved dish. Recommending twice is harmless. The server keeps the dish's count. */
export async function recommendDish(userId: string, dishId: string) {
  const { error } = await client()
    .from('dish_recommendation')
    .upsert(
      { profile_id: userId, dish_id: dishId },
      { onConflict: 'profile_id,dish_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function unrecommendDish(userId: string, dishId: string) {
  const { error } = await client()
    .from('dish_recommendation')
    .delete()
    .eq('profile_id', userId)
    .eq('dish_id', dishId);
  if (error) throw error;
}

export type PlaceSubScores = { beerScore: number | null; foodScore: number | null };

/** The user's beer and food scores, by place id, for the places they rated. */
export async function fetchMyPlaceSubScores(
  userId: string
): Promise<Record<string, PlaceSubScores>> {
  const { data, error } = await client()
    .from('place_rating')
    .select('place_id, beer_score, food_score')
    .eq('profile_id', userId);
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [row.place_id, { beerScore: row.beer_score, foodScore: row.food_score }])
  );
}

/**
 * Beer and food scores for a place the user already rated: the overall score is required first, so this only
 * updates an existing rating (and changes nothing otherwise).
 */
export async function savePlaceSubScores(userId: string, placeId: string, scores: PlaceSubScores) {
  const { error } = await client()
    .from('place_rating')
    .update({ beer_score: scores.beerScore, food_score: scores.foodScore })
    .eq('profile_id', userId)
    .eq('place_id', placeId);
  if (error) throw error;
}

/** The user's answers to "is this a good place for match day?", by place id. */
export async function fetchMyPlaceVotes(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await client()
    .from('place_vote')
    .select('place_id, is_good')
    .eq('profile_id', userId);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.place_id, row.is_good]));
}

/** Answers for a suggested place. The server counts the votes and confirms or hides the place. */
export async function votePlace(userId: string, placeId: string, isGood: boolean) {
  const { error } = await client()
    .from('place_vote')
    .upsert(
      { profile_id: userId, place_id: placeId, is_good: isGood },
      { onConflict: 'profile_id,place_id' }
    );
  if (error) throw error;
}

/** The user's answers to "does this tasco have a toilet for customers?", by place id. */
export async function fetchMyToiletAnswers(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await client()
    .from('place_toilet_answer')
    .select('place_id, has_toilet')
    .eq('profile_id', userId);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.place_id, row.has_toilet]));
}

/** Answers whether a tasco has a toilet for customers. The server keeps the counts. */
export async function answerPlaceToilet(userId: string, placeId: string, hasToilet: boolean) {
  const { error } = await client()
    .from('place_toilet_answer')
    .upsert(
      { profile_id: userId, place_id: placeId, has_toilet: hasToilet },
      { onConflict: 'profile_id,place_id' }
    );
  if (error) throw error;
}

/** The fixtures the user is going to, with the tasco picked for each (`null` when none yet). */
export async function fetchMyPlans(userId: string): Promise<Record<string, string | null>> {
  const { data, error } = await client()
    .from('fixture_attendance')
    .select('fixture_id, place_id')
    .eq('profile_id', userId)
    .eq('status', 'going');
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.fixture_id, row.place_id]));
}

/** Picks (or clears, with `null`) the tasco for a game the user is going to. */
export async function setPlanPlace(userId: string, fixtureId: string, placeId: string | null) {
  const { error } = await client()
    .from('fixture_attendance')
    .update({ place_id: placeId })
    .eq('profile_id', userId)
    .eq('fixture_id', fixtureId)
    .eq('status', 'going');
  if (error) throw error;
}

/** How many fans said they are going to a game; `null` below 5 (aggregates are never published for fewer). */
export async function fetchGoingCount(fixtureId: string): Promise<number | null> {
  const { data, error } = await client().rpc('fixture_going_count', { p_fixture_id: fixtureId });
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}
