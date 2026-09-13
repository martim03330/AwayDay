import { StyleSheet, View } from 'react-native';

import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { clubesMaisPerto } from '@/lib/clubes';
import { formatarKm, formatarNumero } from '@/lib/formatos';
import { clubes } from '@/mocks/clubes';
import { estadios } from '@/mocks/estadios';
import { localizacaoUtilizador } from '@/mocks/utilizador';
import { SectionHeader } from '@/ui/section-header';

const sugestoes = clubesMaisPerto(localizacaoUtilizador.coordenadas, clubes, estadios);
const idsSugeridos = new Set(sugestoes.map(({ clube }) => clube.id));
const outrosClubes = clubes
  .filter((clube) => clube.divisao !== null && !idsSugeridos.has(clube.id))
  .sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto, 'pt'));

type ListaClubeDaTerraProps = {
  selecionadoId: string | null;
  onSelecionar: (clubeId: string) => void;
};

/** Sugestões pela localização simulada e restantes clubes. Nada vem pré-selecionado. */
export function ListaClubeDaTerra({ selecionadoId, onSelecionar }: ListaClubeDaTerraProps) {
  return (
    <View style={styles.lista}>
      <SectionHeader title="Perto de ti" trailing="Localização simulada" />
      {sugestoes.map(({ clube, km }) => (
        <OpcaoClube
          key={clube.id}
          clube={clube}
          detalhe={`Estádio a ${formatarKm(km)} · ${formatarNumero(clube.adeptosNaApp)} adeptos`}
          selecionado={clube.id === selecionadoId}
          onPress={() => onSelecionar(clube.id)}
        />
      ))}

      <SectionHeader title="Outros clubes" />
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
});
