export function createMfaFriendlyName(timestamp = Date.now()) {
  return `Magic Massage Admin ${timestamp}`;
}

export function normalizeMfaQrCodeSrc(value: string) {
  return value.trimEnd();
}
