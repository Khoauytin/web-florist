/**
 * Creates the owner account (from SEED_OWNER_* in .env), the default categories with their code
 * prefixes, and the shop settings row. Safe to run again: existing records are left untouched.
 */
import "dotenv/config";
import { auth, placeholderEmail } from "../src/server/auth/auth";
import { prisma } from "../src/server/db/prisma";

const DEFAULT_CATEGORIES = [
  { name: "Hoa bó", codePrefix: "BO" },
  { name: "Hoa hộp", codePrefix: "HOP" },
  { name: "Hoa giỏ", codePrefix: "GIO" },
  { name: "Hoa lồng đèn", codePrefix: "LD" },
];

async function main() {
  const username = (process.env.SEED_OWNER_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "";
  const name = process.env.SEED_OWNER_NAME?.trim() || "Chủ shop";
  if (!/^[a-z0-9._]{3,30}$/.test(username)) throw new Error("SEED_OWNER_USERNAME must be 3-30 chars of a-z, 0-9, . or _");
  if (password.length < 8) throw new Error("SEED_OWNER_PASSWORD must be at least 8 characters");

  if (await prisma.user.findUnique({ where: { username } })) {
    console.log(`Owner "${username}" already exists, skipping.`);
  } else {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser(
      { email: placeholderEmail(username), name, emailVerified: true, username, displayUsername: username },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    console.log(`Created owner "${username}".`);
  }

  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: { ...c, sortOrder: i + 1 } });
  }
  await prisma.shopSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, facebookUrl: "https://www.facebook.com/BichNgocFlorist", messengerUrl: "https://m.me/BichNgocFlorist" },
  });
  console.log(`Categories: ${DEFAULT_CATEGORIES.map((c) => `${c.name} (${c.codePrefix})`).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
