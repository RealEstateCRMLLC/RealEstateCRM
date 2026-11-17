/**
 * Per-user MCP tokens (server-only).
 *
 * Why: the MCP endpoint accepted either a browser session or ONE
 * workspace-wide MCP_TOKEN env var - every external AI shared a single
 * identity. Per-user tokens let each realtor connect their own AI
 * (ChatGPT/Claude/Gemini via MCP) acting strictly as themselves:
 * tools run with that user's workspace + permissions, and any user
 * can revoke their own token without rotating everyone else's.
 *
 * Storage follows the codebase's zero-migration hybrid pattern
 * (cf. provider-settings): JSON under data/, SHA-256 hashes only -
 * plaintext is shown once at generation and never stored.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface McpUserToken {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const DATA_FILE = process.env.MCP_TOKENS_FILE || path.join(process.cwd(), 'data', 'mcp-tokens.json');
const TOKEN_PREFIX = 'recm_';

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function mintTokenPlaintext(): string {
  return TOKEN_PREFIX + randomBytes(24).toString('base64url');
}

async function readAll(): Promise<McpUserToken[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(tokens: McpUserToken[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

/** Generate (or rotate) the token for a user. Returns plaintext ONCE. */
export async function generateUserToken(userId: string, email: string): Promise<{ plaintext: string; record: McpUserToken }> {
  const plaintext = mintTokenPlaintext();
  const record: McpUserToken = {
    id: randomBytes(8).toString('hex'),
    userId,
    email,
    tokenHash: hashToken(plaintext),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  const tokens = (await readAll()).filter((t) => t.userId !== userId);
  tokens.push(record);
  await writeAll(tokens);
  return { plaintext, record };
}

export async function revokeUserToken(userId: string): Promise<boolean> {
  const tokens = await readAll();
  const next = tokens.filter((t) => t.userId !== userId);
  if (next.length === tokens.length) return false;
  await writeAll(next);
  return true;
}

export async function getUserTokenMeta(userId: string): Promise<{ createdAt: string; lastUsedAt: string | null } | null> {
  const found = (await readAll()).find((t) => t.userId === userId);
  return found ? { createdAt: found.createdAt, lastUsedAt: found.lastUsedAt } : null;
}

/** Constant-time verification; stamps lastUsedAt on success. */
export async function verifyUserToken(plaintext: string): Promise<McpUserToken | null> {
  if (!plaintext.startsWith(TOKEN_PREFIX)) return null;
  const candidate = Buffer.from(hashToken(plaintext), 'hex');
  const tokens = await readAll();
  for (const t of tokens) {
    const stored = Buffer.from(t.tokenHash, 'hex');
    if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) {
      t.lastUsedAt = new Date().toISOString();
      await writeAll(tokens).catch(() => undefined);
      return t;
    }
  }
  return null;
}
