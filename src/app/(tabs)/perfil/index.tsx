import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AlbumResumo } from '@/components/album-resumo';
import { HistoricoAvaliacoes } from '@/components/historico-avaliacoes';
import { HistoricoTascos } from '@/components/historico-tascos';
import { MissoesCard } from '@/components/missoes-card';
import { ModoDemoCard } from '@/components/modo-demo-card';
import { PassaporteCard } from '@/components/passaporte-card';
import { RankingCard } from '@/components/ranking-card';
import { Spacing } from '@/constants/theme';
import { AccountCard } from '@/features/auth/components/AccountCard';
import { useMyNudges } from '@/features/nudges/hooks/useMyNudges';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { useLatestRecap } from '@/features/recap/hooks/useLatestRecap';
import { seasonLabel } from '@/features/recap/stats';
import { useTheme } from '@/hooks/use-theme';
import { formatarNumero, plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { contarTascosVerificados, ID_UTILIZADOR, montarRanking } from '@/lib/tascos';
import { nomesDivisao, obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { TIPOS_NOTIFICACAO } from '@/mocks/notificacoes';
import { rankingMock } from '@/mocks/ranking';
import { useAppState, type EstadoPermissao } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** Toques seguidos no cartão do perfil para revelar o modo demo. */
const TOQUES_MODO_DEMO = 5;
const JANELA_TOQUES_MS = 3000;

function textoPermissao(estado: EstadoPermissao) {
  if (estado === 'aceite') return 'Aceite na introdução (simulado)';
  if (estado === 'recusada') return 'Continuas sem (simulado)';
  return 'Ainda não decidiste';
}

export default function PerfilScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { simulacao } = useRelogio();
  const {
    clubeFavoritoId,
    clubeDaTerraId,
    estadiosVisitados,
    avaliacoes,
    visitasLocais,
    fotosMissoes,
    sonsLigados,
    alternarSons,
    notificacoes,
    permissoes,
    reverIntroducao,
  } = useAppState();
  const [modoDemoVisivel, setModoDemoVisivel] = useState(false);
  const [toques, setToques] = useState<readonly number[]>([]);
  const userId = useUserId();
  const perfilDaConta = useMyProfile(userId);
  const novidades = useMyNudges(userId);
  const porLer = novidades.data?.filter((nudge) => nudge.readAt === null).length ?? 0;
  const retrospetiva = useLatestRecap(userId);

  const clube = obterClube(clubeFavoritoId);
  const estadioDoClube = clube ? obterEstadio(clube.estadioId) : undefined;
  const clubeDaTerra = clubeDaTerraId ? obterClube(clubeDaTerraId) : undefined;
  const tascosVerificados = contarTascosVerificados(visitasLocais);
  const ranking = montarRanking(rankingMock, {
    id: ID_UTILIZADOR,
    nome: 'Tu',
    clubeId: clubeFavoritoId,
    tascosVerificados,
  });
  const notificacoesLigadas = TIPOS_NOTIFICACAO.filter((tipo) => notificacoes[tipo]).length;
  const chevron = <Icon name={icons.seguinte} size={16} color={theme.textSecondary} />;

  function tocarNoPerfil() {
    const agora = Date.now();
    const recentes = [...toques.filter((toque) => agora - toque < JANELA_TOQUES_MS), agora];
    if (recentes.length >= TOQUES_MODO_DEMO) {
      setModoDemoVisivel((visivel) => !visivel);
      setToques([]);
    } else {
      setToques(recentes);
    }
  }

  return (
    <Screen>
      <Card style={styles.perfil} onPress={tocarNoPerfil} accessibilityLabel="O teu perfil">
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.avatarEmoji}>🧣</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" style={styles.nome}>
            {perfilDaConta.data?.displayName ?? 'Adepto AwayDay'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Modo demo · ${plural(tascosVerificados, 'tasco verificado', 'tascos verificados')}`}
          </ThemedText>
        </View>
      </Card>
      {simulacao ? (
        <View style={styles.etiqueta}>
          <Etiqueta icon={icons.demo} label="Hora simulada ativa" tone="aviso" />
        </View>
      ) : null}

      {supabase ? (
        <>
          <SectionHeader title="Conta" />
          <AccountCard displayName={perfilDaConta.data?.displayName ?? null} />
          {userId ? (
            <Card
              onPress={() => router.push('/perfil/novidades')}
              accessibilityLabel={`Novidades${porLer > 0 ? `: ${plural(porLer, 'dica por ler', 'dicas por ler')}` : ''}. Toca para abrir.`}>
              <ListRow
                leading={<IconCircle name={icons.notificacoes} />}
                title="Novidades"
                subtitle={
                  porLer > 0
                    ? plural(porLer, 'dica por ler', 'dicas por ler')
                    : 'Dicas para os teus dias de jogo'
                }
                trailing={chevron}
              />
            </Card>
          ) : null}
          {retrospetiva.data ? (
            <Card
              onPress={() => router.push('/perfil/retrospetiva')}
              accessibilityLabel={`Retrospetiva da época ${seasonLabel(retrospetiva.data.seasonId)}. Toca para abrir.`}>
              <ListRow
                leading={<IconCircle name={icons.estrela} />}
                title={`A tua época ${seasonLabel(retrospetiva.data.seasonId)}`}
                subtitle={retrospetiva.data.headline}
                trailing={chevron}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      <SectionHeader title="Clube que apoio" />
      {clube ? (
        <Card
          onPress={() => router.push('/perfil/clube')}
          accessibilityLabel={`Clube que apoio: ${clube.nomeCurto}, ${formatarNumero(clube.adeptosNaApp)} adeptos na app. Toca para mudar.`}>
          <ListRow
            leading={<Escudo clube={clube} size={40} />}
            title={clube.nomeCurto}
            subtitle={[
              clube.divisao ? nomesDivisao[clube.divisao] : null,
              estadioDoClube?.nome ?? null,
              `${formatarNumero(clube.adeptosNaApp)} adeptos na app`,
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={chevron}
          />
        </Card>
      ) : null}

      <SectionHeader title="Clube da terra" />
      {clubeDaTerra ? (
        <Card
          onPress={() => router.push('/perfil/clube-terra')}
          accessibilityLabel={`Clube da terra: ${clubeDaTerra.nomeCurto}. Toca para mudar.`}>
          <ListRow
            leading={<Escudo clube={clubeDaTerra} size={40} />}
            title={clubeDaTerra.nomeCurto}
            subtitle={`${formatarNumero(clubeDaTerra.adeptosNaApp)} adeptos na app`}
            trailing={chevron}
          />
        </Card>
      ) : (
        <Card>
          <ListRow
            leading={<IconCircle name={icons.casa} />}
            title="Ainda sem clube da terra"
            subtitle="Diz-nos de onde és. Nós sugerimos, tu confirmas."
          />
          <Button
            label="Escolher clube da terra"
            variant="secondary"
            icon={icons.localizacao}
            onPress={() => router.push('/perfil/clube-terra')}
          />
        </Card>
      )}

      <SectionHeader title="Passaporte de estádios" />
      <PassaporteCard estadiosVisitados={estadiosVisitados} avaliacoes={avaliacoes} />

      <SectionHeader title="Missões do passaporte" />
      <MissoesCard />

      <SectionHeader
        title="Álbum de recordações"
        trailing={fotosMissoes.length > 0 ? plural(fotosMissoes.length, 'foto', 'fotos') : undefined}
      />
      <AlbumResumo fotos={fotosMissoes} onAbrir={() => router.push('/perfil/album')} />

      <SectionHeader
        title="Avaliações de estádios"
        trailing={avaliacoes.length > 0 ? plural(avaliacoes.length, 'visita', 'visitas') : undefined}
      />
      <HistoricoAvaliacoes
        avaliacoes={avaliacoes}
        onEditar={(jogoId) => router.push({ pathname: '/perfil/avaliar', params: { jogoId } })}
      />

      <SectionHeader title="Tascos visitados" trailing={`${tascosVerificados} pontos`} />
      <HistoricoTascos
        visitas={visitasLocais}
        onAbrirLocal={(localId) =>
          router.push({ pathname: '/locais/[localId]', params: { localId } })
        }
      />

      <SectionHeader title="Ranking de tascos verificados" />
      <RankingCard ranking={ranking} />

      <SectionHeader title="Definições" />
      <Card>
        <ListRow
          leading={<IconCircle name={icons.som} />}
          title="Sons"
          subtitle="Um som curto no check-in e quando ganhas um carimbo."
          trailing={
            <Switch
              value={sonsLigados}
              onValueChange={alternarSons}
              trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
              accessibilityLabel="Sons"
            />
          }
        />
      </Card>
      <Card
        onPress={() => router.push('/perfil/notificacoes')}
        accessibilityLabel={`Notificações: ${notificacoesLigadas} de ${TIPOS_NOTIFICACAO.length} ligadas. Toca para escolher.`}>
        <ListRow
          leading={<IconCircle name={icons.notificacoes} />}
          title="Notificações"
          subtitle={`${notificacoesLigadas} de ${TIPOS_NOTIFICACAO.length} ligadas`}
          trailing={chevron}
        />
      </Card>
      <Card>
        <ListRow
          leading={<IconCircle name={icons.localizacao} />}
          title="Localização"
          subtitle={textoPermissao(permissoes.localizacao)}
        />
      </Card>
      <Card onPress={reverIntroducao} accessibilityLabel="Rever a introdução">
        <ListRow
          leading={<IconCircle name={icons.introducao} />}
          title="Rever a introdução"
          subtitle="Os três ecrãs do início, outra vez."
          trailing={chevron}
        />
      </Card>

      {modoDemoVisivel || simulacao ? (
        <>
          <SectionHeader title="Modo demo" />
          <ModoDemoCard />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  perfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontSize: 18,
    lineHeight: 24,
  },
  etiqueta: {
    flexDirection: 'row',
  },
});
