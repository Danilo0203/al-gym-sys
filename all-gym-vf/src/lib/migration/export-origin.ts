// NextURL normalizes 127.0.0.1 to localhost. Compare with the original Host
// authority instead so distinct browser origins stay distinct.
export function isSameOriginExport(originHeader: string | null, hostHeader: string | null, protocol: string) {
  if (!originHeader || !hostHeader || !["http:", "https:"].includes(protocol) || /[\\/@,\s]/.test(hostHeader)) return false;
  try {
    const origin = new URL(originHeader), expected = new URL(`${protocol}//${hostHeader}`);
    return !origin.username && !origin.password && origin.origin === expected.origin;
  } catch { return false; }
}
