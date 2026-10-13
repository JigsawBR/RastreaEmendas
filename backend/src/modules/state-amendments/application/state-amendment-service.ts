import type {
  StateAmendmentRepository,
  StateFilters,
  StateExecution,
  Pagination,
} from "../domain/state-amendment.js";
import {
  groupStateValues,
  stateIdentity,
  sumStateValues,
} from "../domain/state-values.js";
export function createStateAmendmentService(
  repository: StateAmendmentRepository,
) {
  return {
    async list(filters: StateFilters, pagination?: Pagination) {
      const { total, listings, executions } = await repository.list(
        filters,
        pagination,
      );
      const byIdentity = new Map<string, StateExecution[]>();
      for (const row of executions) {
        const key = stateIdentity(row);
        const group = byIdentity.get(key) ?? [];
        group.push(row);
        byIdentity.set(key, group);
      }
      const items = listings.map((row) => {
        const matches = byIdentity.get(stateIdentity(row)) ?? [];
        return {
          codigoEmenda: stateIdentity(row),
          ano: row.ano,
          numeroEmenda: row.numero_emenda,
          tipoEmenda: row.tipo,
          nomeAutor: row.nome_deputado,
          autor: row.nome_deputado,
          beneficiarioFinal: row.beneficiario_final,
          secretaria: row.secretaria,
          objeto: row.objeto,
          valorDestinado: row.valor === null ? null : Number(row.valor),
          localidades: [],
          funcoes: [
            ...new Set(matches.flatMap((e) => (e.funcao ? [e.funcao] : []))),
          ],
          ...sumStateValues(matches),
        };
      });
      return { total, items };
    },
    async summary(ano?: number) {
      const { listings, executions: allExecutions } =
        await repository.summary(ano);
      const identities = new Set(listings.map(stateIdentity));
      const executions = allExecutions.filter((row) =>
        identities.has(stateIdentity(row)),
      );
      const executedIdentities = new Set(executions.map(stateIdentity));
      const totals = sumStateValues(executions);
      return {
        ano: ano ?? null,
        totalEmendas: listings.length,
        totalParlamentares: new Set(
          listings.flatMap((row) =>
            row.nome_deputado ? [row.nome_deputado] : [],
          ),
        ).size,
        totalBeneficiarios: new Set(
          listings.flatMap((row) =>
            row.beneficiario_final ? [row.beneficiario_final] : [],
          ),
        ).size,
        emendasSemExecucao: listings.length - executedIdentities.size,
        linhasSemListagem: allExecutions.length - executions.length,
        valorDestinado: listings.some((row) => row.valor !== null)
          ? listings.reduce((sum, row) => sum + Number(row.valor ?? 0), 0)
          : null,
        ...totals,
        taxaExecucao:
          totals.valorEmpenhado !== null &&
          totals.valorEmpenhado > 0 &&
          totals.valorPago !== null &&
          totals.valoresAusentes.empenhado === 0 &&
          totals.valoresAusentes.pago === 0 &&
          listings.length === executedIdentities.size
            ? totals.valorPago / totals.valorEmpenhado
            : null,
      };
    },
    async detail(ano: number, number: string) {
      const result = await repository.find(ano, number);
      if (!result) return null;
      const { listing, executions: rows } = result;
      return {
        ano,
        numeroEmenda: listing.numero_emenda,
        nomeAutor: listing.nome_deputado,
        tipoEmenda: listing.tipo,
        secretaria: listing.secretaria,
        objeto: listing.objeto,
        beneficiarioFinal: listing.beneficiario_final,
        tipoEntidade: listing.tipo_entidade,
        valorDestinado: listing.valor === null ? null : Number(listing.valor),
        dataEnvio: listing.data_envio,
        ...sumStateValues(rows),
        porFuncao: groupStateValues(rows, "function"),
        porOrgao: groupStateValues(rows, "organization"),
        execucoes: rows.map((row) => ({
          id: row.id,
          codigoOrgao: row.codigo_orgao,
          nomeOrgao: row.nome_orgao,
          funcao: row.funcao,
          subfuncao: row.subfuncao,
          unidadeOrcamentaria: row.unidade_orcamentaria,
          programa: row.programa,
          acao: row.acao,
          naturezaDespesa: row.natureza_despesa,
          valorEmpenhado:
            row.valor_empenhado === null ? null : Number(row.valor_empenhado),
          valorLiquidado:
            row.valor_liquidado === null ? null : Number(row.valor_liquidado),
          valorPago: row.valor_pago === null ? null : Number(row.valor_pago),
        })),
        rastreabilidade: {
          avaliavel: false,
          score: null,
          motivo:
            "A base estadual carregada contém execução agregada, sem documentos individualizados das três fases para aplicar o RF-08.",
        },
      };
    },
  };
}
export type StateAmendmentService = ReturnType<
  typeof createStateAmendmentService
>;
