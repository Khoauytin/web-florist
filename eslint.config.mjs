import next from "eslint-config-next";

const config = [
  { ignores: [".next/**", "node_modules/**", "src/generated/**", "legacy/**", "docs/**", "next-env.d.ts"] },
  ...next,
];

export default config;
