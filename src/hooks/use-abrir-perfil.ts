import { useRouter } from 'expo-router';

/**
 * Opens someone's public profile. Wherever a person shows up (a ride, a group, a plan, a trip), tapping them opens it
 * (testers' feedback). The server decides what can be seen: only people you share something with.
 */
export function useAbrirPerfil() {
  const router = useRouter();
  return (profileId: string) => router.push({ pathname: '/pessoa/[pessoaId]', params: { pessoaId: profileId } });
}
