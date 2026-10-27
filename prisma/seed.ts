/**
 * Creates the first owner account (from SEED_OWNER_* in .env) and the default categories.
 * Safe to run again: existing records are left untouched.
 */
import "dotenv/config";
import { auth, placeholderEmail } from "../src/server/auth/auth";
import { prisma } from "../src/server/db/prisma";

const DEFAULT_CATEGORIES = ["Hoa bó", "Hoa hộp", "Hoa giỏ", "Hoa lồng đèn"];

async function main() {
  const username = (process.env.SEED_OWNER_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "";
  const name = process.env.SEED_OWNER_NAME?.trim() || "Chủ shop";
  if (!/^[a-z0-9._]{3,30}$/.test(username)) throw new Error("SEED_OWNER_USERNAME must be 3-30 chars of a-z, 0-9, . or _");
  if (password.length < 8) throw new Error("SEED_OWNER_PASSWORD must be at least 8 characters");

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Owner "${username}" already exists, skipping.`);
  } else {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({
      email: placeholderEmail(username),
      name,
      emailVerified: true,
      username,
      displayUsername: username,
      role: "owner",
      mustChangePassword: false,
    }, { method: "admin" });
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    console.log(`Created owner "${username}".`);
  }

  for (const [i, cat] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.upsert({ where: { name: cat }, update: {}, create: { name: cat, sortOrder: i + 1 } });
  }
  console.log(`Categories: ${DEFAULT_CATEGORIES.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
