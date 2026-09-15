import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AjudarTasco } from '@/components/ajudar-tasco';
import { DestaquesMenu } from '@/components/destaques-menu';
import { MenuTasco } from '@/components/menu-tasco';
import { TascoPorConfirmar } from '@/components/tasco-por-confirmar';
import { WcMaisProximo } from '@/components/wc-mais-proximo';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { formatarDistancia, plural } from '@/lib/formatos';
import { proximoJogoNoEstadio } from '@/lib/jogos';
import { lembretePelaMeteorologia } from '@/lib/pratos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { jogos } from '@/mocks/jogos';
import { nomesTipoLocal, obterLocal } from '@/mocks/locais';
import type { Clube } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useSons } from '@/state/sons';
import { BotaoAlternar } from '@/ui/botao-alternar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ContadorPessoas } from '@/ui/contador-pessoas';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons, type IconName } from '@/ui/icon';
import { Medidor } from '@/ui/medidor';
import { SectionHeader } from '@/ui/section-header';
import { SeletorNota } from '@/ui/seletor-nota';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/** Yellow header with a back button; the tasco's details go in `children`. */
function CabecalhoTasco({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.cabecalho,
        {
          backgroundColor: theme.highlight,
          paddingTop: insets.top + Spacing.two,
        },
      ]}>
      <View style={styles.decoracao} pointerEvents="none">
        <Icon name={icons.tasco} size={190} color={theme.text} strokeWidth={1.4} />
      </View>
      {router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.voltar, pressed && styles.pressed]}>
          <Icon name={icons.voltar} size={20} color={theme.text} />
        </Pressable>
      ) : (
        <View style={styles.semVoltar} />
      )}
      {children}
    </View>
  );
}

function Pagina({ children, cabecalho }: { children: ReactNode; cabecalho: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }}>
      {cabecalho}
      <View style={styles.conteudo}>{children}</View>
    </ScrollView>
  );
}

function LinhaDetalhe({
  icon,
  label,
  valor,
  ultima = false,
}: {
  icon: IconName;
  label: string;
  valor: string;
  ultima?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${valor}`}
      style={[
        styles.linhaDetalhe,
        !ultima && {
          borderBottomWidth: 1,
          borderBottomColor: theme.backgroundSelected,
        },
      ]}>
      <Icon name={icon} size={20} color={theme.accentInk} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.detalheLabel}>
        {label}
      </ThemedText>
      <ThemedText style={styles.detalheValor}>{valor}</ThemedText>
    </View>
  );
}

export default function LocalScreen() {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const { loading } = useSimulatedLoading(`local-${localId}`);
  const {
    fezCheckIn,
    alternarCheckIn,
    pessoasAqui,
    visitaDoLocal,
    registarVisitaManual,
    pratosRecomendados,
    recomendacoesJaContadas,
    alternarRecomendacao,
    notasCervejaPetisco,
    darNotaCervejaPetisco,
    notasTascos,
    darNotaTasco,
    modoDemo,
  } = useAppState();
  const { tocarCheckIn } = useSons();

  const local = obterLocal(localId);
  const estadio = local ? obterEstadio(local.estadioId) : undefined;

  if (loading) {
    return (
      <Pagina cabecalho={<CabecalhoTasco />}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Pagina>
    );
  }

  if (!local || !estadio) {
    return (
      <Pagina cabecalho={<CabecalhoTasco />}>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Tasco não encontrado"
          message="Este tasco fechou as portas ou nunca existiu."
          action={{ label: 'Voltar aos locais', onPress: () => router.back() }}
        />
      </Pagina>
    );
  }

  const checkedIn = fezCheckIn(local.id);
  const visita = visitaDoLocal(local.id);
  const distancia = `${formatarDistancia(local.distanciaMetros)} · ${local.minutosAPe} min a pé`;
  const proximoJogo = proximoJogoNoEstadio(jogos, local.estadioId, agora);
  const lembrete = lembretePelaMeteorologia(proximoJogo?.meteorologia, local.pratos);
  const clubesPresentes = local.clubesAqui
    .map((clubeId) => obterClube(clubeId))
    .filter((clube): clube is Clube => Boolean(clube));
  const clubesAqui = clubesPresentes.map((clube) => clube.nomeCurto);
  const pessoas = pessoasAqui(local);

  function alternar() {
    if (!local) return;
    // O som só toca ao fazer check-in, nunca ao anular.
    if (!checkedIn) tocarCheckIn();
    alternarCheckIn(local.id);
  }

  const cabecalho = (
    <CabecalhoTasco>
      <View style={styles.etiquetas}>
        <View style={[styles.etiquetaBranca, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.etiquetaTexto}>{nomesTipoLocal[local.tipo]}</ThemedText>
        </View>
        {local.precoMedio ? (
          <View style={[styles.etiquetaBranca, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.etiquetaTexto}>{'€'.repeat(local.precoMedio)}</ThemedText>
          </View>
        ) : null}
        {local.rapidoEBarato ? (
          <Etiqueta icon={icons.preco} label="Rápido e barato" tone="destaque" />
        ) : null}
        {local.confirmacao === 'sugerido' ? (
          <Etiqueta icon={icons.porVerificar} label="Por confirmar" tone="aviso" />
        ) : null}
        {checkedIn ? (
          <Etiqueta icon={icons.selecionado} label="Estás aqui" tone="positivo" />
        ) : null}
      </View>

      <View style={styles.titulos}>
        <ThemedText type="title" style={styles.nome} accessibilityRole="header">
          {local.nome}
        </ThemedText>
        <ThemedText style={styles.perto}>{`Perto do ${estadio.nome} · ${distancia}`}</ThemedText>
      </View>

      {pessoas === null ? null : (
        <View style={[styles.pessoas, { backgroundColor: theme.backgroundElement }]}>
          <ContadorPessoas
            count={pessoas}
            variant="hero"
            detail={
              clubesAqui.length > 0
                ? `Hoje por cá: adeptos do ${clubesAqui.join(' e do ')}`
                : undefined
            }
            detailLeading={
              clubesPresentes.length > 0 ? (
                <View style={styles.escudos}>
                  {clubesPresentes.map((clube) => (
                    <Escudo key={clube.id} clube={clube} size={15} />
                  ))}
                </View>
              ) : undefined
            }
          />
        </View>
      )}
    </CabecalhoTasco>
  );

  return (
    <Pagina cabecalho={cabecalho}>
      <Stack.Screen options={{ title: local.nome }} />

      {local.confirmacao === 'sugerido' ? <TascoPorConfirmar local={local} /> : null}

      <View style={styles.checkIn}>
        <BotaoAlternar
          ativo={checkedIn}
          onPress={alternar}
          label={{ ativo: 'Check-in feito', inativo: 'Fazer check-in' }}
          icon={{ ativo: icons.checkInFeito, inativo: icons.checkIn }}
        />
        <ThemedText themeColor="textSecondary" style={styles.centro}>
          {checkedIn
            ? local.pessoasAqui === null
              ? 'Check-in feito. Toca outra vez para anular.'
              : `Já contas para a claque: tu e mais ${plural(local.pessoasAqui, 'adepto', 'adeptos')}. Toca outra vez para anular.`
            : 'Diz à malta que já cá estás.'}
        </ThemedText>

        {visita ? (
          <View style={styles.visita}>
            <Etiqueta
              icon={visita.verificado ? icons.selecionado : icons.porVerificar}
              label={visita.verificado ? 'Visita verificada' : 'Visita por verificar'}
              tone={visita.verificado ? 'positivo' : 'aviso'}
            />
            {visita.verificado ? null : (
              <ThemedText themeColor="textSecondary" style={styles.centro}>
                Só conta para a pontuação depois de fazeres check-in no local.
              </ThemedText>
            )}
          </View>
        ) : (
          <Button
            label="Já estive aqui"
            variant="secondary"
            icon={icons.tasco}
            onPress={() => registarVisitaManual(local.id)}
          />
        )}
      </View>

      <SectionHeader
        title="O que pedir"
        trailing={
          proximoJogo
            ? `Jogo ${formatarDiaEHora(new Date(proximoJogo.inicio)).toLowerCase()}`
            : undefined
        }
      />
      <DestaquesMenu
        pratos={local.pratos}
        recomendados={pratosRecomendados}
        jaContados={recomendacoesJaContadas}
        lembrete={lembrete}
      />

      {/* Restroom data is illustrative: only in demo mode until there are real restrooms. */}
      {modoDemo ? (
        <>
          <SectionHeader title="WC mais próximo" />
          <WcMaisProximo origem={local.coordenadas} />
        </>
      ) : null}

      <SectionHeader title="A tua nota" />
      <Card>
        <SeletorNota
          label="Dá nota a este tasco"
          description="Conta para a missão Crítico de tasco."
          value={notasTascos[local.id] ?? null}
          onChange={(nota) => darNotaTasco(local.id, nota)}
        />
        {notasTascos[local.id] ? (
          <>
            <SeletorNota
              label="Cervejómetro"
              description="Como está a cerveja?"
              value={notasCervejaPetisco[local.id]?.cerveja ?? null}
              onChange={(nota) => darNotaCervejaPetisco(local.id, { cerveja: nota })}
            />
            <SeletorNota
              label="Petiscómetro"
              description="E os petiscos?"
              value={notasCervejaPetisco[local.id]?.petisco ?? null}
              onChange={(nota) => darNotaCervejaPetisco(local.id, { petisco: nota })}
            />
          </>
        ) : null}
      </Card>

      <SectionHeader title="Avaliação dos adeptos" />
      <Card style={styles.medidores}>
        <Medidor
          label="Cervejómetro"
          icon={icons.tasco}
          tone="amarelo"
          value={local.cervejometro}
        />
        <View style={[styles.divisor, { backgroundColor: theme.backgroundSelected }]} />
        <Medidor
          label="Petiscómetro"
          icon={icons.especialidade}
          tone="verde"
          value={local.petiscometro}
        />
      </Card>

      {local.pratos.length > 0 ? (
        <>
          <SectionHeader title="Menu" trailing={plural(local.pratos.length, 'prato', 'pratos')} />
          <MenuTasco
            pratos={local.pratos}
            recomendados={pratosRecomendados}
            jaContados={recomendacoesJaContadas}
            onAlternarRecomendacao={alternarRecomendacao}
          />
        </>
      ) : null}

      <SectionHeader title="Ajuda a completar" />
      <AjudarTasco local={local} />

      <SectionHeader title="Detalhes" />
      <Card style={styles.listaCard}>
        {local.especialidade ? (
          <LinhaDetalhe
            icon={icons.especialidade}
            label="Especialidade"
            valor={local.especialidade}
          />
        ) : null}
        {local.horario ? (
          <LinhaDetalhe icon={icons.horario} label="Horário" valor={local.horario} />
        ) : null}
        <LinhaDetalhe icon={icons.aPe} label="Distância a pé" valor={distancia} ultima />
      </Card>

      {local.notas.length > 0 ? (
        <>
          <SectionHeader title="Notas" />
          <Card style={styles.notas}>
            {local.notas.map((nota) => (
              <View key={nota} style={styles.nota}>
                <View style={[styles.marcador, { backgroundColor: theme.accent }]} />
                <ThemedText type="small" style={styles.flex}>
                  {nota}
                </ThemedText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    overflow: 'hidden',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: Spacing.four,
    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  decoracao: {
    position: 'absolute',
    right: -36,
    top: 40,
    opacity: 0.13,
  },
  voltar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(19, 36, 27, 0.1)',
  },
  semVoltar: {
    height: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: 20,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  etiquetaBranca: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  etiquetaTexto: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  titulos: {
    gap: 6,
  },
  nome: {
    fontSize: 46,
    lineHeight: 50,
  },
  perto: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 600,
    opacity: 0.75,
  },
  pessoas: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  escudos: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  checkIn: {
    gap: Spacing.two,
  },
  centro: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  visita: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  medidores: {
    gap: 0,
    paddingVertical: 6,
  },
  divisor: {
    height: 1,
  },
  listaCard: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  linhaDetalhe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  detalheLabel: {
    flexShrink: 0,
  },
  detalheValor: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
    textAlign: 'right',
  },
  notas: {
    gap: Spacing.two,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  marcador: {
    width: 6,
    height: 6,
    marginTop: 7,
    borderRadius: 3,
  },
  flex: {
    flex: 1,
  },
});
