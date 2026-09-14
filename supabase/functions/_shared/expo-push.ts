// Sends push notifications through the Expo push service (free). Up to 100 messages per request.

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Readonly<Record<string, string>>;
};

export type PushOutcome = {
  sent: number;
  failed: number;
  /** Tokens Expo says will never receive again (DeviceNotRegistered): delete them. */
  invalidTokens: string[];
};

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

export function parsePushTickets(messages: readonly PushMessage[], payload: unknown): PushOutcome {
  const tickets = asRecord(payload)?.data;
  const outcome: PushOutcome = { sent: 0, failed: 0, invalidTokens: [] };
  messages.forEach((message, index) => {
    const ticket = Array.isArray(tickets) ? asRecord(tickets[index]) : null;
    if (ticket?.status === 'ok') {
      outcome.sent += 1;
      return;
    }
    outcome.failed += 1;
    if (asRecord(ticket?.details)?.error === 'DeviceNotRegistered') outcome.invalidTokens.push(message.to);
  });
  return outcome;
}

export async function sendExpoPush(messages: readonly PushMessage[]): Promise<PushOutcome> {
  if (messages.length === 0) return { sent: 0, failed: 0, invalidTokens: [] };
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
        'content-type': 'application/json',
      },
      body: JSON.stringify(messages.slice(0, 100).map((message) => ({ ...message, sound: 'default' }))),
    });
    if (!response.ok) return { sent: 0, failed: messages.length, invalidTokens: [] };
    return parsePushTickets(messages, await response.json());
  } catch {
    return { sent: 0, failed: messages.length, invalidTokens: [] };
  }
}
