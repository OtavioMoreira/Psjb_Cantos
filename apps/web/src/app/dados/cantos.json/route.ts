import { getSongs } from "@/lib/data";

// Índice estático com todos os cantos (inclui letra/cifra). Gerado no build e servido com cache.
// Usado pela busca na letra, pelo editor de missa e pelo Modo Missa (que precisa funcionar offline).
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await getSongs());
}
