import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma v7 config resolution requires the env var to exist at CLI time.
    // Fallback keeps `prisma validate`/generation working even if the real
    // `DATABASE_URL` isn't set in this repo's local `.env`.
    // url: process.env.DATABASE_URL ?? "postgresql://postgres:default@localhost:5432/new",
    url: process.env.DATABASE_URL ?? "postgresql://postgres:default@localhost:5432/new",
  },
});

