import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: ["./shared/schema.ts", "./server/db/schema/bodyComposition.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
