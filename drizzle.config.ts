import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: [
    "./shared/schema.ts",
    "./server/db/schema/bodyComposition.ts",
    "./server/db/schema/organizations.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
