import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { Radius, Spacing } from '@/constants/theme';
import { getCurrentPosition } from '@/features/presence/location';
import { suggestPlace, SuggestionRefused, type NewPlace } from '@/features/places/api';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { obterEstadio } from '@/mocks/estadios';
import type { Coordenadas } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

const DELTA = 0.006;

const TIPOS: { id: NewPlace['kind']; nome: string }[] = [
  { id: 'tasca', nome: 'Tasca' },
  { id: 'cervejaria', nome: 'Cervejaria' },
  { id: 'bar', nome: 'Bar' },
  { id: 'roulotte', nome: 'Roulotte' },
  { id: 'churrasqueira', nome: 'Churrasqueira' },
  { id: 'cafe', nome: 'Café' },
  { id: 'restaurante', nome: 'Restaurante' },
];

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof SuggestionRefused)) {
    return 'Não deu para enviar a sugestão. Tenta outra vez daqui a pouco.';
  }
  switch (erro.reason) {
    case 'duplicate':
      return 'Este tasco já está na app (ou há outro mesmo ao lado com o mesmo nome).';
    case 'rate-limited':
      return 'Já sugeriste tascos que cheguem por hoje. Volta amanhã.';
    case 'too-far':
      return 'Fica longe demais: só aceitamos sítios até 45 min a pé de um estádio com jogos.';
    case 'bad-name':
      return 'Escreve só o nome do sítio, entre 2 e 60 letras, sem links nem telefones.';
    case 'bad-location':
      return 'Falta dizer onde fica. Arrasta o pino para o sítio certo.';
    default:
      return 'Precisas de ter sessão iniciada para sugerir um tasco.';
  }
}

/**
 * A fan puts a tasco on the map that nobody had. The rules live in the server (`suggest_place`): up to 45 minutes on
 * foot from a stadium with games, no duplicates, a few suggestions per person, and it only becomes a real place when
 * five other fans confirm it.
 */
export default function SugerirTascoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const { estadioId } = useLocalSearchParams<{ estadioId?: string }>();
  const estadio = estadioId ? obterEstadio(estadioId) : undefined;

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<NewPlace['kind']>('tasca');
  const [nota, setNota] = useState('');
  const [ponto, setPonto] = useState<Coordenadas | null>(estadio?.coordenadas ?? null);
  const [estadoLocalizacao, setEstadoLocalizacao] = useState<
    'a-procurar' | 'ok' | 'negada' | 'indisponivel'
  >('a-procurar');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Most people suggest the place they are standing in.
  useEffect(() => {
    let ativo = true;
    void getCurrentPosition().then((resultado) => {
      if (!ativo) return;
      if (resultado.status !== 'ok') {
        setEstadoLocalizacao(resultado.status === 'denied' ? 'negada' : 'indisponivel');
        return;
      }
      setEstadoLocalizacao('ok');
      setPonto({
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      });
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Para um tasco novo entrar na app, temos de saber quem o sugeriu."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  async function enviar() {
    if (!ponto) {
      setErro('Falta dizer onde fica. Arrasta o pino para o sítio certo.');
      return;
    }
    setErro(null);
    setAEnviar(true);
    try {
      await suggestPlace({ name: nome, kind: tipo, location: ponto, note: nota });
      Alert.alert(
        'Obrigado!',
        'O teu tasco já está na lista, marcado como por confirmar. Fica confirmado quando 5 adeptos disserem que é bom.'
      );
      router.back();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAEnviar(false);
    }
  }

  const nomeLimpo = nome.trim();
  const podeEnviar = nomeLimpo.length >= 2 && ponto !== null && !aEnviar;

  return (
    <Screen>
      <ThemedText type="title">Sugerir um tasco</ThemedText>
      <ThemedText themeColor="textSecondary">
        Conheces um sítio que não está na app? Mete-o aqui. Aparece logo como «por confirmar» e fica
        confirmado quando 5 adeptos disserem que é bom.
      </ThemedText>

      <Campo
        label="Nome do sítio"
        value={nome}
        onChangeText={setNome}
        placeholder="Ex.: Tasca do Zé"
        maxLength={60}
      />

      <ThemedText style={styles.rotulo}>Que tipo de sítio é</ThemedText>
      <View style={styles.chips}>
        {TIPOS.map((opcao) => (
          <Chip
            key={opcao.id}
            label={opcao.nome}
            selected={opcao.id === tipo}
            onPress={() => setTipo(opcao.id)}
          />
        ))}
      </View>

      <ThemedText style={styles.rotulo}>Onde fica</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {estadoLocalizacao === 'ok'
          ? 'Pusemos o pino onde estás. Arrasta-o se o sítio for ali ao lado.'
          : estadoLocalizacao === 'a-procurar'
            ? 'À procura de onde estás…'
            : estadoLocalizacao === 'negada'
              ? 'Sem acesso à localização: arrasta o pino para o sítio certo.'
              : 'Não conseguimos saber onde estás: arrasta o pino para o sítio certo.'}
      </ThemedText>
      {ponto ? (
        <View style={[styles.mapa, { borderColor: theme.border }]}>
          <MapView
            style={styles.mapaInterior}
            initialRegion={{
              latitude: ponto.latitude,
              longitude: ponto.longitude,
              latitudeDelta: DELTA,
              longitudeDelta: DELTA,
            }}>
            <MapMarker
              coordinate={ponto}
              draggable
              onDragEnd={(evento) => setPonto(evento.nativeEvent.coordinate)}
              title={nomeLimpo || 'O tasco'}
            />
          </MapView>
        </View>
      ) : null}

      <Campo
        label="Porque é que vale a pena (opcional)"
        value={nota}
        onChangeText={setNota}
        placeholder="Ex.: bifanas boas e servem rápido antes do jogo"
        maxLength={200}
      />

      {erro ? (
        <ThemedText style={{ color: theme.dangerText }} accessibilityLiveRegion="polite">
          {erro}
        </ThemedText>
      ) : null}

      <Button
        label={aEnviar ? 'A enviar…' : 'Sugerir tasco'}
        icon={icons.checkIn}
        disabled={!podeEnviar}
        onPress={() => void enviar()}
      />
      <LinkTexto neutro label="Deixa estar" onPress={() => router.back()} />

      <ThemedText type="small" themeColor="textMuted">
        Aceitamos sítios até 45 min a pé de um estádio com jogos. Nada de links nem telefones no
        nome: isto é para tascos, não para anúncios.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rotulo: {
    fontWeight: 700,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  mapa: {
    height: 200,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapaInterior: {
    flex: 1,
  },
});
