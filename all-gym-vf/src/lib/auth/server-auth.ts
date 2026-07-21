import { cache } from "react";
import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { getAuthErrorMessage, parseAuthContext, parseJsonText, type AuthContext } from "@/lib/auth/contracts";

async function fetchAuthContextFromCookieHeader(cookieHeader: string | null): Promise<AuthContext | null> {
  let response: Response;

  try {
    response = await fetchAuthBackend("/auth/me", {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
  } catch (error) {
    throw new Error(
      `Could not reach local auth backend: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (response.status === 401) {
    return null;
  }

  const responseText = await response.text();

  if (!response.ok) {
    const payload = responseText.trim() ? parseJsonText(responseText, "Local auth backend") : null;
    const errorMessage = payload ? getAuthErrorMessage(payload) : null;

    throw new Error(
      errorMessage
        ? `Local auth backend rejected the session: ${errorMessage}`
        : `Local auth backend rejected the session with status ${response.status}.`,
    );
  }

  return parseAuthContext(parseJsonText(responseText, "Local auth backend"), "Local auth backend");
}

export const getServerAuthContext = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  return fetchAuthContextFromCookieHeader(cookieHeader);
});
