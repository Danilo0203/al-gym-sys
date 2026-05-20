import crypto from "node:crypto";

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
