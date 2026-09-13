import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { modosTransporte } from '@/components/como-chegar';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { fimDoJogo } from '@/lib/jogos';
import { filtrarPorTempoAPe } from '@/lib/locais';
import { avisoDeChuva } from '@/lib/meteorologia';
import { LIMIAR_CALOR } from '@/lib/pratos';
import {
  faseDoDiaDeJogo,
  formatarContagem,
  horaLimiteParaSair,
  partidaDoUltimoTransporte,
  tascoMaisConcorrido,
  tascoParaAlmocar,
} from '@/lib/relogio';
import { locaisDoEstadio } from '@/mocks/locais';
import { ultimoTransporteDe } from '@/mocks/regressos';
import type { Jogo, Local, Venue } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

const MEIA_HORA_MS = 30 * 60 * 1000;

function LinhaAviso({ icon, texto }: { icon: IconName; texto: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={texto}
      style={[styles.aviso, { backgroundColor: theme.warningBackground }]}>
      <Icon name={icon} size={16} color={theme.warning} />
      <ThemedText type="small" style={styles.flex}>
        {texto}
      </ThemedText>
    </View>
  );
}

type RelogioDiaDeJogoProps = {
  jogo: Jogo;
  venue: Venue;
};

/** Bloco fixo no topo da ficha do jogo, só no próprio dia, com uma sugestão por fase. */
export function RelogioDiaDeJogo({ jogo, venue }: RelogioDiaDeJogoProps) {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow(1000);
  const { simulacao } = useRelogio();
  const { fezCheckIn, pessoasAqui, avaliacaoDoJogo } = useAppState();

  const fase = faseDoDiaDeJogo(jogo, agora);
  const fim = fimDoJogo(jogo);
  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(venue.id));
  const etiquetaSimulada = simulacao ? <Badge label="Hora simulada" tone="neutral" /> : null;

  if (fase === 'a-decorrer') {
    return (
      <ThemedView
        type="backgroundElement"
        style={[styles.bloco, styles.discreto]}
        accessible
        accessibilityLabel={`Em jogo. Termina por volta das ${formatarHora(fim)}.`}>
        <View style={[styles.pontoAoVivo, { backgroundColor: theme.success }]} />
        <ThemedText type="smallBold">Em jogo</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {`até cerca das ${formatarHora(fim)}`}
        </ThemedText>
        {etiquetaSimulada}
      </ThemedView>
    );
  }

  function abrirLocal(local: Local) {
    router.push({ pathname: '/locais/[localId]', params: { localId: local.id } });
  }

  function renderSugestao() {
    if (fase === 'almoco') {
      const tasco = tascoParaAlmocar(perto);
      if (!tasco) {
        return (
          <ThemedText type="small">Almoça antes de vir: por aqui ainda não mapeámos tascos.</ThemedText>
        );
      }
      return (
        <>
          <ThemedText type="small">
            {`Há tempo para almoçar com calma. Sugestão: ${tasco.nome}, a ${tasco.minutosAPe} min a pé do estádio.`}
          </ThemedText>
          <Button
            label="Ver tascos"
            variant="secondary"
            icon={icons.locais}
            onPress={() => router.navigate({ pathname: '/locais', params: { estadio: venue.id } })}
          />
        </>
      );
    }

    if (fase === 'check-in') {
      const tasco = tascoMaisConcorrido(perto, pessoasAqui);
      if (!tasco) {
        return (
          <ThemedText type="small">
            Ainda não mapeámos tascos por aqui. Guarda a energia para a bancada.
          </ThemedText>
        );
      }
      return (
        <>
          <ThemedText type="small">
            {`A malta já se está a juntar. ${tasco.nome}: já lá estão ${plural(pessoasAqui(tasco), 'pessoa', 'pessoas')}.`}
          </ThemedText>
          <Button label="Ir fazer check-in" icon={icons.checkIn} onPress={() => abrirLocal(tasco)} />
        </>
      );
    }

    if (fase === 'a-caminho') {
      const ondeFizesteCheckIn = perto.find((local) => fezCheckIn(local.id));
      const origem = ondeFizesteCheckIn ?? tascoMaisConcorrido(perto, pessoasAqui);
      const chuva = avisoDeChuva(jogo.meteorologia, venue);
      const calor = jogo.meteorologia.temperatura >= LIMIAR_CALOR;
      const avisos = (
        <>
          {chuva ? <LinhaAviso icon={icons.cobertura} texto={chuva.mensagem} /> : null}
          {calor ? (
            <LinhaAviso
              icon={icons.agua}
              texto={`Estão ${jogo.meteorologia.temperatura} °C: leva água para a bancada.`}
            />
          ) : null}
        </>
      );

      if (!origem) {
        const maisRapido = Math.min(...venue.transportes.map((transporte) => transporte.minutos));
        return (
          <>
            <ThemedText type="small">
              {`Está na hora de ir para o estádio: a opção mais rápida demora ${maisRapido} min.`}
            </ThemedText>
            {avisos}
          </>
        );
      }

      const sairAte = horaLimiteParaSair(jogo, origem.minutosAPe);
      const desde = ondeFizesteCheckIn
        ? `desde ${origem.nome}, onde fizeste check-in`
        : `desde ${origem.nome}`;
      return (
        <>
          <ThemedText type="small">
            {sairAte.getTime() > agora
              ? `Está na hora de andar: ${origem.minutosAPe} min a pé ${desde}. Sai até às ${formatarHora(sairAte)}.`
              : `Já devias ter saído: são ${origem.minutosAPe} min a pé ${desde}. Acelera o passo.`}
          </ThemedText>
          {avisos}
        </>
      );
    }

    return null;
  }

  function renderDepois() {
    const avaliacao = avaliacaoDoJogo(jogo.id);
    const transporte = ultimoTransporteDe(venue.id);
    const partida = transporte ? partidaDoUltimoTransporte(jogo, transporte) : null;
    const falta = partida ? partida.getTime() - agora : 0;

    return (
      <>
        <ThemedText style={styles.titulo}>Apito final. Como foi?</ThemedText>
        <Button
          label={avaliacao ? 'Editar avaliação' : 'Avaliar experiência'}
          icon={icons.estrela}
          onPress={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
        />
        {transporte ? (
          <View style={styles.transporte}>
            <IconCircle name={modosTransporte[transporte.modo].icon} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{`Último regresso às ${transporte.hora}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {transporte.descricao}
              </ThemedText>
              <View style={styles.etiqueta}>
                <Etiqueta
                  icon={icons.horario}
                  label={falta > 0 ? `Sai daqui a ${formatarContagem(falta)}` : 'Já saiu · resta TVDE'}
                  tone={falta <= 0 ? 'negativo' : falta < MEIA_HORA_MS ? 'aviso' : 'positivo'}
                />
              </View>
            </View>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Sem informação do último transporte de regresso.
          </ThemedText>
        )}
      </>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.bloco}>
      <View style={styles.topo}>
        <Icon name={icons.horario} size={14} color={theme.textSecondary} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rotulo}>
          Dia de jogo
        </ThemedText>
        <View style={styles.flex} />
        {etiquetaSimulada}
      </View>

      {fase === 'depois' ? (
        renderDepois()
      ) : (
        <>
          <ThemedText style={styles.titulo} accessibilityRole="timer">
            {`Apito daqui a ${formatarContagem(Date.parse(jogo.inicio) - agora)}`}
          </ThemedText>
          {renderSugestao()}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  discreto: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pontoAoVivo: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rotulo: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titulo: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
  },
  transporte: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  etiqueta: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
});
