import type { AuthContext } from "../modules/auth/service";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthContext;
      sessionId?: string;
      sessionToken?: string;
    }
  }
}

export {};
