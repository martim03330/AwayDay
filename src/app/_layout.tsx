import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AppStateProvider } from '@/state/app-state';
import { SonsProvider } from '@/state/sons';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <SonsProvider>
          <NativeTabs
            backgroundColor={colors.background}
            indicatorColor={colors.backgroundElement}
            labelStyle={{ selected: { color: colors.text } }}>
            <NativeTabs.Trigger name="index" hidden />

            <NativeTabs.Trigger name="jogos">
              <NativeTabs.Trigger.Label>Jogos</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon sf="soccerball" md="sports_soccer" selectedColor={colors.accent} />
            </NativeTabs.Trigger>

            <NativeTabs.Trigger name="locais">
              <NativeTabs.Trigger.Label>Locais</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon
                sf="mappin.and.ellipse"
                md="location_on"
                selectedColor={colors.accent}
              />
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
        </SonsProvider>
      </AppStateProvider>
    </ThemeProvider>
  );
}
