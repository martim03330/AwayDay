import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useSetSupportersClubFollow, useSupportersClub } from '@/features/casas/hooks/useCasas';
import { useSupportersClubTrips } from '@/features/casas/hooks/useClubTrips';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaCurto } from '@/lib/datas';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { BotaoAlternar } from '@/ui/botao-alternar';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/** «Porto x Benfica», when the game is in the catalogue. */
function nomeDoJogo(fixtureId: string) {
  const jogo = obterJogo(fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  return casa && fora ? `${casa.nomeCurto} x ${fora.nomeCurto}` : null;
}

/**
 * A Casa's page: name, the «Casa oficial» seal, club and municipality, «Seguir», and its upcoming trips. A suspended
 * Casa is hidden by the server, so it simply is not found.
 */
export function PaginaDaCasa({
  casaId,
  onAbrirViagem,
  renderMais,
}: {
  casaId: string;
  onAbrirViagem: (tripId: string) => void;
  /** The «⋯» next to the name (to report the Casa); not shown to its own managers. */
  renderMais?: (nome: string) => ReactNode;
}) {
  const theme = useTheme();
  const agora = useNow();
  const casa = useSupportersClub(casaId);
  const viagens = useSupportersClubTrips(casa.data ? casaId : null);
  const seguir = useSetSupportersClubFollow();

  if (casa.isLoading) return <SkeletonCard lines={3} />;

  if (!casa.data) {
    return (
      <EmptyState
        icon={icons.casa}
        title={casa.isError ? 'Sem ligação' : 'Casa indisponível'}
        message={casa.isError ? 'Tenta outra vez daqui a pouco.' : 'Esta Casa já não está disponível.'}
      />
    );
  }

  const dados = casa.data;
  const clube = obterClube(dados.clubId);
  const lista = viagens.data ?? [];

  return (
    <>
      <View style={styles.cabecalho}>
        <View style={styles.titulo}>
          <ThemedText type="subtitle" style={styles.flex}>
            {dados.name}
          </ThemedText>
          {renderMais && dados.myRole === null ? renderMais(dados.name) : null}
        </View>
        {dados.status === 'verified' ? (
          <View style={styles.etiquetas}>
            <Etiqueta icon={icons.selecionado} label="Casa oficial" tone="positivo" />
          </View>
        ) : null}
      </View>

      <Card style={styles.lista}>
        {clube ? (
          <LinhaGrupo
            leading={<Escudo clube={clube} size={36} />}
            title={clube.nomeCurto}
            subtitle="Clube"
            separador={dados.municipalityName !== ''}
          />
        ) : null}
        {dados.municipalityName ? (
          <LinhaGrupo
            leading={<IconCircle name={icons.cidade} />}
            title={dados.municipalityName}
            subtitle="Concelho"
          />
        ) : null}
      </Card>

      {dados.myRole === null && dados.status === 'verified' ? (
        <BotaoAlternar
          ativo={dados.following}
          onPress={() => seguir.mutate({ id: dados.id, follow: !dados.following })}
          label={{ ativo: 'A seguir', inativo: 'Seguir' }}
          icon={{ ativo: icons.selecionado, inativo: icons.mais }}
        />
      ) : null}

      <SectionHeader title="Próximas viagens" />
      {viagens.isLoading ? (
        <SkeletonCard lines={2} />
      ) : lista.length === 0 ? (
        <ThemedText themeColor="textSecondary">Ainda não há viagens marcadas.</ThemedText>
      ) : (
        <Card style={styles.lista}>
          {lista.map((viagem, indice) => {
            const jogo = nomeDoJogo(viagem.fixtureId);
            return (
              <LinhaGrupo
                key={viagem.id}
                onPress={() => onAbrirViagem(viagem.id)}
                accessibilityLabel={`${jogo ?? viagem.name}. Toca para abrir.`}
                leading={<IconCircle name={icons.autocarro} />}
                title={jogo ?? viagem.name}
                valor={formatarDiaCurto(new Date(viagem.kickoffAt), agora)}
                trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
                separador={indice < lista.length - 1}
              />
            );
          })}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: Spacing.one,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  etiquetas: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
});
