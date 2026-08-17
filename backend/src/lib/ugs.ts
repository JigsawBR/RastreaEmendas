import { prisma } from "./prisma.js";

export async function ugNameMap(codigos: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(codigos.filter((c): c is string => !!c))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.unidade_gestora.findMany({
    where: { codigo: { in: unique } },
    select: { codigo: true, nome: true },
  });
  return new Map(
    rows.filter((r) => r.nome).map((r) => [r.codigo, r.nome as string]),
  );
}
