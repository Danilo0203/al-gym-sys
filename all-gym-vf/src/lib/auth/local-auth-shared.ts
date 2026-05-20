export type LocalAuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  roleScope: string | null;
  permissions: string[];
  isOwner: boolean;
  mustChangePassword?: boolean;
};

export type LocalAuthMeResponse = {
  requestId: string;
  authenticated: true;
  user: LocalAuthUser;
};

export type LocalAuthLoginResponse = {
  requestId: string;
  user: LocalAuthUser;
  redirectTo: string;
  mustChangePassword: boolean;
};

export type LocalAuthErrorResponse = {
  requestId?: string;
  error?: string;
  message?: string;
  details?: unknown;
};

export function getLocalAuthErrorMessage(
  payload: LocalAuthErrorResponse | null | undefined,
  fallback: string,
) {
  return payload?.message || fallback;
}
