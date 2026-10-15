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
  /** Deploy Hook da Vercel do projeto do front: "Publicar no site" dispara um novo build. */
  SITE_DEPLOY_HOOK_URL: z.url().optional(),
  /** Endereço do site (com o basePath, se houver), usado nos links dos e-mails. */
  APP_URL: z.url().default("http://localhost:3000").transform((u) => u.replace(/\/+$/, "")),
  /** Com a chave, os e-mails saem pelo Resend; sem ela, só aparecem no log da API. */
  RESEND_API_KEY: z.string().optional(),
  /** Remetente. Sem domínio verificado no Resend, só funciona o de teste (onboarding@resend.dev). */
  EMAIL_FROM: z.string().default("Cantos PSJB <onboarding@resend.dev>"),
  /** Login em duas etapas (código por e-mail). Ligado por padrão só em produção. */
  LOGIN_2FA: z.enum(["true", "false"]).optional(),
});

export type Env = z.infer<typeof schema> & { loginTwoFactor: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.parse(source);
  const env = { ...parsed, loginTwoFactor: (parsed.LOGIN_2FA ?? (parsed.NODE_ENV === "production" ? "true" : "false")) === "true" };
  if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("dev-only")) {
    throw new Error("Defina JWT_SECRET em produção.");
  }
  // Sem e-mail em produção, recuperação de senha, convite e 2FA ficariam mudos.
  if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
    throw new Error("Defina RESEND_API_KEY em produção.");
  }
  return env;
}
