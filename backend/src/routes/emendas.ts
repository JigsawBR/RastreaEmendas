import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { pbLocalidadeFilter } from "../lib/filters.js";

export const emendasRouter = Router();

// GET /emendas?ano=&parlamentar=&municipio=&funcao=&limit=&offset=
// Lista emendas com filtros. RF-02.
emendasRouter.get("/", async (req, res) => {
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
      include: {
        emenda_alocacao: { where: alocacaoWhere },
      },
    }),
  ]);

  const items = rows.map((e) => {
    let empenhado = 0, liquidado = 0, pago = 0;
    const localidades = new Set<string>();
    const funcoes = new Set<string>();
    for (const a of e.emenda_alocacao) {
      empenhado += Number(a.valor_empenhado ?? 0);
      liquidado += Number(a.valor_liquidado ?? 0);
      pago += Number(a.valor_pago ?? 0);
      if (a.localidade_gasto) localidades.add(a.localidade_gasto);
      if (a.funcao) funcoes.add(a.funcao);
    }
    return {
      codigoEmenda: e.codigo_emenda,
      ano: e.ano,
      tipoEmenda: e.tipo_emenda,
      numeroEmenda: e.numero_emenda,
      nomeAutor: e.nome_autor,
      autor: e.autor,
      localidades: Array.from(localidades),
      funcoes: Array.from(funcoes),
      valorEmpenhado: empenhado,
      valorLiquidado: liquidado,
      valorPago: pago,
    };
  });

  res.json({ total, limit, offset, items });
});

// GET /emendas/:codigo
emendasRouter.get("/:codigo", async (req, res) => {
  const codigo = req.params.codigo;
  const emenda = await prisma.emenda.findUnique({
    where: { codigo_emenda: codigo },
    include: { emenda_alocacao: true },
  });
  if (!emenda) return res.status(404).json({ error: "emenda_nao_encontrada" });

  let empenhado = 0, liquidado = 0, pago = 0, restoInscrito = 0;
  for (const a of emenda.emenda_alocacao) {
    empenhado += Number(a.valor_empenhado ?? 0);
    liquidado += Number(a.valor_liquidado ?? 0);
    pago += Number(a.valor_pago ?? 0);
    restoInscrito += Number(a.valor_resto_inscrito ?? 0);
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
    alocacoes: emenda.emenda_alocacao.map((a) => ({
      localidadeGasto: a.localidade_gasto,
      funcao: a.funcao,
      subfuncao: a.subfuncao,
      valorEmpenhado: Number(a.valor_empenhado ?? 0),
      valorLiquidado: Number(a.valor_liquidado ?? 0),
      valorPago: Number(a.valor_pago ?? 0),
      valorRestoInscrito: Number(a.valor_resto_inscrito ?? 0),
    })),
  });
});

// GET /emendas/:codigo/cadeia
// RF-03: documentos por estagio (empenho, liquidacao, pagamento).
emendasRouter.get("/:codigo/cadeia", async (req, res) => {
  const codigo = req.params.codigo;
  const documentos = await prisma.documento_despesa.findMany({
    where: { codigo_emenda: codigo },
    orderBy: [{ estagio: "asc" }, { data: "asc" }],
  });

  const porEstagio: Record<string, typeof documentos> = {};
  for (const d of documentos) {
    const key = d.estagio ?? "Sem estagio";
    (porEstagio[key] ??= []).push(d);
  }

  res.json({
    codigoEmenda: codigo,
    totalDocumentos: documentos.length,
    estagios: Object.entries(porEstagio).map(([estagio, docs]) => ({
      estagio,
      quantidade: docs.length,
      valorTotal: docs.reduce(
        (sum, d) => sum + Number(d.valor_empenhado ?? d.valor_pago ?? 0),
        0,
      ),
      documentos: docs.map((d) => ({
        codigoDocumento: d.codigo_documento,
        codigoDocumentoResumido: d.codigo_documento_resumido,
        data: d.data,
        especieTipo: d.especie_tipo,
        orgaoExecutor: d.orgao_executor,
        funcao: d.funcao,
        valorEmpenhado: d.valor_empenhado ? Number(d.valor_empenhado) : null,
        valorPago: d.valor_pago ? Number(d.valor_pago) : null,
      })),
    })),
  });
});

// GET /emendas/:codigo/distribuicao
// RF-04: distribuicao por funcao e por orgao executor.
emendasRouter.get("/:codigo/distribuicao", async (req, res) => {
  const codigo = req.params.codigo;
  const alocacoes = await prisma.emenda_alocacao.findMany({
    where: { codigo_emenda: codigo },
  });
  const documentos = await prisma.documento_despesa.findMany({
    where: { codigo_emenda: codigo },
  });

  const porFuncao = new Map<string, { empenhado: number; liquidado: number; pago: number }>();
  for (const a of alocacoes) {
    const key = a.funcao || "Nao classificada";
    const acc = porFuncao.get(key) ?? { empenhado: 0, liquidado: 0, pago: 0 };
    acc.empenhado += Number(a.valor_empenhado ?? 0);
    acc.liquidado += Number(a.valor_liquidado ?? 0);
    acc.pago += Number(a.valor_pago ?? 0);
    porFuncao.set(key, acc);
  }

  const porOrgao = new Map<string, { quantidade: number; empenhado: number; pago: number }>();
  for (const d of documentos) {
    const key = d.orgao_executor ?? "Sem UG";
    const acc = porOrgao.get(key) ?? { quantidade: 0, empenhado: 0, pago: 0 };
    acc.quantidade += 1;
    acc.empenhado += Number(d.valor_empenhado ?? 0);
    acc.pago += Number(d.valor_pago ?? 0);
    porOrgao.set(key, acc);
  }

  res.json({
    codigoEmenda: codigo,
    porFuncao: Array.from(porFuncao.entries())
      .map(([funcao, v]) => ({ funcao, ...v }))
      .sort((a, b) => b.empenhado - a.empenhado),
    porOrgao: Array.from(porOrgao.entries())
      .map(([orgaoExecutor, v]) => ({ orgaoExecutor, ...v }))
      .sort((a, b) => b.empenhado - a.empenhado),
  });
});

// GET /emendas/:codigo/rastreabilidade
// RF-08: indicador de completude da cadeia.
// Formula: 5 criterios binarios. Score = atendidos / 5.
// 1) tem documento de Empenho     2) tem Liquidacao     3) tem Pagamento
// 4) tem funcao preenchida        5) tem orgao executor
emendasRouter.get("/:codigo/rastreabilidade", async (req, res) => {
  const codigo = req.params.codigo;
  const documentos = await prisma.documento_despesa.findMany({
    where: { codigo_emenda: codigo },
  });
  const alocacoes = await prisma.emenda_alocacao.findMany({
    where: { codigo_emenda: codigo },
  });

  const temEmpenho = documentos.some((d) => d.estagio === "Empenho");
  const temLiquidacao = documentos.some((d) => d.estagio === "Liquidação");
  const temPagamento = documentos.some((d) => d.estagio === "Pagamento");
  const temFuncao = alocacoes.some((a) => a.funcao && a.funcao.trim() !== "");
  const temOrgao = documentos.some((d) => d.orgao_executor && d.orgao_executor.trim() !== "");

  const criterios = [
    { nome: "empenho", atendido: temEmpenho },
    { nome: "liquidacao", atendido: temLiquidacao },
    { nome: "pagamento", atendido: temPagamento },
    { nome: "funcao", atendido: temFuncao },
    { nome: "orgao_executor", atendido: temOrgao },
  ];
  const atendidos = criterios.filter((c) => c.atendido).length;

  res.json({
    codigoEmenda: codigo,
    score: atendidos / criterios.length,
    atendidos,
    total: criterios.length,
    criterios,
  });
});
