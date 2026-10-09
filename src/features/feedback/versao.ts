import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';

/**
 * The app version as people and stores see it, plus the native build number.
 *
 * `Constants.expoConfig.version` is always the marketing version (1.0.0): build numbers are managed remotely by EAS
 * (`appVersionSource: remote`), so app.json never has them. The real build number lives in the binary:
 * - iOS: `Constants.platform.ios.buildNumber` is CFBundleVersion from Info.plist (null in Expo Go).
 * - Android: expo-constants no longer exposes versionCode, but the ExpoApplication native module is always linked
 *   (expo-notifications depends on it), so we read it optionally — no new dependency, null when it is missing.
 */
type ApplicationModule = {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
};

function applicationModule(): ApplicationModule | null {
  try {
    return requireOptionalNativeModule<ApplicationModule>('ExpoApplication');
  } catch {
    return null;
  }
}

export function appVersion(): string | null {
  const nativa = applicationModule()?.nativeApplicationVersion;
  if (typeof nativa === 'string' && nativa.length > 0) return nativa;
  const versao = Constants.expoConfig?.version;
  return typeof versao === 'string' ? versao : null;
}

export function appBuildNumber(): string | null {
  const ios: unknown = Constants.platform?.ios?.buildNumber;
  if (typeof ios === 'string' && ios.length > 0) return ios;
  const nativa = applicationModule()?.nativeBuildVersion;
  return typeof nativa === 'string' && nativa.length > 0 ? nativa : null;
}

/** «1.0.0 (42)» for feedback rows; «1.0.0» when there is no build (Expo Go, web). Max 40 chars (DB column). */
export function versionForFeedback(): string | undefined {
  const versao = appVersion();
  if (!versao) return undefined;
  const build = appBuildNumber();
  return (build ? `${versao} (${build})` : versao).slice(0, 40);
}

/** «Versão 1.0.0 (build 42)», for Definições. */
export function versionLabel(): string | null {
  const versao = appVersion();
  if (!versao) return null;
  const build = appBuildNumber();
  return build ? `Versão ${versao} (build ${build})` : `Versão ${versao}`;
}
