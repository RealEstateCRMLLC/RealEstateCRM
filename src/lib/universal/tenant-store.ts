/**
 * Universal CRM — Server-Only Tenant Persistence Store (`data/universal-tenants.json`).
 *
 * Kept separate from `./tenant.ts` so client components (`UniversalProvisioner.tsx`)
 * can freely import pure types, generation presets, and validators from `./tenant.ts`
 * without pulling `node:fs/promises` into the Turbopack browser chunk graph.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultTenantRecord, type UniversalTenantRecord } from "./tenant.ts";

const DEFAULT_STORE_PATH = path.join(process.cwd(), "data", "universal-tenants.json");

async function readStoreMap(
  storePath: string = DEFAULT_STORE_PATH,
): Promise<Record<string, UniversalTenantRecord>> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, UniversalTenantRecord>;
    }
    return {};
  } catch {
    return {};
  }
}

export async function getStoredTenantRecord(
  workspaceId: string,
  storePath: string = DEFAULT_STORE_PATH,
): Promise<UniversalTenantRecord> {
  const store = await readStoreMap(storePath);
  return store[workspaceId] ?? defaultTenantRecord(workspaceId);
}

export async function saveStoredTenantRecord(
  record: Omit<UniversalTenantRecord, "updatedAt"> & { updatedBy?: string },
  storePath: string = DEFAULT_STORE_PATH,
): Promise<UniversalTenantRecord> {
  const store = await readStoreMap(storePath);
  const saved: UniversalTenantRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  store[record.workspaceId] = saved;
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
  return saved;
}
