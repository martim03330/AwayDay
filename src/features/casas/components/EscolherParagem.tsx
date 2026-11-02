import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { Radius, Spacing } from '@/constants/theme';
import { lerHora } from '@/features/casas/formulario';
import { useTheme } from '@/hooks/use-theme';
import { formatarDistancia } from '@/lib/formatos';
import { PlaceSearchRefused, searchPlace, type PlaceResult } from '@/lib/procurar-sitios';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { ThemedText } from '@/ui/themed-text';

export type ParagemEscolhida = {
  name: string;
  latitude: number;
  longitude: number;
  /** 0 on the game day, 1 the day before. */
  diasAntes: number;
  /** «HH:MM» in Lisbon. */
  hora: string;
};

type Ponto = { latitude: number; longitude: number };

const DELTA = 0.02;

/**
 * One stop, as in «Oferecer boleia»: tap the map (or search a street) to drop the pin, give it a name and the time
 * the bus passes. A stop is a public place of the Casa, never someone's home.
 */
export function EscolherParagem({
  onAcrescentar,
  onCancelar,
}: {
  onAcrescentar: (paragem: ParagemEscolhida) => void;
  onCancelar: () => void;
}) {
  const theme = useTheme();
  const mapa = useRef<MapView>(null);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [nome, setNome] = useState('');
  const [hora, setHora] = useState('');
  const [diasAntes, setDiasAntes] = useState(0);
  const [pesquisa, setPesquisa] = useState('');
  const [resultados, setResultados] = useState<PlaceResult[] | null>(null);
  const [aProcurar, setAProcurar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function procurar() {
    const texto = pesquisa.trim();
    if (texto.length < 3) return;
    setAProcurar(true);
    try {
      setResultados(await searchPlace(texto, ponto));
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
    const novo = { latitude: resultado.latitude, longitude: resultado.longitude };
    setPonto(novo);
    if (!nome.trim()) setNome(resultado.name);
    setResultados(null);
    mapa.current?.animateToRegion({ ...novo, latitudeDelta: DELTA, longitudeDelta: DELTA }, 300);
  }

  function acrescentar() {
    const horaLida = lerHora(hora);
    const problema = !ponto
      ? 'Põe o pino da paragem no mapa.'
      : nome.trim().length < 2
        ? 'Dá um nome à paragem (ex.: Sede da Casa).'
        : !horaLida
          ? 'Escreve a hora a que o transporte passa (ex.: 9:30).'
          : null;
    setErro(problema);
    if (!ponto || !horaLida || problema) return;
    onAcrescentar({ name: nome.trim(), ...ponto, diasAntes, hora: horaLida });
  }

  return (
    <Card>
      <ThemedText type="smallBold">Nova paragem</ThemedText>
      <View style={styles.mapaArea}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          // Portugal until a search or a tap.
          initialRegion={{ latitude: 39.6, longitude: -8.0, latitudeDelta: 6, longitudeDelta: 6 }}
          onPress={(evento) => setPonto(evento.nativeEvent.coordinate)}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          accessibilityLabel="Mapa para escolher a paragem. Toca para pôr o pino, ou arrasta-o.">
          {ponto ? (
            <MapMarker
              coordinate={ponto}
              draggable
              onDragEnd={(evento) => setPonto(evento.nativeEvent.coordinate)}
              pinColor={theme.accent}
              title="Paragem"
            />
          ) : null}
        </MapView>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {ponto ? 'Pino posto: arrasta-o para acertar.' : 'Toca no mapa ou procura a rua.'}
      </ThemedText>

      <Campo
        label="Procurar rua ou sítio"
        value={pesquisa}
        onChangeText={setPesquisa}
        placeholder="Ex.: Largo da estação"
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
            Nada com esse nome. Experimenta a rua e a cidade.
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
                valor={resultado.distanceM !== null ? formatarDistancia(resultado.distanceM) : undefined}
                separador={indice < resultados.length - 1}
              />
            ))}
          </View>
        )
      ) : null}

      <Campo
        label="Nome da paragem"
        value={nome}
        onChangeText={setNome}
        placeholder="Ex.: Sede da Casa"
        maxLength={80}
        autoCapitalize="words"
      />
      <View style={styles.chips}>
        <Chip label="No dia do jogo" selected={diasAntes === 0} emCartao onPress={() => setDiasAntes(0)} />
        <Chip label="Na véspera" selected={diasAntes === 1} emCartao onPress={() => setDiasAntes(1)} />
      </View>
      <Campo
        label="Hora de passagem"
        value={hora}
        onChangeText={setHora}
        placeholder="Ex.: 9:30"
        maxLength={5}
        keyboardType="numbers-and-punctuation"
      />
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button label="Acrescentar paragem" onPress={acrescentar} />
      <LinkTexto neutro label="Deixa estar" onPress={onCancelar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  mapaArea: {
    height: 220,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
