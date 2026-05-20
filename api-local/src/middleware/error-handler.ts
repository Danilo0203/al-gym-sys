import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error";

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "not_found", `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      requestId: req.requestId,
      error: "validation_error",
      details: error.flatten()
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      requestId: req.requestId,
      error: error.code,
      message: error.message,
      details: error.details ?? null
    });
  }

  console.error("Unhandled API error", error);

  return res.status(500).json({
    requestId: req.requestId,
    error: "internal_server_error",
    message: "Unexpected server error"
  });
}
