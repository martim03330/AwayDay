import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Colors as colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
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

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="person.crop.circle"
          md="account_circle"
          selectedColor={colors.accent}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
