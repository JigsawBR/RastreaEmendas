import { Router } from "express";
import { prisma } from "../../../../shared/infrastructure/database/prisma.js";
import { parseAmendmentOrder } from "../../../../shared/ordering/amendment-order.js";
import { listAmendments } from "../application/list-amendments.js";

export const amendmentsRouter = Router();

// RF-02: lista emendas com filtros; RF-08 resumido em cada item.
amendmentsRouter.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const ordem = parseAmendmentOrder(req.query.ordem);
  const { total, items } = await listAmendments(
    {
      ano: req.query.ano ? Number(req.query.ano) : undefined,
      parlamentar: req.query.parlamentar as string | undefined,
      municipio: req.query.municipio as string | undefined,
      funcao: req.query.funcao as string | undefined,
      orgao: req.query.orgao as string | undefined,
    },
    ordem,
    { limit, offset },
  );
  res.json({ total, limit, offset, ordem, items });
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
