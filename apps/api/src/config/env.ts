import { z } from "zod";

// Lê e valida as variáveis de ambiente uma vez só. Falha cedo se faltar algo obrigatório.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(3333),
  HOST: z.string().default("0.0.0.0"),
  /** Origens liberadas no CORS, separadas por vírgula. */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  /** Local: Postgres do docker-compose. Produção: string "pooled" do Neon (com sslmode=require). */
  DATABASE_URL: z.string().default("postgres://psjb:psjb@localhost:5432/psjb_cantos"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de 32+ caracteres").default("dev-only-secret-troque-em-producao-0123456789"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  /** Sem "manter conectado": 1 dia. Com: 30 dias. */
  REFRESH_TTL_SHORT_DAYS: z.coerce.number().positive().default(1),
  REFRESH_TTL_LONG_DAYS: z.coerce.number().positive().default(30),
  /** Com o token, as fotos vão para o Vercel Blob; sem ele, para a pasta local uploads/. */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  PUBLIC_URL: z.string().default("http://localhost:3333"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source);
  if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("dev-only")) {
    throw new Error("Defina JWT_SECRET em produção.");
  }
  return env;
}
