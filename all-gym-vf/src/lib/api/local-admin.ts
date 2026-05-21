type ApiErrorPayload = {
  requestId?: string;
  error?: string;
  message?: string;
  details?: unknown;
};

function isJsonContentType(contentType: string | null) {
  return Boolean(contentType && contentType.includes("application/json"));
}

export async function requestLocalAdmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers
  });

  const contentType = response.headers.get("content-type");
  const rawBody = response.status === 204 ? "" : await response.text();
  const parsedBody = rawBody && isJsonContentType(contentType) ? (JSON.parse(rawBody) as unknown) : null;

  if (!response.ok) {
    const errorPayload = parsedBody as ApiErrorPayload | null;
    throw new Error(errorPayload?.message || errorPayload?.error || `Request failed with status ${response.status}`);
  }

  if (!parsedBody) {
    return null as T;
  }

  if (typeof parsedBody === "object" && parsedBody !== null && "data" in parsedBody) {
    return (parsedBody as { data: T }).data;
  }

  return parsedBody as T;
}
