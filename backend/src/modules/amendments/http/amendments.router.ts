import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../../shared/infrastructure/database/prisma.js";
import {
  executorFilter,
  pbLocalidadeFilter,
} from "../infrastructure/amendment-filters.js";

export const amendmentsRouter = Router();

// RF-02: lista emendas com filtros.
amendmentsRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const parlamentar = req.query.parlamentar as string | undefined;
  const municipio = req.query.municipio as string | undefined;
  const funcao = req.query.funcao as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const alocacaoWhere: Prisma.emenda_alocacaoWhereInput = {
    ...pbLocalidadeFilter(),
    ...(municipio ? { localidade_gasto: { contains: municipio, mode: "insensitive" } } : {}),
    ...(funcao ? { funcao: { contains: funcao, mode: "insensitive" } } : {}),
  };

  const where: Prisma.emendaWhereInput = {
    ...await executorFilter(req.query.orgao as string | undefined),
    ...(ano ? { ano } : {}),
    ...(parlamentar ? { nome_autor: { contains: parlamentar, mode: "insensitive" } } : {}),
    emenda_alocacao: { some: alocacaoWhere },
  };

  const [total, rows] = await Promise.all([
    prisma.emenda.count({ where }),
    prisma.emenda.findMany({
      where,
      orderBy: [{ ano: "desc" }, { codigo_emenda: "asc" }],
      take: limit,
      skip: offset,
      include: { emenda_alocacao: { where: alocacaoWhere } },
    }),
  ]);

  const items = rows.map((emenda) => {
    let empenhado = 0;
    let liquidado = 0;
    let pago = 0;
    const localidades = new Set<string>();
    const funcoes = new Set<string>();

    for (const alocacao of emenda.emenda_alocacao) {
      empenhado += Number(alocacao.valor_empenhado ?? 0);
      liquidado += Number(alocacao.valor_liquidado ?? 0);
      pago += Number(alocacao.valor_pago ?? 0);
      if (alocacao.localidade_gasto) localidades.add(alocacao.localidade_gasto);
      if (alocacao.funcao) funcoes.add(alocacao.funcao);
    }

    return {
      codigoEmenda: emenda.codigo_emenda,
      ano: emenda.ano,
      tipoEmenda: emenda.tipo_emenda,
      numeroEmenda: emenda.numero_emenda,
      nomeAutor: emenda.nome_autor,
      autor: emenda.autor,
      localidades: Array.from(localidades),
      funcoes: Array.from(funcoes),
      valorEmpenhado: empenhado,
      valorLiquidado: liquidado,
      valorPago: pago,
    };
  });

  res.json({ total, limit, offset, items });
});

amendmentsRouter.get("/:codigo", async (req, res) => {
  const emenda = await prisma.emenda.findUnique({
    where: { codigo_emenda: req.params.codigo },
    include: { emenda_alocacao: true },
  });
  if (!emenda) return res.status(404).json({ error: "emenda_nao_encontrada" });

  let empenhado = 0;
  let liquidado = 0;
  let pago = 0;
  let restoInscrito = 0;
  for (const alocacao of emenda.emenda_alocacao) {
    empenhado += Number(alocacao.valor_empenhado ?? 0);
    liquidado += Number(alocacao.valor_liquidado ?? 0);
    pago += Number(alocacao.valor_pago ?? 0);
    restoInscrito += Number(alocacao.valor_resto_inscrito ?? 0);
  }

  res.json({
    codigoEmenda: emenda.codigo_emenda,
    ano: emenda.ano,
    tipoEmenda: emenda.tipo_emenda,
    numeroEmenda: emenda.numero_emenda,
    nomeAutor: emenda.nome_autor,
    autor: emenda.autor,
    valorEmpenhado: empenhado,
    valorLiquidado: liquidado,
    valorPago: pago,
    valorRestoInscrito: restoInscrito,
    alocacoes: emenda.emenda_alocacao.map((alocacao) => ({
      localidadeGasto: alocacao.localidade_gasto,
      funcao: alocacao.funcao,
      subfuncao: alocacao.subfuncao,
      valorEmpenhado: Number(alocacao.valor_empenhado ?? 0),
      valorLiquidado: Number(alocacao.valor_liquidado ?? 0),
      valorPago: Number(alocacao.valor_pago ?? 0),
      valorRestoInscrito: Number(alocacao.valor_resto_inscrito ?? 0),
    })),
  });
});
