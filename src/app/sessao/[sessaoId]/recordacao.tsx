import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { useTripMemory, useTripPhotos } from '@/features/trips/hooks/useTrips';
import { addTripPhoto, removeTripPhoto, type TripPhoto } from '@/features/trips/memories';
import { useTheme } from '@/hooks/use-theme';
import { usePuxarParaAtualizar } from '@/hooks/use-puxar-para-atualizar';
import { parteDeCada } from '@/lib/acerto';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { Skeleton, SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';
import { useFormatarDinheiro } from '@/ui/valor';

const formatoData = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Lisbon',
});

/**
 * A past trip as a memory: the cover, one card with the numbers (who went, what was spent, the biggest splurge, a
 * link to the accounts) and the album. The accounts are still there, but here they are not the point.
 */
export default function RecordacaoScreen() {
  const dinheiro = useFormatarDinheiro();
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { sessaoId } = useLocalSearchParams<{ sessaoId?: string }>();
  const memoria = useTripMemory(sessaoId ?? null);
  const fotos = useTripPhotos(sessaoId ?? null);
  const puxar = usePuxarParaAtualizar(() => queryClient.invalidateQueries({ queryKey: ['trips'] }));
  const [aberta, setAberta] = useState<TripPhoto | null>(null);
  const [aSubir, setASubir] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const viagem = memoria.data ?? null;
  if (!viagem) {
    return (
      <Screen>
        {memoria.isLoading ? (
          <>
            <Skeleton height={220} radius={Radius.card} />
            <SkeletonCard lines={3} />
          </>
        ) : (
          <EmptyState
            icon={icons.album}
            title="Esta viagem não está no teu histórico"
            message="As recordações são de quem foi e dos grupos que lá estiveram."
            action={{ label: 'Voltar', onPress: () => router.back() }}
          />
        )}
      </Screen>
    );
  }

  const jogo = obterJogo(viagem.fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const nome = casa && fora ? `${casa.nomeCurto} x ${fora.nomeCurto}` : 'Jogo';
  const lista = fotos.data ?? [];
  const capa = lista[0]?.url ?? null;
  // Só para mostrar: a divisão por igual, com a regra das contas (os cêntimos que sobram não se inventam).
  const porCabeca =
    viagem.peopleNames.length > 0
      ? parteDeCada(viagem.totalCents, viagem.peopleNames.length).base
      : 0;

  const podeVerContas = viagem.iWent && sessaoId !== undefined;

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['trips'] });

  async function juntarFotos() {
    if (!sessaoId) return;
    const resultado = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.7,
    });
    if (resultado.canceled) return;
    setErro(null);
    setASubir(resultado.assets.length);
    let falhas = 0;
    for (const foto of resultado.assets) {
      try {
        await addTripPhoto(sessaoId, { uri: foto.uri, mimeType: foto.mimeType ?? 'image/jpeg' });
      } catch {
        falhas += 1;
      }
      setASubir((falta) => Math.max(0, falta - 1));
    }
    if (falhas > 0)
      setErro(`Não deu para guardar ${plural(falhas, 'foto', 'fotos')}. Tenta outra vez.`);
    await refrescar();
  }

  const apagar = (foto: TripPhoto) =>
    Alert.alert('Tirar esta foto do álbum?', 'Desaparece para toda a gente.', [
      { text: 'Deixa estar', style: 'cancel' },
      {
        text: 'Tirar',
        style: 'destructive',
        onPress: () => {
          setAberta(null);
          void removeTripPhoto(foto.id)
            .then(refrescar)
            .catch(() => setErro('Não deu para tirar a foto. Tenta outra vez.'));
        },
      },
    ]);

  return (
    <Screen refreshing={puxar.refreshing} onRefresh={puxar.onRefresh}>
      <View style={[styles.capa, { backgroundColor: theme.accent }]}>
        {capa ? (
          <Image
            source={{ uri: capa }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Defs>
            <LinearGradient id="sombraCapa" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.3" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.75} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sombraCapa)" />
        </Svg>
        {casa && fora ? (
          <View style={styles.escudos}>
            <Escudo clube={casa} size={34} />
            <Escudo clube={fora} size={34} />
          </View>
        ) : null}
        <View style={styles.legenda}>
          <ThemedText type="eyebrow" style={styles.branco}>
            {formatoData.format(new Date(viagem.kickoffAt))}
          </ThemedText>
          <ThemedText type="title" style={styles.branco} accessibilityRole="header">
            {nome}
          </ThemedText>
          {estadio ? (
            <ThemedText type="small" style={[styles.branco, styles.suave]}>
              {`${estadio.nome}, ${estadio.cidade}`}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <Card style={styles.grupo}>
        <View style={styles.numeros}>
          <Numero valor={String(viagem.peopleNames.length)} legenda="foram" />
          <View style={[styles.divisoria, { backgroundColor: theme.backgroundSelected }]} />
          <Numero valor={dinheiro.formatar(viagem.totalCents)} legenda="gastos" />
          <View style={[styles.divisoria, { backgroundColor: theme.backgroundSelected }]} />
          <Numero valor={dinheiro.formatar(porCabeca)} legenda="por cabeça" />
        </View>
        <View style={[styles.linhaFina, { backgroundColor: theme.backgroundSelected }]} />
        <LinhaGrupo
          separador={viagem.biggest !== null || podeVerContas}
          leading={<IconCircle name={icons.perfil} tone="neutral" />}
          title="Quem foi"
          subtitle={viagem.peopleNames.join(', ')}
        />
        {viagem.biggest ? (
          <LinhaGrupo
            separador={podeVerContas}
            leading={<IconCircle name={icons.brinde} tone="yellow" />}
            title={viagem.biggest.description}
            subtitle={`A maior extravagância · ${dinheiro.formatar(viagem.biggest.cents)}`}
          />
        ) : null}
        {podeVerContas ? (
          <LinhaGrupo
            onPress={() =>
              router.push({ pathname: '/sessao/[sessaoId]/despesas', params: { sessaoId } })
            }
            accessibilityLabel={`Ver as contas: ${plural(viagem.expenses, 'despesa', 'despesas')}`}
            leading={<IconCircle name={icons.preco} />}
            title="Ver as contas"
            subtitle={plural(viagem.expenses, 'despesa', 'despesas')}
            trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
          />
        ) : null}
      </Card>

      {lista.length > 0 ? (
        <>
          <SectionHeader title="O álbum" trailing={plural(lista.length, 'foto', 'fotos')} />
          <View style={styles.grelha}>
            {lista.map((foto) => (
              <Pressable
                key={foto.id}
                onPress={() => setAberta(foto)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Foto de ${foto.displayName}${foto.caption ? `: ${foto.caption}` : ''}`}
                style={[styles.foto, { backgroundColor: theme.backgroundSelected }]}>
                {foto.url ? (
                  <Image
                    source={{ uri: foto.url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {viagem.iWent ? (
        <Button
          label={
            aSubir > 0
              ? `A guardar ${plural(aSubir, 'foto', 'fotos')}…`
              : lista.length === 0
                ? 'Pôr fotos no álbum'
                : 'Pôr mais fotos'
          }
          icon={icons.camara}
          variant={lista.length === 0 ? 'primary' : 'secondary'}
          disabled={aSubir > 0}
          onPress={() => void juntarFotos()}
        />
      ) : null}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}

      <VerFoto foto={aberta} onFechar={() => setAberta(null)} onApagar={apagar} />
    </Screen>
  );
}

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <View style={styles.numero}>
      <ThemedText type="section" numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {legenda}
      </ThemedText>
    </View>
  );
}

/** A foto em grande, com a legenda e quem a tirou. */
function VerFoto({
  foto,
  onFechar,
  onApagar,
}: {
  foto: TripPhoto | null;
  onFechar: () => void;
  onApagar: (foto: TripPhoto) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={foto !== null} animationType="fade" onRequestClose={onFechar} transparent>
      <View style={styles.ecraInteiro}>
        {foto?.url ? (
          <Image
            source={{ uri: foto.url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Foto de ${foto.displayName}${foto.caption ? `: ${foto.caption}` : ''}`}
          />
        ) : null}
        <Pressable
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hitSlop={12}
          style={[styles.fechar, { top: insets.top + Spacing.two }]}>
          <Icon name={icons.fechar} size={22} color="#FFFFFF" />
        </Pressable>
        {foto ? (
          <View style={[styles.rodapeFoto, { paddingBottom: insets.bottom + Spacing.three }]}>
            {foto.caption ? <ThemedText style={styles.branco}>{foto.caption}</ThemedText> : null}
            <View style={styles.linhaFoto}>
              <ThemedText type="small" style={[styles.branco, styles.suave, styles.flex]}>
                {`Tirada por ${foto.mine ? 'ti' : foto.displayName}`}
              </ThemedText>
              {foto.mine ? (
                <Pressable onPress={() => onApagar(foto)} accessibilityRole="button" hitSlop={12}>
                  <ThemedText type="smallBold" style={styles.branco}>
                    Tirar do álbum
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  capa: {
    height: 260,
    justifyContent: 'flex-end',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  escudos: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  legenda: {
    padding: Spacing.threeAndHalf,
    gap: 2,
  },
  branco: {
    color: '#FFFFFF',
  },
  suave: {
    opacity: 0.85,
  },
  grupo: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  numeros: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.twoAndHalf,
  },
  numero: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.one,
  },
  divisoria: {
    width: 1,
    alignSelf: 'stretch',
  },
  linhaFina: {
    height: 1,
  },
  grelha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  foto: {
    width: '48.5%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  ecraInteiro: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fechar: {
    position: 'absolute',
    right: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodapeFoto: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  linhaFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
