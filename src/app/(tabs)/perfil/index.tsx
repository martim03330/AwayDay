import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { AccountCard } from '@/features/auth/components/AccountCard';
import { useMySupportersClubs } from '@/features/casas/hooks/useCasas';
import { useClubSupporterCounts, useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { useLatestRecap } from '@/features/recap/hooks/useLatestRecap';
import { seasonLabel } from '@/features/recap/stats';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { textoAdeptosNaApp } from '@/lib/clubes';
import { useMyFriendRequests } from '@/features/friends/hooks/useFriends';
import { useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { contarTascosVerificados } from '@/lib/tascos';
import { MOSTRAR_CLUBE_DA_TERRA, obterClube } from '@/mocks/clubes';
import { estadiosNacionais } from '@/mocks/estadios';
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
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

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
    .filter((palavra) => /^\p{L}/u.test(palavra))
    .slice(0, 2)
    .map((palavra) => palavra.charAt(0))
    .join('')
    .toUpperCase();
}

export default function PerfilScreen() {
  const { ref: paginaRef, onScroll, scrollEventThrottle, botao: voltarAoTopo } = useVoltarAoTopo({
    reporNoTopo: true,
    inicioAoVoltar: true,
  });
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { simulacao } = useRelogio();
  const {
    clubeFavoritoId,
    clubeDaTerraId,
    estadiosVisitados,
    visitasLocais,
    fotosMissoes,
  } = useAppState();
  const { historico } = useJogosAQueFoste();
  const [toques, setToques] = useState<readonly number[]>([]);
  const userId = useUserId();
  const pedidosDeAmizade = (useMyFriendRequests(userId !== null).data ?? []).filter(
    (pedido) => pedido.direction === 'recebido'
  ).length;
  const perfilDaConta = useMyProfile(userId);
  const adeptos = useClubSupporterCounts();
  const retrospetiva = useLatestRecap(userId);
  // The Casa this person runs (for a board member), else the way to register one.
  const minhasCasas = useMySupportersClubs();
  const casaQueGiro = userId ? (minhasCasas.data ?? []).find((casa) => casa.myRole !== null) : undefined;

  const clube = obterClube(clubeFavoritoId);
  const clubeDaTerra = clubeDaTerraId ? obterClube(clubeDaTerraId) : undefined;
  const tascosVerificados = contarTascosVerificados(visitasLocais);
  const nome = perfilDaConta.data?.displayName ?? 'Adepto AwayDay';
  const chevron = <Icon name={icons.seguinte} size={18} color={theme.textMuted} />;

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
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={paginaRef}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}>
        {/* Paints the iOS overscroll area above the header green instead of white, like the other tabs. */}
        <View style={[styles.relvadoAcima, { backgroundColor: theme.accent }]} pointerEvents="none" />
        <Pressable
          onPress={tocarNoPerfil}
          accessibilityRole="button"
          accessibilityLabel="O teu perfil"
          testID="cabecalho-perfil"
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
            <AvatarCachecol iniciais={iniciais(nome)} foto={perfilDaConta.data?.avatarUrl} />
            <View style={styles.flex}>
              <ThemedText type="title" style={styles.nome} numberOfLines={2}>
                {nome}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/perfil/clube')}
                accessibilityRole="button"
                accessibilityLabel={
                  clube ? `Clube que apoio: ${clube.nomeCurto}. Toca para mudar.` : 'Escolher o clube que apoio'
                }
                hitSlop={6}
                style={({ pressed }) => [styles.clubePilula, pressed && styles.premido]}>
                {clube ? <Escudo clube={clube} size={22} /> : null}
                <ThemedText style={styles.clubePilulaTexto} numberOfLines={1}>
                  {clube ? clube.nomeCurto : 'Escolhe o teu clube'}
                </ThemedText>
                <Icon name={icons.seguinte} size={14} color="rgba(255, 255, 255, 0.88)" strokeWidth={2.6} />
              </Pressable>
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
          {/* Like a settings menu (testers' reference: Betclic): one line per thing, title only. What is inside opens
              on its own page. */}
          <SectionHeader title="A tua bola" />
          <Card style={styles.grupo}>
            <Opcao
              icon={icons.estadio}
              titulo="Passaporte de estádios"
              valor={`${estadiosNacionais.filter((estadio) => estadiosVisitados.includes(estadio.id)).length}/${estadiosNacionais.length}`}
              onPress={() => router.push('/perfil/passaporte')}
              separador
            />
            <Opcao
              icon={icons.tasco}
              titulo="Tascos visitados"
              valor={visitasLocais.length > 0 ? String(tascosVerificados) : undefined}
              onPress={() => router.push('/perfil/tascos')}
              separador
            />
            <Opcao
              icon={icons.album}
              titulo="Álbum de recordações"
              valor={fotosMissoes.length > 0 ? String(fotosMissoes.length) : undefined}
              onPress={() => router.push('/perfil/album')}
              separador
            />
            <Opcao
              icon={icons.acesso}
              titulo="Os teus jogos"
              valor={historico.length > 0 ? String(historico.length) : undefined}
              onPress={() => router.push('/perfil/os-meus-jogos')}
              separador={retrospetiva.data !== undefined && retrospetiva.data !== null}
            />
            {retrospetiva.data ? (
              <Opcao
                icon={icons.ranking}
                titulo={`A tua época ${seasonLabel(retrospetiva.data.seasonId)}`}
                onPress={() => router.push('/perfil/retrospetiva')}
              />
            ) : null}
          </Card>

          {MOSTRAR_CLUBE_DA_TERRA ? (
            <>
              <SectionHeader title="Clube da terra" />
              {clubeDaTerra ? (
                <CartaoClube
                  clube={clubeDaTerra}
                  onPress={() => router.push('/perfil/clube-terra')}
                  accessibilityLabel={`Clube da terra: ${clubeDaTerra.nomeCurto}.${
                    textoAdeptosNaApp(adeptos.data?.[clubeDaTerra.id])
                      ? ` ${textoAdeptosNaApp(adeptos.data?.[clubeDaTerra.id])}.`
                      : ''
                  } Toca para mudar.`}
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
            </>
          ) : null}

          <SectionHeader title="Gerir conta" />
          <Card style={styles.grupo}>
            {userId ? (
              <>
                <Opcao
                  icon={icons.camara}
                  titulo="Editar nome e foto"
                  onPress={() => router.push('/perfil/editar')}
                  separador
                />
                <Opcao
                  icon={icons.perfil}
                  titulo="Os teus amigos"
                  destaque={pedidosDeAmizade > 0 ? String(pedidosDeAmizade) : undefined}
                  onPress={() => router.push('/perfil/amigos')}
                  separador
                />
                {casaQueGiro ? (
                  <Opcao
                    icon={icons.casa}
                    titulo="A tua Casa"
                    onPress={() =>
                      router.push({ pathname: '/casa/[casaId]', params: { casaId: casaQueGiro.id } })
                    }
                    separador
                  />
                ) : (
                  <Opcao
                    icon={icons.casa}
                    titulo="Registar a minha Casa"
                    onPress={() => router.push('/casa/registar')}
                    separador
                  />
                )}
              </>
            ) : null}
            <Opcao
              icon={icons.definicoes}
              titulo="Definições"
              onPress={() => router.push('/perfil/definicoes')}
            />
          </Card>

          {supabase ? (
            <>
              <SectionHeader title="Conta" />
              <AccountCard displayName={perfilDaConta.data?.displayName ?? null} />
            </>
          ) : null}
        </View>
      </ScrollView>
      {voltarAoTopo}
    </View>
  );
}

/** One line of the profile menu: an icon, the title, sometimes a number, and the arrow. Everything else is inside. */
function Opcao({
  icon,
  titulo,
  valor,
  destaque,
  onPress,
  separador = false,
}: {
  icon: IconName;
  titulo: string;
  /** A quiet number on the right (e.g. «3/57»). */
  valor?: string;
  /** A number that needs an answer (e.g. friend requests), in yellow. */
  destaque?: string;
  onPress: () => void;
  separador?: boolean;
}) {
  const theme = useTheme();
  return (
    <LinhaGrupo
      onPress={onPress}
      accessibilityLabel={[titulo, valor, destaque ? `${destaque} por responder` : null]
        .filter(Boolean)
        .join(', ')}
      leading={<Icon name={icon} size={22} color={theme.accentInk} />}
      title={titulo}
      trailing={
        <View style={styles.trailing}>
          {valor ? (
            <ThemedText type="small" themeColor="textSecondary">
              {valor}
            </ThemedText>
          ) : null}
          {destaque ? <Badge label={destaque} tone="highlight" /> : null}
          <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
        </View>
      }
      separador={separador}
    />
  );
}

/** A foto da pessoa, ou as iniciais num anel de cachecol. */
function AvatarCachecol({ iniciais: letras, foto }: { iniciais: string; foto?: string | null }) {
  if (foto) {
    return (
      <View style={styles.avatar}>
        <Image
          source={{ uri: foto }}
          style={styles.avatarFoto}
          contentFit="cover"
          transition={120}
          accessibilityIgnoresInvertColors
          accessibilityLabel="A tua foto de perfil"
        />
      </View>
    );
  }

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
        <ThemedText
          type="title"
          allowFontScaling={false}
          themeColor="accent"
          style={styles.avatarTexto}>
          {letras}
        </ThemedText>
      </View>
    </View>
  );
}

type CartaoClubeProps = {
  clube: Clube;
  onPress: () => void;
  accessibilityLabel: string;
  chevron: ReactNode;
};

/** Club card with a scarf edge in the club's colours. */
function CartaoClube({ clube, onPress, accessibilityLabel, chevron }: CartaoClubeProps) {
  return (
    <Card style={styles.clube} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.cachecol, { backgroundColor: clube.cores.secundaria }]}>
        {RISCAS_CACHECOL.map((top) => (
          <View
            key={top}
            style={[styles.riscaCachecol, { top, backgroundColor: clube.cores.primaria }]}
          />
        ))}
      </View>
      <View style={styles.clubeCorpo}>
        <Escudo clube={clube} size={44} />
        <ThemedText type="section" style={[styles.clubeTexto, styles.clubeNome]} numberOfLines={1}>
          {clube.nomeCurto}
        </ThemedText>
        {chevron}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  relvadoAcima: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },
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
  avatarFoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  clubePilula: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  clubePilulaTexto: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
    color: Colors.accentText,
  },
  premido: {
    opacity: 0.7,
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
