import { StyleSheet, Text, View } from 'react-native';

import type { Clube } from '@/mocks/tipos';

type EscudoProps = {
  clube: Clube;
  size?: number;
};

/** Escudo genérico com as cores e a sigla do clube (não usa os escudos oficiais). */
export function Escudo({ clube, size = 40 }: EscudoProps) {
  const { primaria, secundaria } = clube.cores;

  return (
    <View
      accessible
      accessibilityLabel={`Escudo do ${clube.nomeCurto}`}
      style={[
        styles.escudo,
        {
          width: size,
          height: size * 1.15,
          backgroundColor: primaria,
          borderColor: secundaria,
          borderWidth: Math.max(2, size * 0.06),
          borderTopLeftRadius: size * 0.18,
          borderTopRightRadius: size * 0.18,
          borderBottomLeftRadius: size * 0.55,
          borderBottomRightRadius: size * 0.55,
        },
      ]}>
      <Text allowFontScaling={false} style={[styles.sigla, { color: secundaria, fontSize: size * 0.28 }]}>
        {clube.sigla}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  escudo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigla: {
    fontWeight: 800,
    letterSpacing: 0.5,
  },
});
