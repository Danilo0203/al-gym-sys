import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new HttpError(401, "unauthorized", "Authentication required"));
    }

    if (req.auth.isOwner || req.auth.permissions.includes(permission)) {
      return next();
    }

    return next(new HttpError(403, "forbidden", `Missing permission: ${permission}`));
  };
}
