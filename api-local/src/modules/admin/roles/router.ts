import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/permissions";
import {
  createRoleSchema,
  deleteRoleSchema,
  roleIdParamSchema,
  roleQuerySchema,
  updateRoleSchema
} from "../schemas";
import { createRole, deleteRole, getRolePermissions, listPermissions, listRoles, updateRole } from "./service";

export const adminRolesRouter = Router();

adminRolesRouter.use(requireAuth);

adminRolesRouter.get("/", requirePermission("roles.view"), async (req, res, next) => {
  try {
    const query = roleQuerySchema.parse({ scope: req.query.scope });
    const roles = await listRoles(query.scope);
    return res.status(200).json({ requestId: req.requestId, data: roles });
  } catch (error) {
    next(error);
  }
});

adminRolesRouter.get("/permissions", requirePermission("roles.view"), async (req, res, next) => {
  try {
    const permissions = await listPermissions();
    return res.status(200).json({ requestId: req.requestId, data: permissions });
  } catch (error) {
    next(error);
  }
});

adminRolesRouter.get("/:id/permissions", requirePermission("roles.view"), async (req, res, next) => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const permissionIds = await getRolePermissions(id);
    return res.status(200).json({ requestId: req.requestId, data: permissionIds });
  } catch (error) {
    next(error);
  }
});

adminRolesRouter.post("/", requirePermission("roles.create"), async (req, res, next) => {
  try {
    const payload = createRoleSchema.parse(req.body);
    const role = await createRole(payload, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(201).json({ requestId: req.requestId, data: role });
  } catch (error) {
    next(error);
  }
});

adminRolesRouter.patch("/:id", requirePermission("roles.update"), async (req, res, next) => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const payload = updateRoleSchema.parse(req.body);
    const role = await updateRole({ id, ...payload }, {
      userId: req.auth!.userId,
      email: req.auth!.email,
      isOwner: req.auth!.isOwner,
      requestId: req.requestId
    });

    return res.status(200).json({ requestId: req.requestId, data: role });
  } catch (error) {
    next(error);
  }
});

adminRolesRouter.delete("/:id", requirePermission("roles.delete"), async (req, res, next) => {
  try {
    const { id } = roleIdParamSchema.parse(req.params);
    const payload = deleteRoleSchema.parse(req.body ?? {});
    await deleteRole({ id, ...payload }, {
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
