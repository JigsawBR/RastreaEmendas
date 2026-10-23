import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const summary = {
  ano: 2024,
  totalEmendas: 1,
  totalParlamentares: 1,
  totalLocalidades: 1,
  valorEmpenhado: 1000000,
  valorLiquidado: 750000,
  valorPago: 600000,
  valorRestoInscrito: 0,
  taxaExecucao: 0.6,
};
const item = {
  codigoEmenda: "20240001",
  numeroEmenda: "001",
  ano: 2024,
  nomeAutor: "Parlamentar de teste",
  tipoEmenda: "Individual",
  localidades: ["João Pessoa - PB"],
  funcoes: ["Saúde"],
  valorEmpenhado: 1000000,
  valorLiquidado: 750000,
  valorPago: 600000,
  rastreabilidade: { atendidos: 4, total: 5 },
};
async function render(module, url, populate) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  populate(client);
  const { default: Component } = await server.ssrLoadModule(module);
  const output = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        { initialEntries: [url] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: module.includes("StateAmendmentDetail")
              ? "/emendas-estaduais/:ano/:numero"
              : module.includes("AmendmentDetail")
                ? "/emendas/:codigo"
                : "*",
            element: React.createElement(Component),
          }),
        ),
      ),
    ),
  );
  assert.ok(!output.includes("NaN"), "Valores não podem produzir NaN");
  client.clear();
  return output;
}
try {
  const { quantileBreaks, classOf, classLabels } = await server.ssrLoadModule("/src/features/territory/scale.ts");
  const evenly = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.deepEqual(quantileBreaks(evenly), [30, 50, 70, 90], "quintis ignoram zero");
  assert.deepEqual([0, 10, 30, 100].map((v) => classOf(v, [30, 50, 70, 90])), [0, 1, 2, 5]);
  assert.deepEqual(quantileBreaks([5, 5, 5, 5, 9]), [9], "valores repetidos fundem faixas");
  assert.equal(classLabels([5, 5, 5, 5, 9], [9]).length, 2);
  assert.deepEqual(quantileBreaks([0, 0]), []);
  assert.deepEqual(classLabels([0], []), []);
  const home = await render("/src/pages/Home.tsx", "/?ano=2024", (c) =>
    c.setQueryData(["resumo", "federal", 2024], summary),
  );
  assert.match(home, /Do compromisso ao pagamento/);
  assert.match(home, /60,0%/, "percentual no formato brasileiro");
  assert.ok(home.includes("/emendas?ano=2024"));
  const zero = await render("/src/pages/Home.tsx", "/?ano=2024", (c) =>
    c.setQueryData(["resumo", "federal", 2024], {
      ...summary,
      valorEmpenhado: 0,
    }),
  );
  assert.match(zero, /empenhado zero/);
  const empty = await render("/src/pages/Home.tsx", "/?ano=2024", (c) =>
    c.setQueryData(["resumo", "federal", 2024], {
      ...summary,
      totalEmendas: 0,
    }),
  );
  assert.match(empty, /não comprova ausência/);
  const list = await render(
    "/src/pages/EmendasList.tsx",
    "/emendas?ano=2024&municipio=Jo%C3%A3o+Pessoa&pagina=2",
    (c) => {
      c.setQueryData(
        [
          "emendas",
          "federal",
          {
            ano: 2024,
            municipio: "João Pessoa",
            parlamentar: undefined,
            funcao: undefined,
            orgao: undefined,
            limit: 20,
            offset: 20,
          },
        ],
        { items: [item], total: 41, limit: 20, offset: 20 },
      );
      c.setQueryData(["resumo", "federal", 2024], summary);
    },
  );
  assert.match(list, /João Pessoa/);
  assert.match(list, /Página 2 de 3/);
  assert.match(list, /Exportar CSV/);
  assert.match(list, /COMPLETUDE/);
  assert.match(list, /4\/5/, "selo do RF-08 na lista");
  assert.match(list, /Ordenar por/);
  assert.ok(list.includes("001 / 2024"));
  const sorted = await render(
    "/src/pages/EmendasList.tsx",
    "/emendas?ano=2024&ordem=rastreabilidade",
    (c) => {
      c.setQueryData(
        ["emendas", "federal", { ano: 2024, ordem: "rastreabilidade", limit: 20, offset: 0 }],
        { items: [item], total: 1, limit: 20, offset: 0 },
      );
      c.setQueryData(["resumo", "federal", 2024], summary);
    },
  );
  assert.ok(sorted.includes('<option value="rastreabilidade" selected="">'), "ordem vem da URL");
  assert.match(sorted, /1 emendas encontradas/, "a consulta foi feita com a ordem da URL");
  const detail = await render(
    "/src/features/federal-amendments/pages/AmendmentDetail.tsx",
    {
      pathname: "/emendas/20240001",
      state: {
        backTo: "/emendas?ano=2024&municipio=Jo%C3%A3o+Pessoa&pagina=2",
      },
    },
    (c) => {
      c.setQueryData(["emenda", "20240001"], {
        ...item,
        alocacoes: [],
        valorRestoInscrito: 0,
      });
      c.setQueryData(["cadeia", "20240001"], {
        totalDocumentos: 1,
        estagios: ["Empenho", "Liquidação", "Pagamento"].map((estagio) => ({
          estagio,
          quantidade: estagio === "Pagamento" ? 1 : 0,
          documentos:
            estagio === "Pagamento"
              ? [
                  {
                    codigoDocumento: "000001000012024OB000001",
                    valorDocumento: null,
                    data: null,
                    orgaoExecutor: null,
                    nomeOrgaoExecutor: null,
                    nomeFavorecido: null,
                  },
                ]
              : [],
        })),
      });
      c.setQueryData(["dist", "20240001"], { porFuncao: [], porOrgao: [] });
      c.setQueryData(["rastr", "20240001"], {
        score: 0.2,
        atendidos: 1,
        total: 5,
        criterios: [
          { nome: "pagamento", atendido: true },
          { nome: "orgao_executor", atendido: false },
        ],
      });
    },
  );
  assert.match(detail, /Liquidação/);
  assert.match(detail, /Não informado/);
  assert.match(detail, /soma parcial/);
  assert.match(detail, /Órgão executor/);
  assert.ok(detail.includes("municipio=Jo%C3%A3o+Pessoa"));
  assert.match(detail, /Emenda 001 · Parlamentar de teste/, "título identifica o autor");
  assert.ok(!detail.includes("Por que os valores pagos diferem"), "sem valor nos documentos não há comparação");
  const gap = await render(
    "/src/features/federal-amendments/pages/AmendmentDetail.tsx",
    "/emendas/20240001",
    (c) => {
      c.setQueryData(["emenda", "20240001"], { ...item, alocacoes: [], valorRestoInscrito: 0 });
      c.setQueryData(["cadeia", "20240001"], {
        totalDocumentos: 1,
        estagios: ["Empenho", "Liquidação", "Pagamento"].map((estagio) => ({
          estagio,
          quantidade: estagio === "Pagamento" ? 1 : 0,
          documentos: estagio === "Pagamento"
            ? [{ codigoDocumento: "1", valorDocumento: 900000, data: null, orgaoExecutor: null, nomeOrgaoExecutor: null, nomeFavorecido: null }]
            : [],
        })),
      });
    },
  );
  assert.match(gap, /Por que os valores pagos diferem/);
  assert.match(gap, /R\$\s600\.000,00 pagos/);
  assert.match(gap, /somam R\$\s900\.000,00/);
  const sources = await render(
    "/src/pages/DataSources.tsx",
    "/sobre-os-dados",
    (c) =>
      c.setQueryData(
        ["source-coverage", "federal"],
        [2023, 2024, 2025, 2026].map((year) => ({ year, summary })),
      ),
  );
  assert.match(sources, /Preparar atualização/);
  assert.match(sources, /não inicia uma carga no servidor/);
  assert.match(sources, /data não registrada/);

  const stateSummary = {
    ...summary,
    totalBeneficiarios: 1,
    emendasSemExecucao: 1,
    linhasSemListagem: 0,
    valorDestinado: 1000000,
    valorPago: null,
    valorLiquidado: null,
    valoresAusentes: { empenhado: 1, liquidado: 1, pago: 1 },
    totalLinhasExecucao: 1,
  };
  const stateHome = await render(
    "/src/pages/Home.tsx",
    "/?ano=2024&origem=estadual",
    (c) => c.setQueryData(["resumo", "estadual", 2024], stateSummary),
  );
  assert.match(stateHome, /Fonte: CODATA/);
  assert.match(stateHome, /Não informado/);
  assert.match(stateHome, /dados ausentes ou parciais/);
  assert.ok(stateHome.includes("origem=estadual"));
  assert.ok(!stateHome.includes("Explorar o destino dos pagamentos"));
  const stateItem = {
    ...item,
    numeroEmenda: "0001/2024",
    localidades: [],
    rastreabilidade: { atendidos: null, total: 5 },
    beneficiarioFinal: "Hospital de teste",
    secretaria: "Saúde",
    objeto: "Objeto",
    valorDestinado: 1000,
    valorPago: null,
    valoresAusentes: { empenhado: 0, liquidado: 0, pago: 1 },
    totalLinhasExecucao: 1,
  };
  const stateList = await render(
    "/src/pages/EmendasList.tsx",
    "/emendas?origem=estadual&ano=2024&beneficiario=Hospital",
    (c) => {
      c.setQueryData(
        [
          "emendas",
          "estadual",
          {
            ano: 2024,
            parlamentar: undefined,
            beneficiario: "Hospital",
            funcao: undefined,
            orgao: undefined,
            limit: 20,
            offset: 0,
          },
        ],
        { items: [stateItem], total: 1, limit: 20, offset: 0 },
      );
      c.setQueryData(["resumo", "estadual", 2024], stateSummary);
    },
  );
  assert.match(stateList, /DESTINO/);
  assert.match(stateList, /Município beneficiado/);
  assert.match(stateList, /Hospital de teste/, "sem transferência a município, mostra o beneficiário");
  assert.match(stateList, /Não avaliável/, "RF-08 estadual sem documentos importados");
  assert.match(stateList, /Emenda 0001\/2024</, "número estadual não repete o ano");
  assert.ok(!stateList.includes("0001/2024 / 2024"));
  assert.match(stateList, /Não informado/);
  assert.ok(stateList.includes("/emendas-estaduais/2024/0001%2F2024"));
  assert.ok(stateList.includes("/api/estaduais/export/emendas"));
  assert.ok(!stateList.includes("Nome da localidade"));
  const stateDetail = await render(
    "/src/features/state-amendments/pages/StateAmendmentDetail.tsx",
    {
      pathname: "/emendas-estaduais/2024/001",
      state: {
        backTo: "/emendas?origem=estadual&beneficiario=Hospital&pagina=2",
      },
    },
    (c) =>
      c.setQueryData(["state-amendment", "2024", "001"], {
        ...stateItem,
        ano: 2024,
        numeroEmenda: "001",
        execucoes: [],
        porFuncao: [],
        porOrgao: [],
        municipiosBeneficiados: ["Cajazeiras"],
        destinos: [
          { credor: "PREFEITURA MUNICIPAL DE CAJAZEIRAS", documentoCredor: "1", modalidadeAplicacao: "40",
            destino: "municipal_transfer", destinoRotulo: "Transferência ao município", municipioCredor: "Cajazeiras",
            municipioBeneficiado: "Cajazeiras", codigoIbge: "2503704", valorEmpenhadoLiquido: 100, notas: 1 },
          { credor: "ASSOCIAÇÃO", documentoCredor: "2", modalidadeAplicacao: "50",
            destino: "private_nonprofit", destinoRotulo: "Entidade privada sem fins lucrativos", municipioCredor: "João Pessoa",
            municipioBeneficiado: null, codigoIbge: null, valorEmpenhadoLiquido: 50, notas: 2 },
        ],
        rastreabilidade: {
          avaliavel: false,
          score: null,
          motivo: "Execução agregada sem documentos individualizados.",
        },
      }),
  );
  assert.match(stateDetail, /RF-08 · não avaliável/);
  assert.match(stateDetail, /Execução agregada sem documentos/);
  assert.match(stateDetail, /Não calculável/);
  assert.ok(stateDetail.includes("beneficiario=Hospital&amp;pagina=2"));
  assert.match(stateDetail, /Município beneficiado:<\/strong> Cajazeiras/);
  assert.match(stateDetail, /Sede do credor, não município beneficiado/);
  const stateCoverage = await render(
    "/src/pages/DataSources.tsx",
    "/sobre-os-dados?origem=estadual",
    (c) =>
      c.setQueryData(
        ["source-coverage", "estadual"],
        [2023, 2024, 2025, 2026].map((year) => ({
          year,
          summary: stateSummary,
        })),
      ),
  );
  assert.match(stateCoverage, /Cobertura da consulta estadual/);
  assert.ok(stateCoverage.includes("origem=estadual"));
  assert.ok(!stateCoverage.includes("integração às telas de consulta ainda"));

  console.log(
    "Verificação da interface: visão geral, consulta, detalhe, fontes e estados de dados passaram.",
  );
} finally {
  await server.close();
}
