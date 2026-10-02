const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

type LocalService = "backend" | "sync";

export function parseLocalServiceBaseUrl(
  value: string | undefined,
  service: LocalService,
): URL | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    const dockerHost = service === "backend"
      ? url.hostname === "backend" || url.hostname === "host.docker.internal"
      : url.hostname === "sync";

    if (
      url.protocol !== "http:" ||
      !(LOOPBACK_HOSTS.has(url.hostname) || dockerHost) ||
      url.username || url.password || url.search || url.hash
    ) return null;

    return url;
  } catch {
    return null;
  }
}
