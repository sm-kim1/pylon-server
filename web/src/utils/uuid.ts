export function generateId(): string {
  if (typeof crypto !== 'undefined') {
    const maybeCrypto = crypto as Crypto & { randomUUID?: () => string };
    if (typeof maybeCrypto.randomUUID === 'function') {
      return maybeCrypto.randomUUID();
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16;
    const value = char === 'x' ? rand : (rand % 4) + 8;
    return Math.floor(value).toString(16);
  });
}
