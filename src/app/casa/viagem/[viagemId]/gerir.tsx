import { useLocalSearchParams } from 'expo-router';

import { GerirViagem } from '@/features/casas/components/GerirViagem';
import { Screen } from '@/ui/screen';

/** A Casa's trip, from its managers' side: opened with «Gerir» on the trip page. */
export default function GerirViagemScreen() {
  const { viagemId } = useLocalSearchParams<{ viagemId?: string }>();

  return <Screen>{viagemId ? <GerirViagem tripId={viagemId} /> : null}</Screen>;
}
