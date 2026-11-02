import { useLocalSearchParams } from 'expo-router';

import { GestoresDaCasa } from '@/features/casas/components/GestoresDaCasa';
import { Screen } from '@/ui/screen';

/** The managers of a Casa: the owner invites and removes them. */
export default function GestoresScreen() {
  const { casaId } = useLocalSearchParams<{ casaId?: string }>();

  return <Screen>{casaId ? <GestoresDaCasa casaId={casaId} /> : null}</Screen>;
}
