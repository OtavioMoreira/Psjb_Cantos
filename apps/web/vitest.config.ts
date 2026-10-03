import path from "node:path";
import { defineConfig } from "vitest/config";

// Testes das regras puras do front (lib/): calendário, cifra, busca. Sem navegador.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@data": path.resolve(__dirname, "../../data") } },
  test: { include: ["test/**/*.test.ts"] },
});
