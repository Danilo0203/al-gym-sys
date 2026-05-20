import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { getSessionContext } from "../modules/auth/service";
import { HttpError } from "../utils/http-error";

export async function authSessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const sessionToken = req.cookies?.[env.SESSION_COOKIE_NAME];

    if (!sessionToken) {
      return next();
    }

    const session = await getSessionContext(sessionToken);
    if (!session) {
      return next();
    }

    req.auth = session.auth;
    req.sessionId = session.sessionId;
    req.sessionToken = sessionToken;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || !req.sessionId || !req.sessionToken) {
    return next(new HttpError(401, "unauthorized", "Authentication required"));
  }

  next();
}
