export const sessionsKey = ['sessions'] as const;

export const sessionKey = (sessionId: string) =>
  ['sessions', sessionId] as const;

export const sessionSeatsKey = (sessionId: string) =>
  ['sessions', sessionId, 'seats'] as const;
