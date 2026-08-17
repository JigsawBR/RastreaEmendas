import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { pbLocalidadeFilter } from "../lib/filters.js";

export const municipiosRouter = Router();

const UF_BUCKET = "PARAÍBA (UF)";

// "CAMPINA GRANDE - PB" -> "CAMPINA GRANDE"; "PARAÍBA (UF)" -> bucket estadual
function normalizeLocalidade(localidade: string): string {
  if (localidade === UF_BUCKET) return UF_BUCKET;
  return localidade.replace(/ - PB$/, "");
}

// Transferegov usa "MUNICIPIO DE JOAO PESSOA" (sem acento) ou o nome puro
function normalizeBeneficiario(nome: string): string {
  return nome.replace(/^MUNICIPIO D[EOA] /, "");
}

// chave de agregacao sem acentos, para casar "JOÃO PESSOA" com "JOAO PESSOA"
function canon(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// GET /municipios?ano=
// RF-06: agregado por localidade (municipio ou UF), cruzando tres fontes:
// - emenda_alocacao (localidade do gasto declarada na emenda)
// - despesa_mensal (execucao orcamentaria mensal por municipio; linhas sem
//   municipio sao gastos estaduais/nao municipalizados e caem no bucket UF)
// - transferegov_plano_acao (transferencias especiais EC 105, beneficiario
//   explicito; "ESTADO DA PARAIBA" cai no bucket UF)
municipiosRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;

  const [alocacoes, despesas, planos] = await Promise.all([
    prisma.emenda_alocacao.findMany({
      where: {
        ...pbLocalidadeFilter(),
        ...(ano ? { emenda: { ano } } : {}),
      },
      select: {
        localidade_gasto: true,
        codigo_emenda: true,
        valor_empenhado: true,
        valor_liquidado: true,
        valor_pago: true,
      },
    }),
    prisma.despesa_mensal.findMany({
      where: {
        uf: "PB",
        ...(ano ? { ano_mes: { startsWith: String(ano) } } : {}),
      },
      select: {
        municipio: true,
        nome_autor_emenda: true,
        valor_empenhado: true,
        valor_liquidado: true,
        valor_pago: true,
      },
    }),
    prisma.transferegov_plano_acao.findMany({
      where: {
        uf_beneficiario: "PB",
        ...(ano ? { ano_plano_acao: ano } : {}),
      },
      select: {
        nome_beneficiario: true,
        nome_parlamentar: true,
        valor_custeio: true,
        valor_investimento: true,
      },
    }),
  ]);

  type Acc = {
    localidade: string;
    emendas: Set<string>;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
    autoresDespesa: Set<string>;
    despesaEmpenhado: number;
    despesaLiquidado: number;
    despesaPago: number;
    planosTransferegov: number;
    parlamentaresTransferegov: Set<string>;
    transferegovValor: number;
  };

  const map = new Map<string, Acc>();
  const getAcc = (localidade: string): Acc => {
    const nome = normalizeLocalidade(localidade);
    const key = canon(nome);
    let acc = map.get(key);
    if (acc) {
      // prefere o nome acentuado quando as fontes divergem
      if (acc.localidade !== nome && canon(acc.localidade) === acc.localidade && canon(nome) !== nome) {
        acc.localidade = nome;
      }
      return acc;
    }
    if (!acc) {
      acc = {
        localidade: nome,
        emendas: new Set(),
        valorEmpenhado: 0,
        valorLiquidado: 0,
        valorPago: 0,
        autoresDespesa: new Set(),
        despesaEmpenhado: 0,
        despesaLiquidado: 0,
        despesaPago: 0,
        planosTransferegov: 0,
        parlamentaresTransferegov: new Set(),
        transferegovValor: 0,
      };
      map.set(key, acc);
    }
    return acc;
  };

  for (const a of alocacoes) {
    const acc = getAcc(a.localidade_gasto);
    acc.emendas.add(a.codigo_emenda);
    acc.valorEmpenhado += Number(a.valor_empenhado ?? 0);
    acc.valorLiquidado += Number(a.valor_liquidado ?? 0);
    acc.valorPago += Number(a.valor_pago ?? 0);
  }

  for (const d of despesas) {
    const acc = getAcc(d.municipio?.trim() ? d.municipio : UF_BUCKET);
    if (d.nome_autor_emenda) acc.autoresDespesa.add(d.nome_autor_emenda);
    acc.despesaEmpenhado += Number(d.valor_empenhado ?? 0);
    acc.despesaLiquidado += Number(d.valor_liquidado ?? 0);
    acc.despesaPago += Number(d.valor_pago ?? 0);
  }

  for (const p of planos) {
    const nome = p.nome_beneficiario?.trim();
    if (!nome) continue;
    const acc = getAcc(
      nome === "ESTADO DA PARAIBA" ? UF_BUCKET : normalizeBeneficiario(nome),
    );
    acc.planosTransferegov += 1;
    if (p.nome_parlamentar) acc.parlamentaresTransferegov.add(p.nome_parlamentar);
    acc.transferegovValor +=
      Number(p.valor_custeio ?? 0) + Number(p.valor_investimento ?? 0);
  }

  const items = Array.from(map.values())
    .map((m) => ({
      localidade: m.localidade,
      quantidadeEmendas: m.emendas.size,
      valorEmpenhado: m.valorEmpenhado,
      valorLiquidado: m.valorLiquidado,
      valorPago: m.valorPago,
      autoresDespesa: m.autoresDespesa.size,
      despesaEmpenhado: m.despesaEmpenhado,
      despesaLiquidado: m.despesaLiquidado,
      despesaPago: m.despesaPago,
      planosTransferegov: m.planosTransferegov,
      parlamentaresTransferegov: m.parlamentaresTransferegov.size,
      transferegovValor: m.transferegovValor,
    }))
    .sort((a, b) =>
      Math.max(b.valorEmpenhado, b.despesaEmpenhado, b.transferegovValor) -
      Math.max(a.valorEmpenhado, a.despesaEmpenhado, a.transferegovValor),
    );

  res.json({ ano: ano ?? null, items });
});
