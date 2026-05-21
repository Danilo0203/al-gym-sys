import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/permissions";
import {
  createUserSchema,
  userIdParamSchema,
  userRoleSchema,
  userStatusBodySchema,
  updateUserSchema
} from "../schemas";
import { changeUserRole, createUser, deleteUser, getUserById, listUsers, updateUser, updateUserStatus } from "./service";
import { listRoles } from "../roles/service";

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth);

adminUsersRouter.get("/", requirePermission("users.view"), async (_req, res, next) => {
  try {
    const users = await listUsers();
    return res.status(200).json({ requestId: _req.requestId, data: users });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.get("/roles", requirePermission("users.view"), async (req, res, next) => {
  try {
    const roles = await listRoles();
    return res.status(200).json({ requestId: req.requestId, data: roles });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.get("/:id", requirePermission("users.view"), async (req, res, next) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ requestId: req.requestId, error: "not_found", message: "User not found" });
    }

    return res.status(200).json({ requestId: req.requestId, data: user });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.post("/", requirePermission("users.create"), async (req, res, next) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const user = await createUser(payload, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(201).json({ requestId: req.requestId, data: user });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.patch("/:id", requirePermission("users.update"), async (req, res, next) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const payload = updateUserSchema.parse(req.body);
    const user = await updateUser({ id, ...payload }, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(200).json({ requestId: req.requestId, data: user });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.patch("/:id/status", requirePermission("users.update"), async (req, res, next) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const payload = userStatusBodySchema.parse(req.body);
    const user = await updateUserStatus({ id, status: payload.status }, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(200).json({ requestId: req.requestId, data: user });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.patch("/:id/role", requirePermission("users.update"), async (req, res, next) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const payload = userRoleSchema.parse(req.body);
    const user = await changeUserRole({ id, role: payload.role }, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(200).json({ requestId: req.requestId, data: user });
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.delete("/:id", requirePermission("users.delete"), async (req, res, next) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    await deleteUser({ id }, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
