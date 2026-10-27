import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations use the direct connection; the app uses DATABASE_URL (pooler on Supabase).
  datasource: { url: env("DIRECT_URL") },
});
