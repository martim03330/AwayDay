import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApresentacaoGuiada } from '@/components/apresentacao-guiada';
import { Colors as colors } from '@/constants/theme';
import { BUILD_DE_CAPTURAS } from '@/lib/capturas';
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
  const { modoDemo, apresentacaoVista, marcarApresentacaoVista } = useAppState();
  // The first time in (right after the introduction), the tour of the tabs on top of them. Never in demo mode or
  // screenshots.
  const mostrarApresentacao = !apresentacaoVista && !modoDemo && !BUILD_DE_CAPTURAS;
  return (
    <View style={styles.flex}>
      {/* The bar keeps its colour at the end of a page too (iOS makes it transparent there by default, which
          testers took for a bug). `disableAutomaticContentInsets`: every tab draws its own header under the status
          bar; with iOS's automatic inset on top the status bar height counted twice (an empty green band). */}
      <NativeTabs
        disableTransparentOnScrollEdge
        backgroundColor={colors.background}
        indicatorColor={colors.successBackground}
        labelStyle={{ selected: { color: colors.accentInk } }}>
        <NativeTabs.Trigger name="index" hidden />

        <NativeTabs.Trigger name="jogos" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Jogos</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="soccerball" md="sports_soccer" selectedColor={colors.accent} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="malta" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Malta</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.3" md="groups" selectedColor={colors.accent} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="locais" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Locais</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="mappin.and.ellipse"
            md="location_on"
            selectedColor={colors.accent}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="ranking" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Ranking</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="trophy" md="emoji_events" selectedColor={colors.accent} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="perfil" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="person.crop.circle"
            md="account_circle"
            selectedColor={colors.accent}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
      {modoDemo && !BUILD_DE_CAPTURAS ? <EtiquetaDemo /> : null}
      {mostrarApresentacao ? <ApresentacaoGuiada onFim={marcarApresentacaoVista} /> : null}
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
