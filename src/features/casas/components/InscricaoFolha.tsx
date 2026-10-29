import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import type { ClubTripStop } from '@/features/casas/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';
import { Valor } from '@/ui/valor';

/** The same limits as the server's `club_trip_companions_ok`. */
const MAX_ACOMPANHANTES = 10;
const NOME_MIN = 2;
const NOME_MAX = 60;

export type PedidoDeInscricao = {
  stopId: string;
  companions: string[];
  memberCode: string | null;
};

type InscricaoFolhaProps = {
  visivel: boolean;
  stops: ClubTripStop[];
  membersOnly: boolean;
  priceCents: number;
  onConfirmar: (pedido: PedidoDeInscricao) => void;
  onFechar: () => void;
};

/**
 * Booking a Casa's trip: where to get on, who comes along (by name: children, family, members without the app), and
 * the member code for a «só sócios» trip. The amount due is the server's: the sheet only shows the price per person.
 */
export function InscricaoFolha({
  visivel,
  stops,
  membersOnly,
  priceCents,
  onConfirmar,
  onFechar,
}: InscricaoFolhaProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const unicaParagem = stops.length === 1 ? (stops[0]?.id ?? null) : null;
  const [paragem, setParagem] = useState<string | null>(null);
  const [acompanhantes, setAcompanhantes] = useState<string[]>([]);
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const escolhida = paragem ?? unicaParagem;

  const nomeLimpo = nome.trim();
  const podeAcrescentar =
    nomeLimpo.length >= NOME_MIN && nomeLimpo.length <= NOME_MAX && acompanhantes.length < MAX_ACOMPANHANTES;
  const podeConfirmar = escolhida !== null && (!membersOnly || codigo.trim().length > 0);

  function limpar() {
    setParagem(null);
    setAcompanhantes([]);
    setNome('');
    setCodigo('');
  }

  function fechar() {
    limpar();
    onFechar();
  }

  function acrescentar() {
    if (!podeAcrescentar) return;
    setAcompanhantes((atuais) => [...atuais, nomeLimpo]);
    setNome('');
  }

  function confirmar() {
    if (!escolhida || !podeConfirmar) return;
    onConfirmar({
      stopId: escolhida,
      companions: acompanhantes,
      memberCode: membersOnly ? codigo.trim() : null,
    });
    limpar();
  }

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={fechar}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + Spacing.four }]}>
        <ThemedText type="title" style={styles.titulo}>
          Inscrição
        </ThemedText>
        {priceCents > 0 ? (
          <Valor cents={priceCents} depois=" por pessoa" themeColor="textSecondary" />
        ) : (
          <ThemedText themeColor="textSecondary">Gratuito</ThemedText>
        )}

        <ThemedText type="smallBold">Onde entras</ThemedText>
        <View style={styles.chips}>
          {stops.map((stop) => (
            <Chip
              key={stop.id}
              label={`${stop.name} · ${formatarHora(new Date(stop.passesAt))}`}
              selected={stop.id === escolhida}
              onPress={() => setParagem(stop.id)}
            />
          ))}
        </View>

        <ThemedText type="smallBold">Quem vai contigo</ThemedText>
        {acompanhantes.length > 0 ? (
          <View style={styles.chips}>
            {acompanhantes.map((acompanhante, indice) => (
              <Chip
                key={`${indice}-${acompanhante}`}
                label={acompanhante}
                selected
                accessibilityLabel={`Tirar ${acompanhante}`}
                onPress={() => setAcompanhantes((atuais) => atuais.filter((_, outro) => outro !== indice))}
              />
            ))}
          </View>
        ) : null}
        {acompanhantes.length < MAX_ACOMPANHANTES ? (
          <>
            <Campo
              label="Nome de quem vai contigo"
              value={nome}
              onChangeText={setNome}
              placeholder="Ex.: Rita Santos"
              autoCapitalize="words"
              maxLength={NOME_MAX}
              returnKeyType="done"
              onSubmitEditing={acrescentar}
            />
            <LinkTexto label="Acrescentar" disabled={!podeAcrescentar} onPress={acrescentar} />
          </>
        ) : null}

        {membersOnly ? (
          <Campo
            label="Código de sócio"
            value={codigo}
            onChangeText={setCodigo}
            ajuda="Esta viagem é só para sócios. O código é dado pela Casa."
            autoCapitalize="none"
            maxLength={40}
          />
        ) : null}

        <Button label="Inscrever-me" disabled={!podeConfirmar} onPress={confirmar} />
        <LinkTexto neutro label="Deixa estar" onPress={fechar} />
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
    gap: Spacing.two,
  },
});
