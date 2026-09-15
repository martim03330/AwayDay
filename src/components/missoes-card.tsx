import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FotoRecordacao } from '@/components/foto-recordacao';
import { Radius, Spacing } from '@/constants/theme';
import { useCarimbosNovos } from '@/hooks/use-carimbos-novos';
import { useTheme } from '@/hooks/use-theme';
import { useTirarFoto } from '@/hooks/use-tirar-foto';
import { useMyApprovedPhotoCount } from '@/features/places/hooks/useFanPhotos';
import { podeTirarFoto, progressoDaMissao, type DadosMissoes } from '@/lib/missoes';
import { useUserId } from '@/lib/session';
import { estadiosNacionais } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { obterLocal, obterPrato } from '@/mocks/locais';
import { missoes } from '@/mocks/missoes';
import { rivaisDe } from '@/mocks/rivais';
import type { EstadoMissao, Missao } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Carimbo } from '@/ui/carimbo';
import { Etiqueta, type TomEtiqueta } from '@/ui/etiqueta';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Missions shown on the profile before "Ver as N missões". */
const MISSOES_NO_PERFIL = 2;

const estados: Record<EstadoMissao, { label: string; tone: TomEtiqueta; icon?: IconName }> = {
  'por-fazer': { label: 'Por fazer', tone: 'neutro' },
  'em-curso': { label: 'Em curso', tone: 'aviso' },
  'por-comprovar': { label: 'Falta a foto', tone: 'destaque', icon: icons.camara },
  concluida: { label: 'Concluída', tone: 'positivo', icon: icons.checkInFeito },
};

type ProgressoComMissao = { missao: Missao; atual: number; meta: number; estado: EstadoMissao };

/** Progress of every mission, from the app state. Shared by the profile summary and the missions screen. */
function useMissoes() {
  const app = useAppState();
  const userId = useUserId();
  const fotosAprovadas = useMyApprovedPhotoCount(app.modoDemo ? null : userId);

  const rivais = rivaisDe(app.clubeFavoritoId);
  const idsNacionais = new Set(estadiosNacionais.map((estadio) => estadio.id));
  const dados: DadosMissoes = {
    estadiosVisitados: app.estadiosVisitados.filter((id) => idsNacionais.has(id)),
    notasTascos: app.notasTascos,
    pratosRecomendados: app.pratosRecomendados,
    avaliacoes: app.avaliacoes,
    visitasLocais: app.visitasLocais,
    missoesComFoto: new Set(app.fotosMissoes.map((foto) => foto.missaoId)),
    fotosTascoAprovadas: fotosAprovadas.data ?? 0,
    rivais,
    obterJogo,
    obterLocal,
    obterPrato,
  };

  const progressos: ProgressoComMissao[] = missoes.map((missao) => ({
    missao,
    ...progressoDaMissao(missao, dados),
  }));
  const concluidas = progressos
    .filter(({ estado }) => estado === 'concluida')
    .map(({ missao }) => missao.id);
  const porComprovar = progressos.filter(({ estado }) => estado === 'por-comprovar').length;

  return { fotosMissoes: app.fotosMissoes, rivais, progressos, concluidas, porComprovar };
}

/** Badge tile colours: green when earned, yellow while on the way, grey before starting. */
function useCoresDoAzulejo(estado: EstadoMissao) {
  const theme = useTheme();
  if (estado === 'concluida') return { fundo: theme.accent, tinta: theme.accentText };
  if (estado === 'por-fazer') return { fundo: theme.backgroundSelected, tinta: theme.textMuted };
  return { fundo: theme.warningBackground, tinta: theme.warning };
}

function Azulejo({
  missao,
  estado,
  novo,
  tamanho,
}: {
  missao: Missao;
  estado: EstadoMissao;
  novo: boolean;
  tamanho: number;
}) {
  const cores = useCoresDoAzulejo(estado);
  return (
    <Carimbo
      novo={novo}
      accessibilityLabel={`Distintivo ${missao.distintivo.nome}, ${estado === 'concluida' ? 'ganho' : 'por ganhar'}`}
      style={[
        styles.azulejo,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho * 0.3,
          backgroundColor: cores.fundo,
        },
      ]}>
      <Icon name={missao.distintivo.icon} size={tamanho / 2} color={cores.tinta} />
    </Carimbo>
  );
}

/** Progress track; yellow until the mission is done. */
function Barra({
  atual,
  meta,
  concluida,
  altura,
  accessibilityLabel,
}: {
  atual: number;
  meta: number;
  concluida: boolean;
  altura: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const progresso = meta > 0 ? Math.min(1, Math.max(0, atual / meta)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progresso * 100) }}
      style={[
        styles.barra,
        { height: altura, borderRadius: altura / 2, backgroundColor: theme.backgroundSelected },
      ]}>
      <View
        style={{
          width: `${progresso * 100}%`,
          height: '100%',
          borderRadius: altura / 2,
          backgroundColor: concluida ? theme.accent : theme.highlight,
        }}
      />
    </View>
  );
}

/** "2 de 6" with one segment per mission: done in green, waiting for the photo in yellow. */
function ResumoMissoes({
  concluidas,
  porComprovar,
  noEcra,
}: {
  concluidas: number;
  porComprovar: number;
  noEcra: boolean;
}) {
  const theme = useTheme();
  const total = missoes.length;
  const legenda = noEcra ? 'concluídas' : 'missões concluídas';
  return (
    <View
      accessible
      accessibilityLabel={`${concluidas} de ${total} missões concluídas${porComprovar > 0 ? `, ${porComprovar} à espera de foto` : ''}`}
      style={styles.resumo}>
      <View style={styles.resumoLinha}>
        <ThemedText
          type="score"
          themeColor={noEcra ? 'accent' : 'text'}
          style={styles.resumoContagem}>
          {`${concluidas} de ${total}`}
        </ThemedText>
        <ThemedText
          themeColor="textSecondary"
          style={[styles.resumoLegenda, noEcra && styles.resumoLegendaEcra]}>
          {porComprovar > 0 ? `${legenda} · ${porComprovar} à espera de foto` : legenda}
        </ThemedText>
      </View>
      <View style={styles.segmentos}>
        {missoes.map((missao, indice) => (
          <View
            key={missao.id}
            style={[
              styles.segmento,
              noEcra && styles.segmentoEcra,
              {
                backgroundColor:
                  indice < concluidas
                    ? theme.accent
                    : indice < concluidas + porComprovar
                      ? theme.highlight
                      : theme.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** Compact mission row on the profile. */
function LinhaMissao({ progresso, novo }: { progresso: ProgressoComMissao; novo: boolean }) {
  const theme = useTheme();
  const { missao, atual, meta, estado } = progresso;
  const info = estados[estado];
  const mostrarBarra = meta > 1 && estado === 'em-curso';
  const corEstado =
    estado === 'concluida'
      ? theme.success
      : estado === 'por-fazer'
        ? theme.textSecondary
        : theme.warning;

  return (
    <View style={[styles.linhaMissao, { backgroundColor: theme.background }]}>
      <Azulejo missao={missao} estado={estado} novo={novo} tamanho={44} />
      <View style={styles.linhaCorpo}>
        <View style={styles.linhaTopo}>
          <ThemedText style={styles.linhaTitulo}>{missao.titulo}</ThemedText>
          {mostrarBarra ? (
            <ThemedText style={[styles.linhaContagem, { color: theme.warning }]}>
              {atual} de {meta}
            </ThemedText>
          ) : null}
        </View>
        {mostrarBarra ? (
          <Barra
            atual={atual}
            meta={meta}
            concluida={false}
            altura={6}
            accessibilityLabel={`${missao.titulo}: ${atual} de ${meta}`}
          />
        ) : (
          <View style={styles.linhaEstado}>
            {info.icon ? <Icon name={info.icon} size={14} color={corEstado} /> : null}
            <ThemedText style={[styles.linhaContagem, { color: corEstado }]}>
              {info.label}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

/** Profile summary: count, the next missions and a way into the full list. */
export function MissoesCard() {
  const theme = useTheme();
  const router = useRouter();
  const { progressos, concluidas, porComprovar } = useMissoes();
  const eNovo = useCarimbosNovos(concluidas);

  const mostradas = [
    ...progressos.filter(({ estado }) => estado !== 'concluida'),
    ...progressos.filter(({ estado }) => estado === 'concluida'),
  ].slice(0, MISSOES_NO_PERFIL);
  const verTodas = `Ver as ${missoes.length} missões`;

  return (
    <Card style={styles.cartao}>
      <ResumoMissoes concluidas={concluidas.length} porComprovar={porComprovar} noEcra={false} />
      {mostradas.map((progresso) => (
        <LinhaMissao
          key={progresso.missao.id}
          progresso={progresso}
          novo={eNovo(progresso.missao.id)}
        />
      ))}
      <Pressable
        onPress={() => router.push('/perfil/missoes')}
        accessibilityRole="button"
        accessibilityLabel={verTodas}
        style={({ pressed }) => [
          styles.verTodas,
          { borderColor: theme.border },
          pressed && { backgroundColor: theme.backgroundSelected },
        ]}>
        <ThemedText style={[styles.verTodasTexto, { color: theme.accentInk }]}>
          {verTodas}
        </ThemedText>
        <Icon name={icons.seguinte} size={16} color={theme.accentInk} />
      </Pressable>
    </Card>
  );
}

/** Full mission card on the missions screen. */
function CartaoMissao({
  progresso,
  novo,
  rivais,
  fotosMissoes,
}: {
  progresso: ProgressoComMissao;
  novo: boolean;
  rivais: readonly string[];
  fotosMissoes: ReturnType<typeof useMissoes>['fotosMissoes'];
}) {
  const theme = useTheme();
  const router = useRouter();
  const tirarFoto = useTirarFoto();
  const { missao, atual, meta, estado } = progresso;
  const info = estados[estado];
  const concluida = estado === 'concluida';
  const foto = fotosMissoes.find((candidata) => candidata.missaoId === missao.id);
  const comFoto = foto !== undefined && concluida;

  return (
    <Card
      style={[
        styles.cartao,
        estado === 'por-comprovar' && { borderWidth: 2, borderColor: theme.highlight },
      ]}>
      <View style={styles.cabecalho}>
        <Azulejo missao={missao} estado={estado} novo={novo} tamanho={52} />
        <View style={styles.corpo}>
          <View style={styles.etiquetas}>
            <Etiqueta icon={info.icon} label={info.label} tone={info.tone} />
          </View>
          <ThemedText style={styles.titulo}>{missao.titulo}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {missao.descricao}
          </ThemedText>
          {missao.progresso === 'check-in-com-rivais' && rivais.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              O teu clube ainda não tem rivais definidos na demo.
            </ThemedText>
          ) : null}
        </View>
      </View>

      {meta > 1 ? (
        <View style={styles.progresso}>
          <Barra
            atual={atual}
            meta={meta}
            concluida={concluida}
            altura={10}
            accessibilityLabel={`${missao.titulo}: ${atual} de ${meta}`}
          />
          <ThemedText style={styles.progressoTexto}>
            {atual} de {meta}
          </ThemedText>
        </View>
      ) : null}

      {comFoto ? null : (
        <ThemedText themeColor="textSecondary" style={styles.distintivo}>
          {`Distintivo: ${missao.distintivo.nome}`}
        </ThemedText>
      )}

      {podeTirarFoto(missao, estado) ? (
        <>
          <View style={[styles.dica, { borderColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.dicaTexto}>
              <ThemedText style={[styles.dicaTexto, styles.dicaRotulo]}>Prova: </ThemedText>
              {missao.dicaFoto}
            </ThemedText>
          </View>
          <Button
            label="Tirar foto"
            icon={icons.camara}
            variant={estado === 'por-comprovar' ? 'highlight' : 'secondary'}
            onPress={() => tirarFoto(missao)}
          />
        </>
      ) : null}

      {comFoto ? (
        <Pressable
          onPress={() => router.push({ pathname: '/perfil/foto', params: { fotoId: foto.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Ver a foto da missão no álbum, ${foto.verificada ? 'verificada' : 'por verificar'}`}
          style={({ pressed }) => [
            styles.foto,
            { backgroundColor: theme.background },
            pressed && styles.pressed,
          ]}>
          <FotoRecordacao foto={foto} compacta style={styles.miniatura} />
          <View style={styles.flex}>
            <ThemedText style={styles.fotoTitulo}>Ver no álbum</ThemedText>
            <ThemedText
              style={[
                styles.fotoEstado,
                { color: foto.verificada ? theme.accentInk : theme.warning },
              ]}>
              {`Distintivo: ${missao.distintivo.nome} · ${foto.verificada ? 'Foto verificada' : 'Foto por verificar'}`}
            </ThemedText>
          </View>
          <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
        </Pressable>
      ) : null}
    </Card>
  );
}

/** Missions screen body: the summary and every mission card. */
export function ListaMissoes() {
  const { fotosMissoes, rivais, progressos, concluidas, porComprovar } = useMissoes();
  const eNovo = useCarimbosNovos(concluidas);

  return (
    <View style={styles.lista}>
      <ResumoMissoes concluidas={concluidas.length} porComprovar={porComprovar} noEcra />
      {progressos.map((progresso) => (
        <CartaoMissao
          key={progresso.missao.id}
          progresso={progresso}
          novo={eNovo(progresso.missao.id)}
          rivais={rivais}
          fotosMissoes={fotosMissoes}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: 12,
  },
  lista: {
    gap: 14,
  },
  azulejo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  barra: {
    flex: 1,
    overflow: 'hidden',
  },
  resumo: {
    gap: Spacing.two,
  },
  resumoLinha: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.two,
  },
  resumoContagem: {
    fontSize: 30,
    lineHeight: 34,
  },
  resumoLegenda: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  resumoLegendaEcra: {
    fontSize: 14,
    lineHeight: 20,
  },
  segmentos: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  segmento: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  segmentoEcra: {
    height: 10,
    borderRadius: 5,
  },
  linhaMissao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
  },
  linhaCorpo: {
    flex: 1,
    gap: 6,
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  linhaTitulo: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 800,
  },
  linhaEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  linhaContagem: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  verTodas: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  verTodasTexto: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  corpo: {
    flex: 1,
    gap: 5,
  },
  etiquetas: {
    flexDirection: 'row',
  },
  titulo: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  progresso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressoTexto: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
  },
  distintivo: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
  dica: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  dicaTexto: {
    fontSize: 13,
    lineHeight: 18,
  },
  dicaRotulo: {
    fontWeight: 800,
  },
  foto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  miniatura: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  fotoTitulo: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 800,
  },
  fotoEstado: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
  flex: {
    flex: 1,
  },
});
