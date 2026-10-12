import * as Haptics from 'expo-haptics';

// Every haptic in the app goes through here. A haptic is a nicety: it must never fail the action it goes with, so each
// call swallows both a rejected promise and a synchronous throw (no Taptic Engine, web, tests without the module).

function semFalhar(vibracao: () => Promise<void>) {
  try {
    vibracao().catch(() => undefined);
  } catch {
    // Nothing to do: no vibration is fine.
  }
}

/** A short tap of the phone, as in WhatsApp when a menu opens or a swipe catches. Never fails a gesture. */
export function vibrarLeve() {
  semFalhar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** The tick of a choice changing: a chip, a segmented control, a reorder. */
export function vibrarSelecao() {
  semFalhar(() => Haptics.selectionAsync());
}

/** Something that matters went through: group created, ride offered, seat asked, friend accepted, debt settled. */
export function vibrarSucesso() {
  semFalhar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** An action failed and the screen is saying why. */
export function vibrarErro() {
  semFalhar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
