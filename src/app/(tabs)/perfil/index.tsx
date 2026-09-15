import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { AlbumResumo } from '@/components/album-resumo';
import { HistoricoTascos } from '@/components/historico-tascos';
import { MissoesCard } from '@/components/missoes-card';
import { PassaporteCard } from '@/components/passaporte-card';
import { RankingCard } from '@/components/ranking-card';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { AccountCard } from '@/features/auth/components/AccountCard';
import { useMyNudges } from '@/features/nudges/hooks/useMyNudges';
import { useVerifiedPlacesRanking } from '@/features/presence/hooks/usePresence';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { useLatestRecap } from '@/features/recap/hooks/useLatestRecap';
import { seasonLabel } from '@/features/recap/stats';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import { formatarNumero, plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { contarTascosVerificados, ID_UTILIZADOR, montarRanking } from '@/lib/tascos';
import { nomesDivisao, obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { rankingMock } from '@/mocks/ranking';
import type { Clube } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons, type IconName } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { ListRow } from '@/ui/list-row';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** Toques seguidos no cartão do perfil para revelar o modo demo. */
const TOQUES_MODO_DEMO = 5;
const JANELA_TOQUES_MS = 3000;

/** Mowing stripes on the header: 36 px wide, every 72 px. */
const RISCAS_RELVADO = Array.from({ length: 16 }, (_, indice) => indice * 72 + 36);
/** Scarf stripes on the club cards, enough for the tallest card. */
const RISCAS_CACHECOL = Array.from({ length: 14 }, (_, indice) => indice * 16 - 24);

/** "Adepto AwayDay" -> "AA". */
function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palavra) => palavra.charAt(0))
    .join('')
    .toUpperCase();
}

export default function PerfilScreen() {
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { simulacao } = useRelogio();
  const {
    clubeFavoritoId,
    clubeDaTerraId,
    estadiosVisitados,
    avaliacoes,
    visitasLocais,
    fotosMissoes,
    fonte,
  } = useAppState();
  const { historico } = useJogosAQueFoste();
  const ultimoJogo = historico[0];
  const [toques, setToques] = useState<readonly number[]>([]);
  const userId = useUserId();
  const perfilDaConta = useMyProfile(userId);
  const novidades = useMyNudges(userId);
  const porLer = novidades.data?.filter((nudge) => nudge.readAt === null).length ?? 0;
  const retrospetiva = useLatestRecap(userId);
  const rankingDaConta = useVerifiedPlacesRanking(fonte === 'conta' ? userId : null);

  const clube = obterClube(clubeFavoritoId);
  const estadioDoClube = clube?.estadioId ? obterEstadio(clube.estadioId) : undefined;
  const clubeDaTerra = clubeDaTerraId ? obterClube(clubeDaTerraId) : undefined;
  const tascosVerificados = contarTascosVerificados(visitasLocais);
  const eu = { id: ID_UTILIZADOR, nome: 'Tu', clubeId: clubeFavoritoId, tascosVerificados };
  // Demo: sample fans. With an account: the server's ranking (others only if they opted in). Without: just you.
  const ranking =
    fonte === 'demo'
      ? montarRanking(rankingMock, eu)
      : fonte === 'conta' && rankingDaConta.data
        ? rankingDaConta.data.map((linha) => ({
            id: linha.isMe ? ID_UTILIZADOR : `adepto-${linha.position}`,
            nome: linha.isMe ? 'Tu' : linha.displayName,
            clubeId: (linha.isMe ? clubeFavoritoId : linha.clubId) ?? '',
            tascosVerificados: linha.value,
            posicao: linha.position,
          }))
        : montarRanking([], eu);
  const nome = perfilDaConta.data?.displayName ?? 'Adepto AwayDay';
  const chevron = <Icon name={icons.seguinte} size={18} color={theme.textMuted} />;
  const mostrarNovidades = Boolean(userId);
  const mostrarRetrospetiva = Boolean(retrospetiva.data);

  function tocarNoPerfil() {
    const agora = Date.now();
    const recentes = [...toques.filter((toque) => agora - toque < JANELA_TOQUES_MS), agora];
    if (recentes.length >= TOQUES_MODO_DEMO) {
      setToques([]);
      router.push({ pathname: '/perfil/definicoes', params: { demo: '1' } });
    } else {
      setToques(recentes);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scroll}>
      <Pressable
        onPress={tocarNoPerfil}
        accessibilityRole="button"
        accessibilityLabel="O teu perfil"
        style={[styles.relvado, { paddingTop: insets.top + Spacing.five }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {RISCAS_RELVADO.map((left) => (
            <View key={left} style={[styles.riscaRelvado, { left }]} />
          ))}
        </View>
        <Svg
          width={220}
          height={220}
          viewBox="0 0 220 220"
          fill="none"
          stroke={Colors.accentText}
          strokeWidth={3}
          style={styles.grandeArea}
          pointerEvents="none">
          <Path d="M0 60H160V220" />
          <Path d="M60 60a60 60 0 0 0 100 60" />
        </Svg>

        <View style={styles.identidade}>
          <AvatarCachecol iniciais={iniciais(nome)} />
          <View style={styles.flex}>
            <ThemedText type="title" style={styles.nome} numberOfLines={2}>
              {nome}
            </ThemedText>
            <View style={styles.verificados}>
              <Icon name={icons.checkInFeito} size={16} color={theme.highlight} strokeWidth={2.6} />
              <ThemedText style={styles.verificadosTexto}>
                {plural(tascosVerificados, 'tasco verificado', 'tascos verificados')}
              </ThemedText>
            </View>
          </View>
        </View>
        {simulacao ? (
          <View style={styles.etiqueta}>
            <Etiqueta icon={icons.demo} label="Hora simulada ativa" tone="destaque" />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.conteudo}>
        {supabase ? (
          <>
            <SectionHeader title="Conta" />
            <AccountCard displayName={perfilDaConta.data?.displayName ?? null} />
            {mostrarNovidades || mostrarRetrospetiva ? (
              <Card style={styles.grupo}>
                {userId ? (
                  <LinhaGrupo
                    onPress={() => router.push('/perfil/novidades')}
                    accessibilityLabel={`Novidades${porLer > 0 ? `: ${plural(porLer, 'dica por ler', 'dicas por ler')}` : ''}. Toca para abrir.`}
                    separador={mostrarRetrospetiva}
                    leading={
                      <Azulejo icon={icons.notificacoes} fundo={theme.warningBackground} tinta={theme.warning} />
                    }
                    title="Novidades"
                    subtitle={
                      porLer > 0
                        ? plural(porLer, 'dica por ler', 'dicas por ler')
                        : 'Dicas para os teus dias de jogo'
                    }
                    trailing={
                      <View style={styles.trailing}>
                        {porLer > 0 ? <Badge label={String(porLer)} tone="highlight" /> : null}
                        {chevron}
                      </View>
                    }
                  />
                ) : null}
                {retrospetiva.data ? (
                  <LinhaGrupo
                    onPress={() => router.push('/perfil/retrospetiva')}
                    accessibilityLabel={`Retrospetiva da época ${seasonLabel(retrospetiva.data.seasonId)}. Toca para abrir.`}
                    leading={
                      <Azulejo icon={icons.ranking} fundo={theme.successBackground} tinta={theme.accentInk} />
                    }
                    title={`A tua época ${seasonLabel(retrospetiva.data.seasonId)}`}
                    subtitle={retrospetiva.data.headline}
                    trailing={chevron}
                  />
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

        <SectionHeader title="Clube que apoio" />
        {clube ? (
          <CartaoClube
            clube={clube}
            onPress={() => router.push('/perfil/clube')}
            accessibilityLabel={`Clube que apoio: ${clube.nomeCurto}, ${formatarNumero(clube.adeptosNaApp)} adeptos na app. Toca para mudar.`}
            subtitle={[
              clube.divisao ? nomesDivisao[clube.divisao] : null,
              estadioDoClube?.nome ?? null,
              `${formatarNumero(clube.adeptosNaApp)} adeptos na app`,
            ]
              .filter(Boolean)
              .join(' · ')}
            chevron={chevron}
          />
        ) : null}

        <SectionHeader title="Clube da terra" />
        {clubeDaTerra ? (
          <CartaoClube
            clube={clubeDaTerra}
            onPress={() => router.push('/perfil/clube-terra')}
            accessibilityLabel={`Clube da terra: ${clubeDaTerra.nomeCurto}. Toca para mudar.`}
            subtitle={`${formatarNumero(clubeDaTerra.adeptosNaApp)} adeptos na app`}
            chevron={chevron}
          />
        ) : (
          <Card style={styles.semClube}>
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
        <PassaporteCard estadiosVisitados={estadiosVisitados} avaliacoes={avaliacoes} limite={3} />
        <Button
          label="Ver o passaporte"
          variant="secondary"
          icon={icons.estadio}
          onPress={() => router.push('/perfil/passaporte')}
        />

        <SectionHeader title="Missões do passaporte" />
        <MissoesCard />

        <SectionHeader
          title="Álbum de recordações"
          trailing={fotosMissoes.length > 0 ? plural(fotosMissoes.length, 'foto', 'fotos') : undefined}
        />
        <AlbumResumo fotos={fotosMissoes} onAbrir={() => router.push('/perfil/album')} />

        <SectionHeader
          title="Os teus jogos"
          trailing={historico.length > 0 ? plural(historico.length, 'jogo', 'jogos') : undefined}
        />
        <Card style={styles.grupo}>
          <LinhaGrupo
            onPress={() => router.push('/perfil/os-meus-jogos')}
            accessibilityLabel={`Os teus jogos: ${plural(historico.length, 'jogo', 'jogos')}. Toca para abrir.`}
            leading={<Azulejo icon={icons.acesso} fundo={theme.successBackground} tinta={theme.accentInk} />}
            title={
              ultimoJogo
                ? `${obterClube(ultimoJogo.casaId)?.nomeCurto ?? ''} x ${obterClube(ultimoJogo.foraId)?.nomeCurto ?? ''}`
                : 'Ainda sem jogos'
            }
            subtitle={
              ultimoJogo
                ? `Último jogo · ${formatarData(new Date(ultimoJogo.inicio))}`
                : 'Os jogos a que fores ficam aqui depois do apito.'
            }
            trailing={chevron}
          />
        </Card>

        <SectionHeader title="Tascos visitados" trailing={`${tascosVerificados} pontos`} />
        <HistoricoTascos
          visitas={visitasLocais}
          onAbrirLocal={(localId) =>
            router.push({ pathname: '/locais/[localId]', params: { localId } })
          }
        />

        <SectionHeader title="Ranking de tascos verificados" />
        <RankingCard ranking={ranking} />
        {fonte === 'demo' ? null : (
          <ThemedText type="small" themeColor="textMuted">
            {fonte === 'conta'
              ? 'Só aparecem adeptos que aceitaram mostrar o nome. Escolhe nas Definições.'
              : 'Cria conta para entrares no ranking com os outros adeptos.'}
          </ThemedText>
        )}

        <SectionHeader title="Definições" />
        <Card style={styles.grupo}>
          <LinhaGrupo
            onPress={() => router.push('/perfil/definicoes')}
            accessibilityLabel="Definições: sons, notificações, localização e introdução. Toca para abrir."
            leading={<Icon name={icons.definicoes} size={20} color={theme.accentInk} />}
            title="Definições"
            subtitle="Sons, notificações, localização e introdução"
            trailing={chevron}
          />
        </Card>
      </View>
    </ScrollView>
  );
}

/** Initials on a yellow-and-white striped ring. */
function AvatarCachecol({ iniciais: letras }: { iniciais: string }) {
  return (
    <View style={styles.avatar}>
      <Svg width={80} height={80} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="riscas-avatar"
            patternUnits="userSpaceOnUse"
            width={14}
            height={14}
            patternTransform="rotate(45)">
            <Rect x={0} y={0} width={7} height={14} fill={Colors.highlight} />
            <Rect x={7} y={0} width={7} height={14} fill={Colors.accentText} />
          </Pattern>
        </Defs>
        <Circle cx={40} cy={40} r={40} fill="url(#riscas-avatar)" />
      </Svg>
      <View style={styles.avatarInterior}>
        <ThemedText type="title" allowFontScaling={false} themeColor="accent" style={styles.avatarTexto}>
          {letras}
        </ThemedText>
      </View>
    </View>
  );
}

function Azulejo({ icon, fundo, tinta }: { icon: IconName; fundo: ColorValue; tinta: ColorValue }) {
  return (
    <View style={[styles.azulejo, { backgroundColor: fundo }]}>
      <Icon name={icon} size={20} color={tinta} />
    </View>
  );
}

type CartaoClubeProps = {
  clube: Clube;
  subtitle: string;
  onPress: () => void;
  accessibilityLabel: string;
  chevron: ReactNode;
};

/** Club card with a scarf edge in the club's colours. */
function CartaoClube({ clube, subtitle, onPress, accessibilityLabel, chevron }: CartaoClubeProps) {
  return (
    <Card style={styles.clube} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.cachecol, { backgroundColor: clube.cores.secundaria }]}>
        {RISCAS_CACHECOL.map((top) => (
          <View key={top} style={[styles.riscaCachecol, { top, backgroundColor: clube.cores.primaria }]} />
        ))}
      </View>
      <View style={styles.clubeCorpo}>
        <Escudo clube={clube} size={44} />
        <View style={styles.clubeTexto}>
          <ThemedText type="section" style={styles.clubeNome} numberOfLines={1}>
            {clube.nomeCurto}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.linhaSubtitulo}>
            {subtitle}
          </ThemedText>
        </View>
        {chevron}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.six,
  },
  relvado: {
    overflow: 'hidden',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: Colors.accent,
    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  riscaRelvado: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  grandeArea: {
    position: 'absolute',
    right: -30,
    bottom: -80,
    opacity: 0.18,
  },
  identidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInterior: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentText,
  },
  avatarTexto: {
    fontSize: 30,
    lineHeight: 34,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  nome: {
    fontSize: 38,
    lineHeight: 40,
    color: Colors.accentText,
  },
  verificados: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificadosTexto: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  etiqueta: {
    flexDirection: 'row',
  },
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  grupo: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  azulejo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaSubtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
  semClube: {
    gap: Spacing.three,
  },
  clube: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  cachecol: {
    width: 18,
    overflow: 'hidden',
  },
  riscaCachecol: {
    position: 'absolute',
    left: -11,
    width: 40,
    height: 8,
    transform: [{ rotate: '-45deg' }],
  },
  clubeCorpo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: Spacing.three,
  },
  clubeTexto: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  clubeNome: {
    fontSize: 24,
    lineHeight: 27,
  },
});
