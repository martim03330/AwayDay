import { StyleSheet, View } from 'react-native';

import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { clubesMaisPerto } from '@/lib/clubes';
import { formatarKm, formatarNumero } from '@/lib/formatos';
import { clubes, eClubeParaEscolher } from '@/mocks/clubes';
import { estadios } from '@/mocks/estadios';
import { localizacaoUtilizador } from '@/mocks/utilizador';
import { ThemedText } from '@/ui/themed-text';

const clubesDisponiveis = clubes.filter(eClubeParaEscolher);
const sugestoes = clubesMaisPerto(localizacaoUtilizador.coordenadas, clubesDisponiveis, estadios);
const idsSugeridos = new Set(sugestoes.map(({ clube }) => clube.id));
const outrosClubes = clubesDisponiveis
  .filter((clube) => !idsSugeridos.has(clube.id))
  .sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto, 'pt'));

/** Eyebrow above a group of clubs, with an optional note on the right. */
function CabecalhoGrupo({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.cabecalho} accessibilityRole="header">
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {title}
      </ThemedText>
      {trailing ? (
        <ThemedText themeColor="textMuted" style={styles.nota}>
          {trailing}
        </ThemedText>
      ) : null}
    </View>
  );
}

type ListaClubeDaTerraProps = {
  selecionadoId: string | null;
  onSelecionar: (clubeId: string) => void;
};

/** Sugestões pela localização simulada e restantes clubes. Nada vem pré-selecionado. */
export function ListaClubeDaTerra({ selecionadoId, onSelecionar }: ListaClubeDaTerraProps) {
  return (
    <View style={styles.lista}>
      <CabecalhoGrupo title="Perto de ti" trailing="Localização simulada" />
      {sugestoes.map(({ clube, km }) => (
        <OpcaoClube
          key={clube.id}
          clube={clube}
          detalhe={`Estádio a ${formatarKm(km)} · ${formatarNumero(clube.adeptosNaApp)} adeptos`}
          selecionado={clube.id === selecionadoId}
          onPress={() => onSelecionar(clube.id)}
        />
      ))}

      <View style={styles.separacao} />
      <CabecalhoGrupo title="Outros clubes" />
      {outrosClubes.map((clube) => (
        <OpcaoClube
          key={clube.id}
          clube={clube}
          detalhe={`${formatarNumero(clube.adeptosNaApp)} adeptos na app`}
          selecionado={clube.id === selecionadoId}
          onPress={() => onSelecionar(clube.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Spacing.two,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: 6,
    paddingBottom: Spacing.one,
  },
  nota: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    textAlign: 'right',
  },
  separacao: {
    height: Spacing.three,
  },
});
