import { parseCoachMessage } from '@/features/coach/context';
import type { CoachMessage } from '@/features/coach/types';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/**
 * The message for the user's current context, from the `coach-message` edge function. The facts are worked
 * out there, in SQL; `now` only moves the clock in demo mode. `null`: nothing worth saying.
 */
export async function fetchCoachMessage(now: Date): Promise<CoachMessage | null> {
  const { data, error } = await client().functions.invoke<unknown>('coach-message', {
    method: 'POST',
    body: { now: now.toISOString() },
  });
  if (error) throw error;
  return parseCoachMessage(data);
}
