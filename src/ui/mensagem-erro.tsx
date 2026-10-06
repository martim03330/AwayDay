import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

/**
 * The error from the last attempt, in red under a form. It is read out when it appears: Android from the live
 * region, iOS (which has no live regions) by announcing it.
 */
export function MensagemErro({ children }: { children: string }) {
  const theme = useTheme();

  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(children);
  }, [children]);

  return (
    <ThemedText
      style={{ color: theme.dangerText }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      {children}
    </ThemedText>
  );
}
