import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FotoRecordacao } from '@/components/foto-recordacao';
import { Spacing } from '@/constants/theme';
import { useCarimbosNovos } from '@/hooks/use-carimbos-novos';
import { useTheme } from '@/hooks/use-theme';
import { useTirarFoto } from '@/hooks/use-tirar-foto';
import { podeTirarFoto, progressoDaMissao, type DadosMissoes } from '@/lib/missoes';
import { estadiosNacionais } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { obterLocal, obterPrato } from '@/mocks/locais';
import { missoes } from '@/mocks/missoes';
import { rivaisDe } from '@/mocks/rivais';
import type { EstadoMissao } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Carimbo } from '@/ui/carimbo';
import { Etiqueta, type TomEtiqueta } from '@/ui/etiqueta';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

const estados: Record<EstadoMissao, { label: string; tone: TomEtiqueta; icon: IconName }> = {
  'por-fazer': { label: 'Por fazer', tone: 'neutro', icon: icons.missao },
  'em-curso': { label: 'Em curso', tone: 'aviso', icon: icons.porVerificar },
  'por-comprovar': { label: 'Falta a foto', tone: 'aviso', icon: icons.camara },
  concluida: { label: 'Concluída', tone: 'positivo', icon: icons.selecionado },
};

export function MissoesCard() {
  const theme = useTheme();
  const router = useRouter();
  const app = useAppState();
  const tirarFoto = useTirarFoto();

  const rivais = rivaisDe(app.clubeFavoritoId);
  const idsNacionais = new Set(estadiosNacionais.map((estadio) => estadio.id));
  const dados: DadosMissoes = {
    estadiosVisitados: app.estadiosVisitados.filter((id) => idsNacionais.has(id)),
    notasTascos: app.notasTascos,
    pratosRecomendados: app.pratosRecomendados,
    avaliacoes: app.avaliacoes,
    visitasLocais: app.visitasLocais,
    missoesComFoto: new Set(app.fotosMissoes.map((foto) => foto.missaoId)),
    rivais,
    obterJogo,
    obterLocal,
    obterPrato,
  };

  const progressos = missoes.map((missao) => ({ missao, ...progressoDaMissao(missao, dados) }));
  const concluidas = progressos
    .filter(({ estado }) => estado === 'concluida')
    .map(({ missao }) => missao.id);
  const porComprovar = progressos.filter(({ estado }) => estado === 'por-comprovar').length;
  const eNovo = useCarimbosNovos(concluidas);

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText style={styles.contagem}>
          {concluidas.length} de {missoes.length}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {porComprovar > 0
            ? `missões concluídas · ${porComprovar} à espera de foto`
            : 'missões concluídas'}
        </ThemedText>
      </View>

      {progressos.map(({ missao, atual, meta, estado }) => {
        const info = estados[estado];
        const concluida = estado === 'concluida';
        const foto = app.fotosMissoes.find((candidata) => candidata.missaoId === missao.id);
        return (
          <View key={missao.id} style={[styles.missao, { borderTopColor: theme.border }]}>
            <Carimbo
              novo={eNovo(missao.id)}
              accessibilityLabel={`Distintivo ${missao.distintivo.nome}, ${concluida ? 'ganho' : 'por ganhar'}`}
              style={[
                styles.distintivo,
                { backgroundColor: concluida ? theme.successBackground : theme.backgroundSelected },
                !concluida && styles.bloqueado,
              ]}>
              <ThemedText style={styles.emoji}>{missao.distintivo.emoji}</ThemedText>
            </Carimbo>

            <View style={styles.corpo}>
              <ThemedText type="smallBold">{missao.titulo}</ThemedText>
              <View style={styles.etiquetas}>
                <Etiqueta icon={info.icon} label={info.label} tone={info.tone} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {missao.descricao}
              </ThemedText>
              {missao.progresso === 'check-in-com-rivais' && rivais.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  O teu clube ainda não tem rivais definidos na demo.
                </ThemedText>
              ) : null}
              {meta > 1 ? (
                <View style={styles.progresso}>
                  <View style={styles.flex}>
                    <ProgressBar
                      progress={atual / meta}
                      accessibilityLabel={`${missao.titulo}: ${atual} de ${meta}`}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {atual} de {meta}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {`Distintivo: ${missao.distintivo.nome}`}
              </ThemedText>

              {podeTirarFoto(missao, estado) ? (
                <View style={styles.prova}>
                  <View style={styles.dica}>
                    <Icon name={icons.camara} size={14} color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                      {`Prova: ${missao.dicaFoto}`}
                    </ThemedText>
                  </View>
                  <Button
                    label="Tirar foto"
                    icon={icons.camara}
                    variant={estado === 'por-comprovar' ? 'primary' : 'secondary'}
                    onPress={() => tirarFoto(missao)}
                  />
                </View>
              ) : null}

              {foto && concluida ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/perfil/foto', params: { fotoId: foto.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver a foto da missão no álbum, ${foto.verificada ? 'verificada' : 'por verificar'}`}
                  style={({ pressed }) => [
                    styles.foto,
                    { backgroundColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <FotoRecordacao foto={foto} compacta style={styles.miniatura} />
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">Ver no álbum</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {foto.verificada ? 'Foto verificada' : 'Foto por verificar'}
                    </ThemedText>
                  </View>
                  <Icon name={icons.seguinte} size={16} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary">
        Regra da casa: nenhuma missão pede para trocar objetos pessoais nem contacto físico. A prova é
        sempre uma foto tirada na hora, com a câmara.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  contagem: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  missao: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  distintivo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueado: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  corpo: {
    flex: 1,
    gap: Spacing.one,
  },
  etiquetas: {
    flexDirection: 'row',
  },
  progresso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  prova: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  dica: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  foto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
    padding: Spacing.two,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  miniatura: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  flex: {
    flex: 1,
  },
});
