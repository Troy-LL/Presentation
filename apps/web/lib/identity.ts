export function getOrCreateParticipantId(sessionCode: string) {
  const storageKey = `participant:${sessionCode}`;
  const existing = window.sessionStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, nextId);
  return nextId;
}

