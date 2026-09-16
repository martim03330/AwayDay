import { useEffect, useState } from 'react';
import { getCurrentPosition } from '@/features/presence/location';
import { abrirDirecoes } from '@/lib/direcoes';
import { distanciaEmLinhaRetaKm, estimarViagemDeCarro } from '@/lib/distancia';
import { formatarDuracao, formatarKm } from '@/lib/formatos';
import type { Coordenadas, Venue } from '@/mocks/tipos';
import { localizacaoUtilizador } from '@/mocks/utilizador';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ListRow } from '@/ui/list-row';

function ondeFica(venue: Venue) {
  if (venue.regiao === 'madeira') return 'na Madeira';
  if (venue.regiao === 'acores') return 'nos Açores';
  return `em ${venue.pais}`;
}

/**
 * A que distância fica o estádio **de onde estás agora**. Antes era a partir de uma morada simulada, o que não servia
 * a ninguém: agora a app pergunta a localização (e diz quando não a tem, em vez de inventar um ponto de partida).
 * No modo demo continua a ser a morada de exemplo, que é para isso que o modo demo existe.
 */
export function DistanciaCard({ venue }: { venue: Venue }) {
  const { modoDemo } = useAppState();
  // No modo demo a morada de exemplo é uma constante, não um estado: escrevê-la num efeito só dava renders a mais.
  const [posicao, setPosicao] = useState<Coordenadas | null>(null);
  const [estado, setEstado] = useState<'a-procurar' | 'ok' | 'sem-localizacao'>('a-procurar');
  const aqui = modoDemo ? localizacaoUtilizador.coordenadas : posicao;
  const pronto = modoDemo || (estado === 'ok' && posicao !== null);

  useEffect(() => {
    if (modoDemo) return;
    let ativo = true;
    void getCurrentPosition().then((resultado) => {
      if (!ativo) return;
      if (resultado.status !== 'ok') {
        setEstado('sem-localizacao');
        return;
      }
      setPosicao({
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      });
      setEstado('ok');
    });
    return () => {
      ativo = false;
    };
  }, [modoDemo]);

  async function procurarOutraVez() {
    setEstado('a-procurar');
    const resultado = await getCurrentPosition();
    if (resultado.status !== 'ok') {
      setEstado('sem-localizacao');
      return;
    }
    setPosicao({ latitude: resultado.position.latitude, longitude: resultado.position.longitude });
    setEstado('ok');
  }

  if (!pronto || !aqui) {
    return (
      <Card>
        <ListRow
          leading={<IconCircle name={icons.carro} tone="neutral" />}
          title={
            estado === 'a-procurar' ? 'A ver a que distância estás…' : 'Não sabemos onde estás'
          }
          subtitle={
            estado === 'a-procurar'
              ? 'Um instante.'
              : 'Sem a tua localização não dá para dizer a distância. Podes abrir o caminho no mapa na mesma.'
          }
        />
        {estado === 'sem-localizacao' ? (
          <LinkTexto label="Usar a minha localização" onPress={() => void procurarOutraVez()} />
        ) : null}
        <Button
          label="Abrir o caminho no mapa"
          icon={icons.rota}
          variant="secondary"
          onPress={() => abrirDirecoes(venue.coordenadas, 'carro')}
        />
      </Card>
    );
  }

  // Ilhas e estrangeiro: de carro não se vai, por isso só a distância em linha reta.
  const deCarro = venue.regiao === 'continente' || venue.regiao === localizacaoUtilizador.regiao;
  const titulo = deCarro
    ? (() => {
        const viagem = estimarViagemDeCarro(aqui, venue.coordenadas);
        return `≈ ${formatarKm(viagem.km)} · ${formatarDuracao(viagem.minutos)} de carro`;
      })()
    : `≈ ${formatarKm(distanciaEmLinhaRetaKm(aqui, venue.coordenadas))} em linha reta`;

  return (
    <Card>
      <ListRow
        leading={<IconCircle name={deCarro ? icons.carro : icons.aviao} tone="sky" />}
        title={titulo}
        subtitle={
          modoDemo
            ? `A partir de ${localizacaoUtilizador.descricao} (localização simulada)`
            : deCarro
              ? 'A partir de onde estás agora, sem contar com o trânsito.'
              : `O estádio fica ${ondeFica(venue)}: daqui só dá para dizer a distância em linha reta.`
        }
      />
      <Button
        label="Abrir o caminho no mapa"
        icon={icons.rota}
        variant="secondary"
        onPress={() => abrirDirecoes(venue.coordenadas, 'carro')}
      />
    </Card>
  );
}
