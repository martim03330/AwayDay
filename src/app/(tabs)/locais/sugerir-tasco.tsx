import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { Radius, Spacing } from '@/constants/theme';
import { getCurrentPosition } from '@/features/presence/location';
import { suggestPlace, SuggestionRefused, type NewPlace } from '@/features/places/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarDistancia } from '@/lib/formatos';
import { PlaceSearchRefused, searchPlace, type PlaceResult } from '@/lib/procurar-sitios';
import { useUserId } from '@/lib/session';
import { obterEstadio } from '@/mocks/estadios';
import type { Coordenadas } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

const DELTA = 0.006;

/** Mainland Portugal, until there is a stadium, a search result or a tap to start from. */
const PORTUGAL = { latitude: 39.6, longitude: -8.0, latitudeDelta: 6, longitudeDelta: 6 };

const TIPOS: { id: NewPlace['kind']; nome: string }[] = [
  { id: 'tasca', nome: 'Tasca' },
  { id: 'cervejaria', nome: 'Cervejaria' },
  { id: 'bar', nome: 'Bar' },
  { id: 'roulotte', nome: 'Roulotte' },
  { id: 'churrasqueira', nome: 'Churrasqueira' },
  { id: 'cafe', nome: 'Café' },
  { id: 'restaurante', nome: 'Restaurante' },
];

const SEM_SITIO = 'Falta dizer onde fica: procura o nome ou a rua, ou toca no mapa.';

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
      return SEM_SITIO;
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
  // Starts at the stadium: most tascos are around it. Nothing happens on its own: the fan searches, taps the map or
  // says «Estou aqui», so it works the same at home or standing in the tasco.
  const [ponto, setPonto] = useState<Coordenadas | null>(estadio?.coordenadas ?? null);
  const [pesquisa, setPesquisa] = useState('');
  const [aProcurar, setAProcurar] = useState(false);
  const [resultados, setResultados] = useState<PlaceResult[] | null>(null);
  const [localizacao, setLocalizacao] = useState<'parada' | 'a-procurar' | 'negada' | 'indisponivel'>(
    'parada'
  );
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mapa = useRef<MapView>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const latitude = ponto?.latitude;
  const longitude = ponto?.longitude;

  // The camera follows the pin, wherever it came from (search, «Estou aqui» or a tap).
  useEffect(() => {
    if (!mapaPronto || latitude === undefined || longitude === undefined) return;
    mapa.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA },
      350
    );
  }, [mapaPronto, latitude, longitude]);

  function estouAqui() {
    setLocalizacao('a-procurar');
    void getCurrentPosition().then((resultado) => {
      if (resultado.status !== 'ok') {
        setLocalizacao(resultado.status === 'denied' ? 'negada' : 'indisponivel');
        return;
      }
      setLocalizacao('parada');
      setResultados(null);
      setPonto({
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      });
    });
  }

  async function procurar() {
    const texto = pesquisa.trim();
    if (texto.length < 3) return;
    setAProcurar(true);
    try {
      setResultados(await searchPlace(texto, ponto ?? estadio?.coordenadas ?? null));
    } catch (problema) {
      Alert.alert(
        'Sem resultados',
        problema instanceof PlaceSearchRefused && problema.reason === 'rate_limited'
          ? 'Fizeste muitas pesquisas numa hora. Tenta daqui a pouco.'
          : 'Verifica a ligação e tenta outra vez.'
      );
    } finally {
      setAProcurar(false);
    }
  }

  function escolherResultado(resultado: PlaceResult) {
    setPonto({ latitude: resultado.latitude, longitude: resultado.longitude });
    // Searching by the tasco's name is the quickest way in: keep that name if none was written yet.
    if (!nome.trim()) setNome(resultado.name);
    setResultados(null);
  }

  if (!userId) {
    return (
      <Screen voltarAoTopo={false}>
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
      setErro(SEM_SITIO);
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
    <Screen voltarAoTopo={false}>
      <ThemedText type="title" accessibilityRole="header">
        Sugerir um tasco
      </ThemedText>
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
        autoCapitalize="words"
        returnKeyType="done"
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
      <Campo
        label="Procurar pelo nome ou pela rua"
        value={pesquisa}
        onChangeText={setPesquisa}
        placeholder="Ex.: Tasca do Zé, Porto"
        returnKeyType="search"
        onSubmitEditing={() => void procurar()}
        maxLength={120}
      />
      {pesquisa.trim().length >= 3 ? (
        <Button
          label={aProcurar ? 'A procurar…' : 'Procurar'}
          variant="secondary"
          icon={icons.rota}
          disabled={aProcurar}
          onPress={() => void procurar()}
        />
      ) : null}
      {resultados ? (
        resultados.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nada com esse nome. Experimenta a rua e a cidade, ou toca no mapa.
          </ThemedText>
        ) : (
          <View>
            {resultados.map((resultado, indice) => (
              <LinhaGrupo
                key={`${resultado.latitude},${resultado.longitude}`}
                onPress={() => escolherResultado(resultado)}
                accessibilityLabel={`${resultado.name}, ${resultado.detail}`}
                leading={<IconCircle name={icons.locais} tone="neutral" size={16} />}
                title={resultado.name}
                subtitle={[
                  resultado.detail,
                  resultado.distanceM !== null ? `a ${formatarDistancia(resultado.distanceM)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                separador={indice < resultados.length - 1}
              />
            ))}
          </View>
        )
      ) : null}

      <View style={[styles.mapa, { borderColor: theme.border }]}>
        <MapView
          ref={mapa}
          style={styles.mapaInterior}
          initialRegion={
            ponto
              ? { ...ponto, latitudeDelta: DELTA, longitudeDelta: DELTA }
              : PORTUGAL
          }
          onMapReady={() => setMapaPronto(true)}
          onPress={(evento) => {
            setPonto(evento.nativeEvent.coordinate);
            setResultados(null);
          }}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          accessibilityLabel="Mapa para pôr o tasco. Toca no sítio certo, ou arrasta o pino.">
          {ponto ? (
            <MapMarker
              coordinate={ponto}
              draggable
              onDragEnd={(evento) => setPonto(evento.nativeEvent.coordinate)}
              title={nomeLimpo || 'O tasco'}
            />
          ) : null}
        </MapView>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {localizacao === 'a-procurar'
          ? 'À procura de onde estás…'
          : localizacao === 'negada'
            ? 'Sem acesso à localização. Procura o nome ou toca no mapa.'
            : localizacao === 'indisponivel'
              ? 'Não conseguimos saber onde estás. Procura o nome ou toca no mapa.'
              : 'Toca no mapa ou arrasta o pino para o sítio certo.'}
      </ThemedText>
      <Button
        label="Estou aqui"
        variant="secondary"
        icon={icons.locais}
        disabled={localizacao === 'a-procurar'}
        onPress={estouAqui}
      />

      <Campo
        label="Porque é que vale a pena (opcional)"
        value={nota}
        onChangeText={setNota}
        placeholder="Ex.: bifanas boas e servem rápido antes do jogo"
        maxLength={200}
        autoCapitalize="sentences"
        returnKeyType="done"
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
