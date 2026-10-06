import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { authErrorMessage } from '@/features/auth/errors';
import { useSignOut } from '@/features/auth/hooks/useAuthActions';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

type AccountCardProps = {
  /** From the profile; `null` while it loads. */
  displayName: string | null;
};

function Cabecalho({ title, subtitle, muted = false }: { title: string; subtitle?: string; muted?: boolean }) {
  return (
    <View style={styles.cabecalho}>
      <IconCircle name={icons.perfil} tone={muted ? 'neutral' : 'green'} />
      <View style={styles.flex}>
        <ThemedText type="section" style={styles.titulo} accessibilityRole="header">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={styles.subtitulo} themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/** Account block on the profile tab: invite to sign in, or who is signed in with sign-out and delete. */
export function AccountCard({ displayName }: AccountCardProps) {
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();

  if (session.status === 'loading') {
    return (
      <Card>
        <Cabecalho title="A ver se tens sessão…" muted />
      </Card>
    );
  }

  if (session.status === 'signed-out') {
    return (
      <Card style={styles.card}>
        <Cabecalho
          title="Guarda o teu progresso"
          subtitle="Com conta, os teus clubes ficam guardados e vêm contigo para outro telemóvel."
        />
        <View style={styles.botoes}>
          <View style={styles.flex}>
            <Button label="Criar conta" onPress={() => router.push('/conta/criar-conta')} />
          </View>
          <View style={styles.flex}>
            <Button label="Entrar" variant="secondary" onPress={() => router.push('/conta/entrar')} />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Cabecalho title={displayName ?? 'A tua conta'} subtitle={session.session.user.email} />
      <Button
        label={signOut.isPending ? 'A terminar sessão…' : 'Terminar sessão'}
        variant="secondary"
        disabled={signOut.isPending}
        onPress={() =>
          signOut.mutate(undefined, {
            onError: (error) => Alert.alert('Não deu para sair', authErrorMessage(error)),
          })
        }
      />
      {/* Deleting asks for the password again, on its own screen. */}
      <LinkTexto
        label="Apagar conta"
        onPress={() => router.push('/conta/apagar-conta')}
        disabled={signOut.isPending}
        perigo
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  titulo: {
    fontSize: 24,
    lineHeight: 27,
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
