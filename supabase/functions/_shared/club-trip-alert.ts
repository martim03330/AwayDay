// The texts of the «Viagens da Casa» notifications (club-trip-notify), kept apart so they can be tested.
// Hours are always shown as Lisbon reads them.

const TIME_ZONE = 'Europe/Lisbon';

/** "16:00": the hour of an instant (ISO, UTC) in Lisbon. */
export function lisbonTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** The alert sent to the fans of the area when a Casa publishes a trip: where and when it leaves from. */
export function alertTitle(
  clubName: string,
  fixtureLabel: string,
  stopName: string,
  passesAt: string
): { title: string; body: string } {
  return {
    title: `Autocarro da ${clubName}`,
    body: `${fixtureLabel}: sai de ${stopName} às ${lisbonTime(passesAt)}.`,
  };
}
