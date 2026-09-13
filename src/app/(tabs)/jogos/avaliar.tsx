import { useLocalSearchParams } from 'expo-router';

import { FormularioAvaliacao } from '@/components/formulario-avaliacao';

export default function AvaliarScreen() {
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  return <FormularioAvaliacao jogoId={jogoId} />;
}
