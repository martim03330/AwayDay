import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type AvisoProps = {
  title: string;
  message: string;
};

export function Aviso({ title, message }: AvisoProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
      style={[
        styles.aviso,
        { backgroundColor: theme.warningBackground, borderColor: theme.warning },
      ]}>
      <Icon name={icons.aviso} size={22} color={theme.warning} />
      <View style={styles.corpo}>
        <ThemedText type="smallBold" style={{ color: theme.warning }}>
          {title}
        </ThemedText>
        <ThemedText type="small">{message}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
});
