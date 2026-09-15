import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import type { IncidentReason } from '@/features/rides/api';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { ThemedText } from '@/ui/themed-text';

export const MOTIVOS: Record<IncidentReason, string> = {
  doenca: 'Doença',
  avaria: 'Avaria do carro',
  acidente_transito: 'Acidente ou trânsito',
  trabalho_familia: 'Trabalho ou família',
  outro: 'Outro motivo',
};

type ImprevistoBoleiaProps = {
  visivel: boolean;
  aEnviar: boolean;
  onEnviar: (motivo: IncidentReason, nota: string) => void;
  onFechar: () => void;
};

/** "Tive um imprevisto": the reason and a short note the others in the ride will read and vote on. */
export function ImprevistoBoleia({ visivel, aEnviar, onEnviar, onFechar }: ImprevistoBoleiaProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [motivo, setMotivo] = useState<IncidentReason | null>(null);
  const [nota, setNota] = useState('');

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onFechar}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + Spacing.four }]}>
        <ThemedText type="title" style={styles.titulo}>
          Tive um imprevisto
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Quem ia na boleia vê o motivo e decide se aceita. Se aceitarem, ou se ninguém votar
          contra, não fica falta. Sê honesto: a malta percebe.
        </ThemedText>
        <View style={styles.chips}>
          {(Object.keys(MOTIVOS) as IncidentReason[]).map((chave) => (
            <Chip
              key={chave}
              label={MOTIVOS[chave]}
              selected={chave === motivo}
              onPress={() => setMotivo(chave)}
            />
          ))}
        </View>
        <Campo
          label="O que aconteceu (opcional)"
          value={nota}
          onChangeText={setNota}
          placeholder="Ex.: o carro não pegou de manhã"
          maxLength={280}
        />
        <Button
          label={aEnviar ? 'A enviar…' : 'Enviar à malta da boleia'}
          disabled={!motivo || aEnviar}
          onPress={() => motivo && onEnviar(motivo, nota.trim())}
        />
        <Button label="Voltar" variant="secondary" onPress={onFechar} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: 20,
  },
  titulo: {
    fontSize: 30,
    lineHeight: 34,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
