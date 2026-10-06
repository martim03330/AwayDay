import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors as colors } from '@/constants/theme';
import { useAppState } from '@/state/app-state';
import { ThemedText } from '@/ui/themed-text';

/**
 * Always on screen while demo mode is on, so sample fans, tascos and numbers are never taken for real ones. It sits
 * just above the tab bar: at the top it covered the screen titles.
 */
function EtiquetaDemo() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={[styles.demo, { bottom: insets.bottom + 92 }]}
      accessible
      accessibilityLabel="Modo demo ligado: estás a ver dados de exemplo">
      <ThemedText style={styles.demoTexto}>Modo demo · dados de exemplo</ThemedText>
    </View>
  );
}

export default function TabsLayout() {
  const { modoDemo } = useAppState();
  return (
    <View style={styles.flex}>
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.successBackground}
        labelStyle={{ selected: { color: colors.accentInk } }}>
        <NativeTabs.Trigger name="index" hidden />

        <NativeTabs.Trigger name="jogos">
          <NativeTabs.Trigger.Label>Jogos</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="soccerball" md="sports_soccer" selectedColor={colors.accent} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="malta">
          <NativeTabs.Trigger.Label>Malta</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.3" md="groups" selectedColor={colors.accent} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="locais">
          <NativeTabs.Trigger.Label>Locais</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="mappin.and.ellipse"
            md="location_on"
            selectedColor={colors.accent}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="ranking">
          <NativeTabs.Trigger.Label>Ranking</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="trophy" md="emoji_events" selectedColor={colors.accent} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="perfil">
          <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="person.crop.circle"
            md="account_circle"
            selectedColor={colors.accent}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
      {modoDemo ? <EtiquetaDemo /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  demo: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.highlight,
  },
  demoTexto: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
    color: colors.highlightText,
  },
});
