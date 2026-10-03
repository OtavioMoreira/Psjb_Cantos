import { defineConfig } from "vitest/config";

// unit: regras, serviços e rotas com adaptadores em memória (rápidos, sem banco).
// integration: repositórios e fluxos HTTP contra um Postgres de verdade (banco *_test).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts", "test/http/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          globalSetup: ["test/integration/globalSetup.ts"],
          // Os arquivos limpam o mesmo banco: um de cada vez.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
