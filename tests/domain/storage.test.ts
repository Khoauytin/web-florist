import { randomUUID } from "node:crypto";
import { mkdir, rmdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  remove: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ remove: supabase.remove }),
    },
  }),
}));

const originalStorageDriver = process.env.STORAGE_DRIVER;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  vi.resetModules();
  supabase.remove.mockReset();
});

afterEach(() => {
  restoreEnv("STORAGE_DRIVER", originalStorageDriver);
  restoreEnv("SUPABASE_URL", originalSupabaseUrl);
  restoreEnv("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
});

describe("storage deletion", () => {
  it("ignores a missing local file but surfaces other filesystem errors", async () => {
    process.env.STORAGE_DRIVER = "local";
    const { LOCAL_ROOT, storage } = await import("@/server/storage");
    const productDir = path.join(LOCAL_ROOT, "products", randomUUID());
    const key = `${path.relative(LOCAL_ROOT, productDir).replaceAll("\\", "/")}/directory.webp`;
    const target = path.join(LOCAL_ROOT, key);

    await expect(storage().remove(key)).resolves.toBeUndefined();
    await mkdir(target, { recursive: true });
    try {
      await expect(storage().remove(key)).rejects.toMatchObject({ code: expect.stringMatching(/^(EISDIR|EPERM)$/) });
    } finally {
      await rmdir(target);
      await rmdir(productDir);
    }
  });

  it("surfaces errors returned by Supabase Storage", async () => {
    process.env.STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const failure = new Error("Supabase delete failed");
    supabase.remove.mockResolvedValue({ data: null, error: failure });
    const { storage } = await import("@/server/storage");
    const key = `products/${randomUUID()}/${randomUUID()}.webp`;

    await expect(storage().remove(key)).rejects.toBe(failure);
    expect(supabase.remove).toHaveBeenCalledWith([key]);
  });
});
