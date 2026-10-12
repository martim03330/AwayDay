import * as Haptics from 'expo-haptics';

/** A short tap of the phone, as in WhatsApp when a menu opens or a swipe catches. Never fails a gesture. */
export function vibrarLeve() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
