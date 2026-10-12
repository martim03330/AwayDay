import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmarDono, metodoDeBloqueio, type MetodoDeBloqueio } from '@/lib/bloqueio-local';
import { useSession } from '@/lib/session';
import { useAppState } from '@/state/app-state';

/** Away for longer than this, the app asks again on return. Shorter trips (a quick message) do not. */
export const AUSENCIA_ATE_BLOQUEAR_MS = 60_000;

/**
 * The optional lock (Definições → Privacidade): over everything, on a cold start and when the app comes back after
 * more than a minute away. While the app is in the background it also covers the content, so the app switcher's
 * snapshot shows only the AwayDay mark. Never in demo mode, never signed out, and never when the phone has neither
 * biometrics nor a passcode (nobody gets locked out of their own app).
 */
export function BloqueioDaApp() {
  const { bloqueioAoAbrir, modoDemo } = useAppState();
  const sessao = useSession();
  const theme = useTheme();
  const ativo = bloqueioAoAbrir && !modoDemo && sessao.status !== 'signed-out';

  // A cold start with the lock on always asks; turning it on later does not lock right away.
  const [bloqueada, setBloqueada] = useState(bloqueioAoAbrir);
  /** The app is in the background (or the switcher): cover it without asking yet. */
  const [tapada, setTapada] = useState(false);
  const [metodo, setMetodo] = useState<MetodoDeBloqueio | null>(null);
  const [aConfirmar, setAConfirmar] = useState(false);
  const saidaEm = useRef<number | null>(null);
  // The system prompt itself sends the app to 'inactive': ignore those changes while it is up.
  const aConfirmarAgora = useRef(false);

  // Signed out: the next account starts unlocked (it has just typed its password).
  if (sessao.status === 'signed-out' && bloqueada) setBloqueada(false);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    void metodoDeBloqueio().then((encontrado) => {
      if (vivo) setMetodo(encontrado);
    });
    const subscricao = AppState.addEventListener('change', (estado) => {
      if (aConfirmarAgora.current) return;
      if (estado === 'inactive' || estado === 'background') {
        saidaEm.current ??= Date.now();
        setTapada(true);
        return;
      }
      if (estado !== 'active') return;
      const saida = saidaEm.current;
      saidaEm.current = null;
      if (saida !== null && Date.now() - saida > AUSENCIA_ATE_BLOQUEAR_MS) setBloqueada(true);
      setTapada(false);
      // The person may have removed Face ID or the passcode meanwhile.
      void metodoDeBloqueio().then((encontrado) => {
        if (vivo) setMetodo(encontrado);
      });
    });
    return () => {
      vivo = false;
      subscricao.remove();
    };
  }, [ativo]);

  const podeBloquear = ativo && metodo?.disponivel !== false;
  const visivel = podeBloquear && (bloqueada || tapada);
  const pedirAgora = podeBloquear && bloqueada && !tapada;

  async function desbloquear() {
    if (aConfirmarAgora.current) return;
    aConfirmarAgora.current = true;
    setAConfirmar(true);
    const confirmado = await confirmarDono('Desbloquear o AwayDay');
    aConfirmarAgora.current = false;
    setAConfirmar(false);
    if (confirmado) {
      setBloqueada(false);
      setTapada(false);
    }
  }

  const pedirSozinho = useEffectEvent(() => void desbloquear());

  // Ask straight away when the lock appears with the app in front; the button is there to try again.
  useEffect(() => {
    if (!pedirAgora) return;
    const espera = setTimeout(pedirSozinho, 250);
    return () => clearTimeout(espera);
  }, [pedirAgora]);

  if (!visivel) return null;

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      // Android's back button must not dismiss the lock.
      onRequestClose={() => undefined}>
      <View style={[styles.ecra, { backgroundColor: theme.accent }]} testID="bloqueio-da-app">
        <Text
          accessibilityRole="header"
          style={[styles.marca, { color: theme.accentText }]}>
          AwayDay
        </Text>
        {bloqueada ? (
          <>
            <Text style={[styles.texto, { color: theme.accentText }]}>
              {metodo?.disponivel ? `O AwayDay está bloqueado. Entra com ${metodo.nome}.` : 'O AwayDay está bloqueado.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Desbloquear"
              accessibilityState={{ disabled: aConfirmar }}
              disabled={aConfirmar}
              onPress={() => void desbloquear()}
              style={({ pressed }) => [
                styles.botao,
                { backgroundColor: theme.accentText, opacity: pressed || aConfirmar ? 0.75 : 1 },
              ]}>
              <Text style={[styles.botaoTexto, { color: theme.accent }]}>Desbloquear</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  marca: {
    fontFamily: fontFamily('display', 900),
    fontSize: 48,
    letterSpacing: 0.5,
  },
  texto: {
    fontFamily: fontFamily('body', 600),
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  botao: {
    marginTop: Spacing.two,
    minWidth: 200,
    alignItems: 'center',
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  botaoTexto: {
    fontFamily: fontFamily('body', 800),
    fontSize: 17,
  },
});
