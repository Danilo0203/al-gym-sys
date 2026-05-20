import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
