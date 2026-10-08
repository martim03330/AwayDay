import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { Clube } from '@/mocks/tipos';
import { Escudo } from '@/ui/escudo';
import { ThemedText } from '@/ui/themed-text';

type EquipaProps = {
  clube: Clube;
  size?: number;
  /** On the green pitch header: white name. */
  sobreRelvado?: boolean;
};

/**
 * The name's size by its length: a long one-word name («Moreirense», «Famalicão») steps down so it fits one line
 * without breaking mid-word. A fixed choice instead of `adjustsFontSizeToFit`, which on iOS measures the text inside
 * this flexible column too narrow and shrinks even «Benfica» to a few pixels.
 */
export function tamanhoDoNome(nome: string) {
  const letras = nome.trim().length;
  if (letras <= 8) return 24;
  if (letras <= 11) return 20;
  return 17;
}

/** A team with a big shield and its name underneath, for the fixture header. */
export function Equipa({ clube, size = 44, sobreRelvado = false }: EquipaProps) {
  const nome = clube.nomeCurto.trim();
  // A one-word name must never break mid-word; two words may take two lines.
  const umaPalavra = !/\s/.test(nome);
  const tamanho = tamanhoDoNome(umaPalavra ? nome : (nome.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? nome));
  return (
    <View style={styles.equipa}>
      <Escudo clube={clube} size={size} />
      <ThemedText
        type="section"
        style={[
          styles.nome,
          { fontSize: tamanho, lineHeight: tamanho + 2 },
          sobreRelvado && { color: Colors.accentText },
        ]}
        numberOfLines={umaPalavra ? 1 : 2}>
        {nome}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  equipa: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  nome: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
});
