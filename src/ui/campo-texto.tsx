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
      {/* The input already says its label: read once, not twice. */}
      <ThemedText style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.accent}
        accessibilityLabel={label}
        accessibilityHint={`Até ${maxLength} caracteres.`}
        autoCapitalize="sentences"
        multiline
        textAlignVertical="top"
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          focado && [
            styles.focado,
            { borderColor: theme.accent, boxShadow: `0 0 0 4px ${theme.successBackground}` },
          ],
        ]}
      />
      <ThemedText
        style={styles.contador}
        themeColor="textMuted"
        accessibilityLabel={`${value.length} de ${maxLength} caracteres`}>
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
  },
  contador: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
});
