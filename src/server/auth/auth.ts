import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { prisma } from "@/server/db/prisma";

// Two roles: the owner manages accounts (Better Auth admin rights), staff have none.
const ac = createAccessControl(defaultStatements);
const roles = {
  owner: ac.newRole({ ...adminAc.statements }),
  staff: ac.newRole({ ...userAc.statements }),
};

/**
 * Staff sign in with a username. Better Auth still requires an email, so accounts get a
 * placeholder address that is never shown or used. Public sign-up is disabled: only the
 * owner creates accounts (admin plugin), and the first owner comes from `npm run db:seed`.
 */
export const auth = betterAuth({
  appName: "Bích Ngọc Florist",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      mustChangePassword: { type: "boolean", defaultValue: false, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: { "/sign-in/username": { window: 60, max: 5 } },
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await prisma.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } });
        },
      },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    admin({ ac, roles, adminRoles: ["owner"], defaultRole: "staff" }),
    nextCookies(),
  ],
});

export function placeholderEmail(username: string) {
  return `${username}@users.bichngoc.invalid`;
}
