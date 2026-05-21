import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { allowedOrigins, env } from "./config/env";
import { pool } from "./db/client";
import { authSessionMiddleware } from "./middleware/auth";
import { errorHandler, notFoundMiddleware } from "./middleware/error-handler";
import { requestContextMiddleware } from "./middleware/request-context";
import { authRouter } from "./modules/auth/router";
import { adminRouter } from "./modules/admin/router";

const app = express();

app.set("trust proxy", true);

app.use(requestContextMiddleware);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(authSessionMiddleware);

app.get("/health", async (_req, res, next) => {
  try {
    await pool.query("select 1");
    return res.status(200).json({
      ok: true,
      service: "api-local",
      database: "ok"
    });
  } catch (error) {
    next(error);
  }
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use(notFoundMiddleware);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`api-local listening on http://127.0.0.1:${env.PORT}`);
});
