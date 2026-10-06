import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Municipality } from '@/features/profile/types';
import { useTheme } from '@/hooks/use-theme';
import { Chip } from '@/ui/chip';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** The islands go after the mainland districts, as people expect to find them. */
const ILHAS = ['Açores', 'Madeira'];

function distritosDe(municipios: readonly Municipality[]) {
  const nomes = [...new Set(municipios.map((municipio) => municipio.district))];
  const continente = nomes.filter((nome) => !ILHAS.includes(nome)).sort((a, b) => a.localeCompare(b, 'pt'));
  return [...continente, ...ILHAS.filter((ilha) => nomes.includes(ilha))];
}

type EscolherConcelhoProps = {
  municipios: readonly Municipality[];
  /** The chosen concelho, or `null`. */
  valor: string | null;
  onChange: (municipioId: string) => void;
};

/**
 * Two taps: the district, then the concelho. With one already chosen it opens straight on its district, and the
 * district name on top goes back to the full list.
 */
export function EscolherConcelho({ municipios, valor, onChange }: EscolherConcelhoProps) {
  const theme = useTheme();
  const atual = municipios.find((municipio) => municipio.id === valor);
  const [distrito, setDistrito] = useState<string | null>(atual?.district ?? null);

  if (!distrito) {
    return (
      <View style={styles.bloco}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Primeiro o distrito
        </ThemedText>
        <View style={styles.chips}>
          {distritosDe(municipios).map((nome) => (
            <Chip
              key={nome}
              label={nome}
              selected={atual?.district === nome}
              emCartao
              onPress={() => setDistrito(nome)}
            />
          ))}
        </View>
      </View>
    );
  }

  const concelhos = municipios
    .filter((municipio) => municipio.district === distrito)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  return (
    <View style={styles.bloco}>
      <Pressable
        onPress={() => setDistrito(null)}
        accessibilityRole="button"
        accessibilityLabel={`${distrito}. Toca para escolher outro distrito.`}
        hitSlop={14}
        style={({ pressed }) => [styles.voltar, pressed && styles.premido]}>
        <Icon name={icons.voltar} size={16} color={theme.accentInk} strokeWidth={2.6} />
        <ThemedText type="smallBold" themeColor="accentInk">
          {distrito}
        </ThemedText>
      </Pressable>
      <View style={styles.chips}>
        {concelhos.map((municipio) => (
          <Chip
            key={municipio.id}
            label={municipio.name}
            selected={municipio.id === valor}
            emCartao
            onPress={() => onChange(municipio.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.twoAndHalf,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  voltar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
  },
  premido: {
    opacity: 0.6,
  },
});
