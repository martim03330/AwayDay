import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { fontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type CampoTextoProps = {
  label: string;
  value: string;
  onChangeText: (texto: string) => void;
  maxLength: number;
  placeholder?: string;
};

export function CampoTexto({ label, value, onChangeText, maxLength, placeholder }: CampoTextoProps) {
  const theme = useTheme();
  const [focado, setFocado] = useState(false);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.accent}
        accessibilityLabel={label}
        multiline
        textAlignVertical="top"
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          focado && [styles.focado, { borderColor: theme.accent }],
        ]}
      />
      <ThemedText style={styles.contador} themeColor="textMuted">
        {value.length}/{maxLength}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  input: {
    minHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fontFamily('body', 500),
  },
  focado: {
    borderWidth: 2,
    boxShadow: '0 0 0 4px #DDF2E3',
  },
  contador: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
});
