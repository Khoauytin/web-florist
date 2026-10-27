import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Product image storage. "local" keeps files in ./storage (served by /api/files/...),
 * "supabase" uses a public Supabase Storage bucket. Only the server writes.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  remove(key: string): Promise<void>;
}

export const LOCAL_ROOT = path.resolve(process.cwd(), "storage");

/** Keys look like "products/<uuid>/<uuid>.webp"; anything else is rejected. */
export function safeKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

const localDriver: StorageDriver = {
  async put(key, body) {
    const file = path.join(LOCAL_ROOT, safeKey(key));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: `/api/files/${key}` };
  },
  async remove(key) {
    try {
      await unlink(path.join(LOCAL_ROOT, safeKey(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  },
};

function supabaseDriver(): StorageDriver {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.STORAGE_BUCKET || "product-images";
  if (!url || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for STORAGE_DRIVER=supabase");
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return {
    async put(key, body, contentType) {
      const { error } = await client.storage.from(bucket).upload(safeKey(key), body, { contentType, upsert: true });
      if (error) throw error;
      return { url: client.storage.from(bucket).getPublicUrl(key).data.publicUrl };
    },
    async remove(key) {
      const { error } = await client.storage.from(bucket).remove([safeKey(key)]);
      if (error) throw error;
    },
  };
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  driver ??= process.env.STORAGE_DRIVER === "supabase" ? supabaseDriver() : localDriver;
  return driver;
}

export async function readLocal(key: string): Promise<Buffer> {
  return readFile(path.join(LOCAL_ROOT, safeKey(key)));
}
