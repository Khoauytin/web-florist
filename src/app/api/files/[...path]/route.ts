import { readLocal } from "@/server/storage";

/** Serves product images stored by the local storage driver (development / self-hosting). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");
  try {
    const body = await readLocal(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": key.endsWith(".webp") ? "image/webp" : "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
