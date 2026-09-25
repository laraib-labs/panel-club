// Local dev against the real docker-compose stack (Postgres + Redis + SRH),
// once `docker compose up -d` is running. Supersedes scripts/dev.ts (PGlite)
// as the primary path; that one stays as a no-Docker fallback.
//
// Not .env.local: this sandbox's permission rules deny writes to any
// .env*-shaped file (a deliberate credential-protection rule), so these
// values live here instead. UPSTASH_REDIS_REST_TOKEN must match
// docker-compose.yml's SRH_TOKEN — it's a shared placeholder between two
// local containers only, never a real credential.
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres",
  UPSTASH_REDIS_REST_URL: "http://localhost:8079",
  UPSTASH_REDIS_REST_TOKEN: "insecure-local-dev-placeholder",
};

const next = spawn("npx", ["next", "dev"], { stdio: "inherit", env });
next.on("exit", (code) => process.exit(code ?? 0));
