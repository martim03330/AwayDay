import { skipToken, useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useRideBoard, useRidePeople } from '@/features/rides/hooks/useRides';
import { fetchStayHouses, fetchStayPlacePeople } from '@/features/stays/api';
import { useNow } from '@/hooks/use-now';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import type { Jogo } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { SectionHeader } from '@/ui/section-header';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { useFormatarDinheiro } from '@/ui/valor';
import { useTheme } from '@/hooks/use-theme';

function nomes(lista: readonly { displayName?: string; name?: string; isMine?: boolean }[]) {
  return lista
    .filter((pessoa) => !pessoa.isMine)
    .map((pessoa) => pessoa.displayName ?? pessoa.name ?? '')
    .filter(Boolean);
}

/**
 * O teu grupo neste jogo: não é um grupo que se crie, é o que já combinaste — a boleia em que vais, a casa que vais
 * dividir e o tasco escolhido. Junta tudo num sítio para saberes com quem contas e a que horas.
 */
export function GrupoDoJogo({ jogo, tascoNome }: { jogo: Jogo; tascoNome?: string | null }) {
  const dinheiro = useFormatarDinheiro();
  const theme = useTheme();
  const userId = useUserId();
  const agora = useNow(60 * 1000);

  const quadro = useRideBoard(jogo.id, userId !== null);
  const boleia = (quadro.data ?? []).find(
    (candidata) =>
      candidata.status === 'open' && (candidata.isMine || candidata.myStatus === 'accepted')
  );
  const pessoasDaBoleia = useRidePeople(boleia?.id ?? null, boleia !== undefined);

  const casas = useQuery({
    queryKey: ['stays', jogo.id],
    queryFn: userId ? () => fetchStayHouses(jogo.id) : skipToken,
    meta: { persist: false },
  });
  const casa = (casas.data ?? []).find(
    (candidata) => candidata.isMine || candidata.myStatus === 'aceite'
  );
  const pessoasDaCasa = useQuery({
    queryKey: ['stays', 'places', casa?.id ?? null],
    queryFn: casa ? () => fetchStayPlacePeople(casa.id) : skipToken,
    meta: { persist: false },
  });

  if (!userId || (!boleia && !casa && !tascoNome)) return null;

  const naBoleia = nomes(
    (pessoasDaBoleia.data ?? []).filter((pessoa) => pessoa.status !== 'requested')
  );
  const naCasa = nomes(
    (pessoasDaCasa.data ?? []).filter((pessoa) => pessoa.status === 'aceite')
  ).concat(casa && !casa.isMine ? [casa.displayName] : []);
  const gente = new Set([...naBoleia, ...naCasa]);

  return (
    <>
      <SectionHeader title="O teu grupo" />
      <Card style={styles.card}>
        <ThemedText style={styles.titulo}>
          {gente.size > 0
            ? `Vais com mais ${plural(gente.size, 'pessoa', 'pessoas')}`
            : 'Ainda vais sozinho'}
        </ThemedText>

        {boleia ? (
          <View style={styles.linha}>
            <Icon name={icons.carro} size={18} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText>
                {boleia.isMine ? 'A tua boleia' : `Boleia de ${boleia.driverName}`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`Sai ${formatarDiaEHora(new Date(boleia.departureAt), agora).toLowerCase()} de ${boleia.originName}${naBoleia.length > 0 ? ` · com ${naBoleia.join(', ')}` : ''}`}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {casa ? (
          <View style={styles.linha}>
            <Icon name={icons.casa} size={18} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText>
                {casa.isMine ? 'A casa que propuseste' : `Casa de ${casa.displayName}`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`${dinheiro.formatar(casa.shareNowCents)} cada · ${plural(casa.nights, 'noite', 'noites')}${casa.status === 'reservada' ? ' · já reservada' : ' · ainda a juntar gente'}`}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {tascoNome ? (
          <View style={styles.linha}>
            <Icon name={icons.locais} size={18} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText>{tascoNome}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                É onde a malta se junta antes do jogo.
              </ThemedText>
            </View>
          </View>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  titulo: {
    fontWeight: 800,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
});
