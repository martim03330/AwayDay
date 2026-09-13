import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type ContadorPessoasProps = {
  count: number;
  large?: boolean;
};

export function ContadorPessoas({ count, large = false }: ContadorPessoasProps) {
  const theme = useTheme();
  const label = count === 1 ? 'pessoa aqui' : 'pessoas aqui';

  return (
    <View style={styles.row} accessible accessibilityLabel={`${count} ${label}`}>
      <View style={[styles.dot, { backgroundColor: theme.success }]} />
      <ThemedText type={large ? 'default' : 'small'} themeColor="textSecondary">
        <ThemedText type={large ? 'default' : 'smallBold'} style={large && styles.largeCount}>
          {count}
        </ThemedText>{' '}
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  largeCount: {
    fontSize: 20,
    fontWeight: 700,
  },
});
