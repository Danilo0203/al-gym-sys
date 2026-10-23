import { randomBytes } from "node:crypto";

export type RemoteSession = { accessToken: string; expiresAt: number };
type Entry = RemoteSession & { owner: string };
// Remote tokens exist only in this process. Browser cookies contain an opaque ID.
export class ExportVault {
  private entries = new Map<string, Entry>();
  constructor(private now: () => number = Date.now) {}
  private prune() {
    for (const [id, entry] of this.entries) if (entry.expiresAt <= this.now()) this.entries.delete(id);
  }
  put(owner: string, session: RemoteSession) {
    this.prune();
    if (this.entries.size >= 64 || !session.accessToken || !Number.isFinite(session.expiresAt) || session.expiresAt <= this.now()) {
      throw new Error("No se pudo abrir una sesión de exportación.");
    }
    const id = randomBytes(32).toString("hex");
    const entry = { ...session, owner, expiresAt: Math.min(session.expiresAt, this.now() + 30 * 60000) };
    this.entries.set(id, entry);
    return { id, expiresAt: entry.expiresAt };
  }
  get(id: string | undefined, owner: string) {
    this.prune();
    if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
    const entry = this.entries.get(id);
    return entry?.owner === owner ? entry : null;
  }
  drop(id: string | undefined, owner: string) {
    if (this.get(id, owner)) this.entries.delete(id!);
  }
}
const processState = globalThis as typeof globalThis & { algymExportVault?: ExportVault };
export const exportVault = processState.algymExportVault ??= new ExportVault();
