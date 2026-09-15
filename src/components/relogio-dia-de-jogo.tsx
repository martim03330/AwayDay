import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { modosTransporte } from '@/components/como-chegar';
import { PontoAoVivo } from '@/components/jogo-card';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { fimDoJogo } from '@/lib/jogos';
import { filtrarPorTempoAPe } from '@/lib/locais';
import { avisoDeChuva } from '@/lib/meteorologia';
import { LIMIAR_CALOR } from '@/lib/pratos';
import {
  FASES_DIA_DE_JOGO,
  faseDoDiaDeJogo,
  formatarContagem,
  horaLimiteParaSair,
  nomesFase,
  partidaDoUltimoTransporte,
  tascoMaisConcorrido,
  tascoParaAlmocar,
  type FaseDiaDeJogo,
} from '@/lib/relogio';
import { locaisDoEstadio } from '@/mocks/locais';
import { ultimoTransporteDe } from '@/mocks/regressos';
import type { Jogo, Local, Venue } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const MEIA_HORA_MS = 30 * 60 * 1000;

function LinhaAviso({ icon, texto }: { icon: IconName; texto: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={texto}
      style={[styles.aviso, { backgroundColor: theme.warningBackground }]}>
      <Icon name={icon} size={16} color={theme.warningText} />
      <ThemedText style={[styles.avisoTexto, { color: theme.warningText }]}>{texto}</ThemedText>
    </View>
  );
}

/** Five-step bar: past phases green, the current one yellow, the rest empty. */
function PassosDoDia({ fase }: { fase: FaseDiaDeJogo }) {
  const theme = useTheme();
  const atual = FASES_DIA_DE_JOGO.indexOf(fase);

  return (
    <View
      style={styles.passos}
      accessible
      accessibilityLabel={`Fase ${atual + 1} de ${FASES_DIA_DE_JOGO.length}: ${nomesFase[fase]}`}>
      {FASES_DIA_DE_JOGO.map((passo, index) => (
        <View
          key={passo}
          style={[
            styles.passo,
            {
              backgroundColor:
                index < atual ? theme.accent : index === atual ? theme.highlight : theme.border,
            },
          ]}
        />
      ))}
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
      <View
        style={[styles.aoVivo, { backgroundColor: theme.accent }]}
        accessible
        accessibilityLabel={`Em jogo. Termina por volta das ${formatarHora(fim)}.`}>
        <PontoAoVivo />
        <ThemedText style={[styles.aoVivoTitulo, { color: theme.accentText }]}>Em jogo</ThemedText>
        <ThemedText style={[styles.aoVivoHora, { color: theme.accentText }]}>
          {`até cerca das ${formatarHora(fim)}`}
        </ThemedText>
        {etiquetaSimulada}
      </View>
    );
  }

  // The one moment with a key action (go and check in) gets the yellow button and ring.
  const tascoCheckIn = fase === 'check-in' ? tascoMaisConcorrido(perto, pessoasAqui) : undefined;
  const destaque = Boolean(tascoCheckIn);

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
      const tasco = tascoCheckIn;
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
            {pessoasAqui(tasco) === null
              ? `A malta já se está a juntar. Sugestão: ${tasco.nome}, a ${tasco.minutosAPe} min a pé do estádio.`
              : `A malta já se está a juntar. ${tasco.nome}: já lá estão ${plural(pessoasAqui(tasco) ?? 0, 'pessoa', 'pessoas')}.`}
          </ThemedText>
          <Button
            label="Ir fazer check-in"
            variant="highlight"
            icon={icons.checkIn}
            onPress={() => abrirLocal(tasco)}
          />
        </>
      );
    }

    if (fase === 'a-caminho') {
      const ondeFizesteCheckIn = perto.find((local) => fezCheckIn(local.id));
      const origem = ondeFizesteCheckIn ?? tascoMaisConcorrido(perto, pessoasAqui);
      const chuva = avisoDeChuva(jogo.meteorologia, venue);
      const temperatura = jogo.meteorologia?.temperatura;
      const calor = temperatura !== undefined && temperatura >= LIMIAR_CALOR;
      const avisos = (
        <>
          {chuva ? <LinhaAviso icon={icons.cobertura} texto={chuva.mensagem} /> : null}
          {calor ? (
            <LinhaAviso
              icon={icons.agua}
              texto={`Estão ${temperatura} °C: leva água para a bancada.`}
            />
          ) : null}
        </>
      );

      if (!origem) {
        const tempos = venue.transportes.map((transporte) => transporte.minutos);
        return (
          <>
            <ThemedText type="small">
              {tempos.length > 0
                ? `Está na hora de ir para o estádio: a opção mais rápida demora ${Math.min(...tempos)} min.`
                : 'Está na hora de ir para o estádio.'}
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
        <ThemedText type="section" style={styles.apitoFinal}>
          Apito final. Como foi?
        </ThemedText>
        <Button
          label={avaliacao ? 'Editar avaliação' : 'Avaliar experiência'}
          variant="highlight"
          icon={icons.estrela}
          onPress={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
        />
        {transporte ? (
          <View style={[styles.transporte, { borderTopColor: theme.border }]}>
            <Icon name={modosTransporte[transporte.modo].icon} size={20} color={theme.info} />
            <View style={styles.flex}>
              <ThemedText style={styles.transporteTitulo}>{`Último regresso às ${transporte.hora}`}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.transporteDescricao}>
                {transporte.descricao}
              </ThemedText>
            </View>
            <Etiqueta
              label={falta > 0 ? `Sai daqui a ${formatarContagem(falta)}` : 'Já saiu · resta TVDE'}
              tone={falta <= 0 ? 'negativo' : falta < MEIA_HORA_MS ? 'aviso' : 'positivo'}
            />
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Sem informação do último transporte de regresso.
          </ThemedText>
        )}
      </>
    );
  }

  const contagem = formatarContagem(Date.parse(jogo.inicio) - agora);

  return (
    <View
      style={[
        styles.bloco,
        { backgroundColor: theme.backgroundElement },
        destaque && { borderColor: theme.highlight },
      ]}>
      <View style={styles.topo}>
        <View style={styles.fase}>
          <Icon name={icons.horario} size={16} color={theme.accentInk} />
          <ThemedText type="eyebrow" themeColor="accentInk" style={styles.flexEncolhe}>
            {nomesFase[fase]}
          </ThemedText>
          {etiquetaSimulada}
        </View>
        {fase === 'depois' ? null : (
          <View style={styles.contagem}>
            <ThemedText themeColor="textSecondary" style={styles.contagemRotulo}>
              Apito daqui a
            </ThemedText>
            <ThemedText
              type="score"
              style={styles.contagemValor}
              accessibilityRole="timer"
              accessibilityLabel={`Apito daqui a ${contagem}`}>
              {contagem}
            </ThemedText>
          </View>
        )}
      </View>

      <PassosDoDia fase={fase} />

      {fase === 'depois' ? renderDepois() : renderSugestao()}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: 12,
    padding: 14,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: 'transparent',
    ...CardShadow,
  },
  aoVivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  aoVivoTitulo: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  aoVivoHora: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
    opacity: 0.85,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  fase: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  flexEncolhe: {
    flexShrink: 1,
  },
  contagem: {
    alignItems: 'flex-end',
  },
  contagemRotulo: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
  contagemValor: {
    fontSize: 24,
    lineHeight: 27,
    fontVariant: ['tabular-nums'],
  },
  passos: {
    flexDirection: 'row',
    gap: 5,
  },
  passo: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  apitoFinal: {
    fontSize: 28,
    lineHeight: 31,
    fontWeight: 900,
  },
  flex: {
    flex: 1,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
  transporte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  transporteTitulo: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 800,
  },
  transporteDescricao: {
    fontSize: 12,
    lineHeight: 16,
  },
});
