import { promises as fs } from "node:fs";
import path from "node:path";
import { readServerEnv } from "./runtimeEnv";

/**
 * Server-side key/value store shared by the comment and report repositories
 * and the rate limiter (#1682).
 *
 * The in-memory implementation is intended for tests and mock mode only. The
 * file and Redis adapters give the data a lifetime beyond a single server
 * process and, for Redis, visibility across instances.
 *
 * Values are JSON-serialised, so every adapter stores the same shape and the
 * repositories can be swapped without changing their callers.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Process-local store. Data is lost on restart and not shared across instances. */
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, unknown>();

  get<T>(key: string): Promise<T | null> {
    return Promise.resolve(this.map.has(key) ? (this.map.get(key) as T) : null);
  }

  set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }
}

/**
 * Single-file JSON store. Survives a server restart and is shared by every
 * process that can read the same path (i.e. instances on a shared volume).
 *
 * Read-modify-write updates are not locked, so this adapter suits a single
 * instance or a low-traffic single-writer setup. Use the Redis adapter for
 * horizontally scaled deployments.
 */
export class FileKeyValueStore implements KeyValueStore {
  constructor(private readonly filePath: string) {}

  private async readAll(): Promise<Record<string, unknown>> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeAll(data: Record<string, unknown>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data), "utf8");
    await fs.rename(tmpPath, this.filePath);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.readAll();
    return Object.prototype.hasOwnProperty.call(data, key) ? (data[key] as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const data = await this.readAll();
    data[key] = value;
    await this.writeAll(data);
  }

  async delete(key: string): Promise<void> {
    const data = await this.readAll();
    if (!Object.prototype.hasOwnProperty.call(data, key)) return;
    delete data[key];
    await this.writeAll(data);
  }
}

/**
 * Shared store backed by an Upstash-compatible Redis REST endpoint. Requires
 * no client dependency — every operation is a `fetch`. This is the adapter to
 * use when more than one instance must see the same comments and rate limits.
 */
export class RedisKeyValueStore implements KeyValueStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async command<T>(pathname: string, init?: RequestInit): Promise<T | null> {
    const base = this.url.replace(/\/$/, "");
    const response = await fetch(`${base}${pathname}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${this.token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Redis store request failed with status ${response.status}`);
    }
    const body = (await response.json()) as { result?: T | null };
    return body.result ?? null;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.command<string>(`/get/${encodeURIComponent(key)}`);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.command(`/set/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify(value),
    });
  }

  async delete(key: string): Promise<void> {
    await this.command(`/del/${encodeURIComponent(key)}`);
  }
}

function resolveStorePath(configured?: string): string {
  const target = configured && configured.trim() ? configured.trim() : ".data/poh-store.json";
  return path.isAbsolute(target) ? target : path.join(process.cwd(), target);
}

/**
 * Select the store adapter from the environment.
 *
 * - `COMMENT_STORE_DRIVER=redis` (or Redis credentials present) → shared Redis.
 * - `COMMENT_STORE_DRIVER=memory`, or `NODE_ENV=test` → process-local.
 * - otherwise → single-file JSON at `COMMENT_STORE_PATH`.
 */
export function createKeyValueStore(): KeyValueStore {
  const env = readServerEnv();
  const driver = env.COMMENT_STORE_DRIVER?.trim().toLowerCase();
  const redisUrl = env.COMMENT_STORE_REDIS_REST_URL?.trim();
  const redisToken = env.COMMENT_STORE_REDIS_REST_TOKEN?.trim();

  if (driver === "redis" || (!driver && redisUrl && redisToken)) {
    if (!redisUrl || !redisToken) {
      throw new Error(
        "COMMENT_STORE_DRIVER=redis requires COMMENT_STORE_REDIS_REST_URL and COMMENT_STORE_REDIS_REST_TOKEN",
      );
    }
    return new RedisKeyValueStore(redisUrl, redisToken);
  }

  if (driver === "memory" || process.env.NODE_ENV === "test") {
    return new InMemoryKeyValueStore();
  }

  return new FileKeyValueStore(resolveStorePath(env.COMMENT_STORE_PATH));
}

let cachedStore: KeyValueStore | null = null;

/** Process-wide store singleton. */
export function getKeyValueStore(): KeyValueStore {
  if (!cachedStore) cachedStore = createKeyValueStore();
  return cachedStore;
}

/** Reset the singleton so tests can swap adapters between cases. */
export function resetKeyValueStoreForTests(): void {
  cachedStore = null;
}
