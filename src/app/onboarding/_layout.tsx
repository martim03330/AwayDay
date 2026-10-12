import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS }} />;
}
