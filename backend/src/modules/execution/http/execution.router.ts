import { Router } from "express";
import { getManagingUnitNames } from "../../organizations/application/get-managing-unit-names.js";
import { prisma } from "../../../shared/infrastructure/database/prisma.js";
import { listFundingDestinations } from "../application/list-funding-destinations.js";

export const executionRouter = Router();

// RF-03: documentos por estágio (empenho, liquidação e pagamento).
executionRouter.get("/:codigo/cadeia", async (req, res) => {
  const codigo = req.params.codigo;
  const documentos = await prisma.documento_despesa.findMany({
    where: { codigo_emenda: codigo },
    orderBy: [{ estagio: "asc" }, { data: "asc" }],
  });

  const porEstagio: Record<string, typeof documentos> = {};
  for (const documento of documentos) {
    const estagio = documento.estagio ?? "Sem estagio";
    (porEstagio[estagio] ??= []).push(documento);
  }

  const nomesUg = await getManagingUnitNames(documentos.map((documento) => documento.orgao_executor));

  res.json({
    codigoEmenda: codigo,
    totalDocumentos: documentos.length,
    estagios: Object.entries(porEstagio).map(([estagio, docs]) => ({
      estagio,
      quantidade: docs.length,
      valorTotal: docs.reduce(
        (sum, documento) => sum + Number(documento.valor_empenhado ?? documento.valor_pago ?? 0),
        0,
      ),
      documentos: docs.map((documento) => ({
        codigoDocumento: documento.codigo_documento,
        codigoDocumentoResumido: documento.codigo_documento_resumido,
        data: documento.data,
        especieTipo: documento.especie_tipo,
        orgaoExecutor: documento.orgao_executor,
        nomeOrgaoExecutor: documento.orgao_executor
          ? nomesUg.get(documento.orgao_executor) ?? null
          : null,
        funcao: documento.funcao,
        observacao: documento.observacao,
        programa: documento.programa,
        acao: documento.acao,
        nomeFavorecido: documento.nome_favorecido,
        valorDocumento: documento.valor_documento ? Number(documento.valor_documento) : null,
        valorEmpenhado: documento.valor_empenhado ? Number(documento.valor_empenhado) : null,
        valorPago: documento.valor_pago ? Number(documento.valor_pago) : null,
      })),
    })),
  });
});

// RF-04: distribuição por função e órgão executor.
executionRouter.get("/:codigo/distribuicao", async (req, res) => {
  const codigo = req.params.codigo;
  const [alocacoes, documentos] = await Promise.all([
    prisma.emenda_alocacao.findMany({ where: { codigo_emenda: codigo } }),
    prisma.documento_despesa.findMany({ where: { codigo_emenda: codigo } }),
  ]);

  const porFuncao = new Map<string, { empenhado: number; liquidado: number; pago: number }>();
  for (const alocacao of alocacoes) {
    const funcao = alocacao.funcao || "Nao classificada";
    const total = porFuncao.get(funcao) ?? { empenhado: 0, liquidado: 0, pago: 0 };
    total.empenhado += Number(alocacao.valor_empenhado ?? 0);
    total.liquidado += Number(alocacao.valor_liquidado ?? 0);
    total.pago += Number(alocacao.valor_pago ?? 0);
    porFuncao.set(funcao, total);
  }

  const porOrgao = new Map<string, { quantidade: number; empenhado: number; pago: number }>();
  for (const documento of documentos) {
    const orgao = documento.orgao_executor ?? "Sem UG";
    const total = porOrgao.get(orgao) ?? { quantidade: 0, empenhado: 0, pago: 0 };
    total.quantidade += 1;
    total.empenhado += Number(documento.valor_empenhado ?? 0);
    total.pago += Number(documento.valor_pago ?? 0);
    porOrgao.set(orgao, total);
  }

  const nomesUg = await getManagingUnitNames([...porOrgao.keys()]);
  res.json({
    codigoEmenda: codigo,
    porFuncao: Array.from(porFuncao.entries())
      .map(([funcao, valores]) => ({ funcao, ...valores }))
      .sort((a, b) => b.empenhado - a.empenhado),
    porOrgao: Array.from(porOrgao.entries())
      .map(([orgaoExecutor, valores]) => ({
        orgaoExecutor,
        nomeOrgao: nomesUg.get(orgaoExecutor) ?? null,
        ...valores,
      }))
      .sort((a, b) => b.empenhado - a.empenhado),
  });
});

executionRouter.get("/:codigo/destino", async (req, res) => {
  const grupos = await listFundingDestinations({ codigo_emenda: req.params.codigo });
  res.json({
    codigoEmenda: req.params.codigo,
    valorTotal: grupos.reduce((total, grupo) => total + grupo.valor, 0),
    grupos,
  });
});
