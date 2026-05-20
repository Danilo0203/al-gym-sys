import { Router } from "express";
import { env } from "../../config/env";
import { requireAuth } from "../../middleware/auth";
import { loginSchema } from "./schema";
import { createSessionAndLoginAudit, logoutSession } from "./service";

export const authRouter = Router();

function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    expires,
    path: "/"
  };
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const session = await createSessionAndLoginAudit({
      email: payload.email,
      password: payload.password,
      requestId: req.requestId,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null
    });

    res.cookie(env.SESSION_COOKIE_NAME, session.sessionToken, sessionCookieOptions(session.expiresAt));

    return res.status(200).json({
      requestId: req.requestId,
      user: {
        id: session.auth.userId,
        email: session.auth.email,
        full_name: session.auth.fullName,
        role: session.auth.role,
        roleScope: session.auth.roleScope,
        permissions: session.auth.permissions,
        isOwner: session.auth.isOwner
      },
      redirectTo: session.auth.roleScope === "panel" || session.auth.isOwner ? "/panel/resumen" : "/",
      mustChangePassword: session.auth.mustChangePassword
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    if (req.auth && req.sessionId) {
      await logoutSession({
        sessionId: req.sessionId,
        requestId: req.requestId,
        actorUserId: req.auth.userId,
        sessionToken: req.sessionToken
      });
    }

    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/"
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  return res.status(200).json({
    requestId: req.requestId,
    authenticated: true,
    user: {
      id: req.auth!.userId,
      email: req.auth!.email,
      full_name: req.auth!.fullName,
      role: req.auth!.role,
      roleScope: req.auth!.roleScope,
      permissions: req.auth!.permissions,
      isOwner: req.auth!.isOwner,
      mustChangePassword: req.auth!.mustChangePassword
    }
  });
});
