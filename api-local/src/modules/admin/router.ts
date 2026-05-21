import { Router } from "express";
import { adminRolesRouter } from "./roles/router";
import { adminUsersRouter } from "./users/router";

export const adminRouter = Router();

adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/roles", adminRolesRouter);
