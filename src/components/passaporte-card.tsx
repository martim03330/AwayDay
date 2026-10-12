import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCarimbosNovos } from '@/hooks/use-carimbos-novos';
import { useTheme } from '@/hooks/use-theme';
import { notaDoEstadio } from '@/lib/avaliacoes';
import { formatarData } from '@/lib/datas';
import { formatarNota } from '@/lib/formatos';
import { DIVISOES, nomesDivisao, obterClube } from '@/mocks/clubes';
import { estadios, estadiosNacionais } from '@/mocks/estadios';
import type { AvaliacaoVisita, Clube, Venue } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Carimbo } from '@/ui/carimbo';
import { Icon, icons } from '@/ui/icon';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

const TAMANHO_CARIMBO = 80;

/** Words that say nothing on a stamp ("Estádio Municipal de Braga" -> "BRAGA"). */
const PALAVRAS_GENERICAS = new Set([
  'estádio',
  'municipal',
  'parque',
  'jogos',
  'desportivo',
  'complexo',
  'século',
  'de',
  'do',
  'da',
  'dos',
  'das',
]);

/** Short stencil label for the stamp: the last meaningful word of the stadium name. */
function nomeDoCarimbo(nome: string) {
  const palavras = nome
    .split(/\s+/)
    .filter(
      (palavra) =>
        palavra.length > 2 &&
        !palavra.endsWith('.') &&
        !/^[IVXLC]+$/.test(palavra) &&
        !PALAVRAS_GENERICAS.has(palavra.toLowerCase())
    );
  return (palavras[palavras.length - 1] ?? nome).toUpperCase();
}

function tamanhoDoNome(rotulo: string) {
  if (rotulo.length <= 4) return 20;
  if (rotulo.length <= 6) return 17;
  if (rotulo.length <= 8) return 14;
  return 12;
}

/** "13·09·26": the date of the latest rated visit to this stadium, if there is one. */
function dataDoCarimbo(avaliacoes: readonly AvaliacaoVisita[], estadioId: string) {
  const ultima = avaliacoes
    .filter((avaliacao) => avaliacao.estadioId === estadioId)
    .map((avaliacao) => avaliacao.dataVisita)
    .sort()
    .at(-1);
  if (!ultima) return null;
  const [dia, mes, ano] = formatarData(new Date(ultima)).split('/');
  return dia && mes && ano ? `${dia}·${mes}·${ano.slice(-2)}` : null;
}

/** A few degrees either way, always the same for the same stadium. */
function rotacaoDoCarimbo(estadioId: string) {
  let soma = 0;
  for (const letra of estadioId) soma = (soma * 31 + letra.charCodeAt(0)) % 997;
  return `${(soma % 19) - 9}deg`;
}

function eClara(cor: string) {
  const hex = /^#?([0-9a-f]{6})$/i.exec(cor)?.[1];
  if (!hex) return false;
  const [r, g, b] = [0, 2, 4].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

/** Ink in the home club's colour; white or yellow clubs fall back to their second colour. */
function corDaTinta(dono: Clube | undefined) {
  if (!dono) return Colors.accent;
  if (!eClara(dono.cores.primaria)) return dono.cores.primaria;
  if (!eClara(dono.cores.secundaria)) return dono.cores.secundaria;
  return Colors.text;
}

type PassaporteCardProps = {
  estadiosVisitados: readonly string[];
  /** Estádios carimbados no local, em dia de jogo: os que contam para o ranking público. */
  verificados?: readonly string[];
  avaliacoes: readonly AvaliacaoVisita[];
  /** Summary for the profile: only the most recent visited stamps, up to this many. */
  limite?: number;
};

export function PassaporteCard({
  estadiosVisitados,
  verificados = [],
  avaliacoes,
  limite,
}: PassaporteCardProps) {
  const eNovo = useCarimbosNovos(estadiosVisitados);

  const visitado = (estadioId: string) => estadiosVisitados.includes(estadioId);
  const totalVisitados = estadiosNacionais.filter((estadio) => visitado(estadio.id)).length;

  const porVisitar = (lista: readonly Venue[]) =>
    [...lista].sort((a, b) => Number(visitado(b.id)) - Number(visitado(a.id)));

  const grupos = [
    ...DIVISOES.map((divisao) => {
      const lista = porVisitar(
        estadiosNacionais.filter((estadio) => obterClube(estadio.clubeId)?.divisao === divisao)
      );
      return { id: divisao, titulo: nomesDivisao[divisao], lista };
    }),
    // Europa: os estádios onde as equipas portuguesas jogaram fora. Contam para o passaporte como os de cá.
    {
      id: 'europa',
      titulo: 'Europa',
      lista: porVisitar(estadios.filter((estadio) => estadio.regiao === 'estrangeiro')),
    },
  ]
    .filter((grupo) => grupo.lista.length > 0)
    .map((grupo) => ({
      ...grupo,
      visitados: grupo.lista.filter((estadio) => visitado(estadio.id)).length,
    }));

  const carimbadosNoLocal = verificados.length;

  const ultimaVisita = (estadioId: string) =>
    avaliacoes
      .filter((avaliacao) => avaliacao.estadioId === estadioId)
      .map((avaliacao) => avaliacao.dataVisita)
      .sort()
      .at(-1) ?? '';
  const recentes = estadiosNacionais
    .filter((estadio) => visitado(estadio.id))
    .sort((a, b) => ultimaVisita(b.id).localeCompare(ultimaVisita(a.id)))
    .slice(0, limite);

  const celula = (estadio: Venue) => (
    <CelulaCarimbo
      key={estadio.id}
      estadio={estadio}
      visitado={visitado(estadio.id)}
      novo={eNovo(estadio.id)}
      avaliacoes={avaliacoes}
    />
  );

  return (
    <Card style={styles.card}>
      <View style={styles.resumo}>
        <ThemedText type="score" themeColor="accent" style={styles.contagem}>
          {totalVisitados}
        </ThemedText>
        <View style={styles.resumoTexto}>
          <ThemedText type="section" style={styles.total}>
            {`de ${estadiosNacionais.length}`}
          </ThemedText>
          <ThemedText style={styles.legenda} themeColor="textSecondary">
            estádios visitados
          </ThemedText>
        </View>
      </View>
      <ProgressBar
        progress={estadiosNacionais.length > 0 ? totalVisitados / estadiosNacionais.length : 0}
        accessibilityLabel={`${totalVisitados} de ${estadiosNacionais.length} estádios visitados`}
      />
      {limite === undefined ? (
        <ThemedText type="small" themeColor="textSecondary">
          {carimbadosNoLocal > 0
            ? `${carimbadosNoLocal} ${carimbadosNoLocal === 1 ? 'carimbo confirmado' : 'carimbos confirmados'} no local. São esses que contam para o ranking. Os restantes ficaste tu a dizer que lá estiveste.`
            : 'Ainda não tens carimbos confirmados no local. Em dia de jogo, no estádio, a app confirma que lá estás, e esses são os que contam para o ranking.'}
        </ThemedText>
      ) : null}

      {limite !== undefined ? (
        recentes.length > 0 ? (
          <View style={[styles.carimbos, styles.grupo]}>{recentes.map(celula)}</View>
        ) : null
      ) : (
        grupos.map((grupo) => (
          <View key={grupo.id} style={styles.grupo}>
            <View style={styles.cabecalhoGrupo}>
              <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.flex}>
                {grupo.titulo}
              </ThemedText>
              <ThemedText style={styles.contagemGrupo}>
                {grupo.visitados} de {grupo.lista.length}
              </ThemedText>
            </View>
            <View style={styles.carimbos}>{grupo.lista.map(celula)}</View>
          </View>
        ))
      )}
    </Card>
  );
}

type CelulaCarimboProps = {
  estadio: Venue;
  visitado: boolean;
  novo: boolean;
  avaliacoes: readonly AvaliacaoVisita[];
};

function CelulaCarimbo({ estadio, visitado: foiVisitado, novo, avaliacoes }: CelulaCarimboProps) {
  const theme = useTheme();
  const dono = obterClube(estadio.clubeId);
  const nota = notaDoEstadio(avaliacoes, estadio.id);
  const tinta = corDaTinta(dono);
  const rotulo = nomeDoCarimbo(estadio.nome);
  const data = foiVisitado ? dataDoCarimbo(avaliacoes, estadio.id) : null;

  return (
    <Carimbo
      novo={novo}
      accessibilityLabel={[
        estadio.nome,
        foiVisitado ? 'visitado' : 'por visitar',
        novo ? 'carimbo novo' : null,
        nota ? `a tua nota: ${formatarNota(nota.media)} de 5` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={styles.celula}>
      {foiVisitado ? (
        <View
          style={[
            styles.carimbo,
            { borderColor: tinta, transform: [{ rotate: rotacaoDoCarimbo(estadio.id) }] },
          ]}>
          <View style={[styles.carimboInterior, { borderColor: tinta }]}>
            <ThemedText
              type="score"
              numberOfLines={1}
              adjustsFontSizeToFit
              allowFontScaling={false}
              style={[
                styles.carimboNome,
                {
                  color: tinta,
                  fontSize: tamanhoDoNome(rotulo),
                  lineHeight: tamanhoDoNome(rotulo) * 1.15,
                },
              ]}>
              {rotulo}
            </ThemedText>
            {data ? (
              <ThemedText allowFontScaling={false} style={[styles.carimboData, { color: tinta }]}>
                {data}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.carimbo,
            styles.porVisitar,
            { borderColor: theme.borderStrong, backgroundColor: theme.background },
          ]}>
          <Icon name={icons.estadio} size={26} color={theme.textMuted} />
        </View>
      )}
      {novo ? (
        <View style={[styles.novo, { backgroundColor: theme.highlight }]}>
          <ThemedText
            allowFontScaling={false}
            style={[styles.novoTexto, { color: theme.highlightText }]}>
            NOVO
          </ThemedText>
        </View>
      ) : null}
      <ThemedText
        numberOfLines={2}
        themeColor={foiVisitado ? 'text' : 'textMuted'}
        style={[styles.estadioNome, !foiVisitado && styles.estadioNomePorVisitar]}>
        {estadio.nome}
      </ThemedText>
      {nota ? (
        <View style={styles.nota}>
          <Icon name={icons.estrela} size={11} color={theme.warning} />
          <ThemedText style={[styles.notaTexto, { color: theme.warning }]}>
            {formatarNota(nota.media)}
          </ThemedText>
        </View>
      ) : null}
    </Carimbo>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    paddingVertical: 18,
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  contagem: {
    fontSize: 64,
    lineHeight: 68,
    marginBottom: -6,
  },
  resumoTexto: {
    paddingBottom: Spacing.one,
  },
  total: {
    lineHeight: 28,
  },
  legenda: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  flex: {
    flex: 1,
  },
  grupo: {
    gap: 14,
    paddingTop: Spacing.one,
  },
  cabecalhoGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  contagemGrupo: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
  },
  carimbos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  celula: {
    width: '33.33%',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  carimbo: {
    width: TAMANHO_CARIMBO,
    height: TAMANHO_CARIMBO,
    borderRadius: TAMANHO_CARIMBO / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carimboInterior: {
    width: TAMANHO_CARIMBO - 14,
    height: TAMANHO_CARIMBO - 14,
    borderRadius: (TAMANHO_CARIMBO - 14) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },
  carimboNome: {
    textAlign: 'center',
  },
  carimboData: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: 800,
    letterSpacing: 0.8,
  },
  porVisitar: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  novo: {
    position: 'absolute',
    top: -6,
    right: 2,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: Radius.pill,
    transform: [{ rotate: '8deg' }],
  },
  novoTexto: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 800,
    letterSpacing: 0.6,
  },
  estadioNome: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 700,
    textAlign: 'center',
  },
  estadioNomePorVisitar: {
    fontWeight: 600,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: -4,
  },
  notaTexto: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 800,
  },
});
