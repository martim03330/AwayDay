/**
 * The phone's own lock (Face ID, Touch ID, fingerprint or passcode), used to lock the app when it opens.
 * Nothing leaves the phone: the system only answers «it's the owner» or not.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type MetodoDeBloqueio = { disponivel: true; nome: string } | { disponivel: false };

/** What this phone can lock with, named the way the person knows it. Neither biometrics nor a passcode: none. */
export async function metodoDeBloqueio(): Promise<MetodoDeBloqueio> {
  try {
    const [hardware, registado] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (hardware && registado) {
      const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const ios = Platform.OS === 'ios';
      if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return { disponivel: true, nome: ios ? 'Face ID' : 'reconhecimento facial' };
      }
      if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return { disponivel: true, nome: ios ? 'Touch ID' : 'impressão digital' };
      }
      if (tipos.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return { disponivel: true, nome: 'íris' };
      }
    }
    // Biometrics off or missing: the passcode still locks, as long as the phone has one.
    const nivel = await LocalAuthentication.getEnrolledLevelAsync();
    return nivel >= LocalAuthentication.SecurityLevel.SECRET
      ? { disponivel: true, nome: 'código do telemóvel' }
      : { disponivel: false };
  } catch {
    return { disponivel: false };
  }
}

/** Asks the phone to confirm it is the owner. The passcode is always accepted when biometrics fail. */
export async function confirmarDono(motivo: string): Promise<boolean> {
  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar código',
      disableDeviceFallback: false,
    });
    return resultado.success;
  } catch {
    return false;
  }
}
