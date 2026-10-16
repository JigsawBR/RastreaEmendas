export async function seedDatabase(db) {
  const collectedAt = new Date("2026-10-15T12:00:00Z");
  await db.evidence_import.create({ data: { origin: "state", year: 2024, source: "pb_agreements", source_count: 10, evidence_count: 2, collected_at: collectedAt, scope: "Convênios 2024; referência explícita à emenda e exercício." } });
  await db.evidence_import.createMany({ data: [
    { origin: "state", year: 2024, source: "pb_objects", source_count: 23, evidence_count: 1, collected_at: collectedAt, scope: "Objetos da listagem; extração local de CNPJ." },
    { origin: "federal", year: 2024, source: "transferegov_specials", source_count: 3, evidence_count: 1, collected_at: collectedAt, scope: "Plano E2E previamente vinculado ao código completo da emenda." },
  ] });
  await db.amendment_evidence.createMany({ data: [
    { id: "evidence-state-confirmed", origin: "state", year: 2024, amendment_number: "4", source: "pb_agreements", kind: "agreement", status: "confirmed", title: "Termo E2E 0001/2024", source_url: "https://api.dados.pb.gov.br/api/v1/convenios/estado_municipios?ano=2024", collected_at: collectedAt, match_basis: "Referência explícita à emenda 4/2024", payload: { nome: "Instituto E2E Convenente", papel: "convenente", municipio: "Cajazeiras", documentoUrl: "https://example.gov.br/termo.pdf", observacao: "Instrumento não comprova entrega." } },
    { id: "evidence-state-candidate", origin: "state", year: 2024, amendment_number: "4", source: "pb_objects", kind: "beneficiary", status: "candidate", title: "Entidade E2E citada no objeto", source_url: "https://api.dados.pb.gov.br/api/v1/orcamento/listagem_emendas?ano=2024", collected_at: collectedAt, match_basis: "CNPJ extraído do texto", payload: { trecho: "Entidade E2E com papel pendente de confirmação", documentoUrl: "javascript:alert(1)" } },
    { id: "evidence-federal-declared", origin: "federal", year: 2024, amendment_number: "202499900001", source: "transferegov_specials", kind: "local_payment", status: "declared", title: "Despesa local E2E declarada", source_url: "https://api-publica.transferegov.gestao.gov.br/especiais/docs", collected_at: collectedAt, match_basis: "Relatório → plano → código completo da emenda", payload: { nome: "Fornecedor E2E Local", papel: "recebedor_declarado", valorMovimento: 200, observacao: "Declaração não certifica entrega ou aprovação de contas." } },
  ] });
  await db.state_expense_import.createMany({ data: ["commitment", "liquidation", "payment"].map(kind => ({
    year: 2024, month: 12, kind, source_count: 10, linked_count: 1, collected_at: collectedAt,
  })) });
  await db.state_expense_document.createMany({ data: [
    { kind: "commitment", link_status: "confirmed", payload: { numeroEmpenho: 42, descricaoTipo: "PRINCIPAL", valorCalculado: 100, nomeMunicipio: "João Pessoa", nomeOrgao: "Órgão E2E Estadual", nomeFuncao: "Saúde", nomeCredor: "Construtora E2E", processo: "Processo E2E", contrato: "Contrato E2E", codigoFonteRecurso: "79900" } },
    { kind: "payment", link_status: "candidate", payload: { numeroEmpenho: 42, numeroDocumento: 123, valorPago: 100, nomeCredor: "Construtora E2E" } },
    { kind: "commitment", link_status: "confirmed", payload: { numeroEmpenho: 43, descricaoTipo: "ANULAÇÃO TOTAL", valorCalculado: -100 } },
  ].map((record, i) => ({ ...record, id: `state-e2e-${i}`, year: 2024, month: 12, amendment_number: "4", source_url: "https://api.dados.pb.gov.br/api/v1/despesas/notas_empenho?ano=2024&mes=12", collected_at: collectedAt })) });
  await db.unidade_gestora.create({
    data: { codigo: "999001", nome: "Órgão E2E Federal", uf: "PB" },
  });
  await db.despesa_mensal.create({ data: { ano_mes: "202406", uf: "PB", municipio: "CAMPINA GRANDE", codigo_autor_emenda: "9990", nome_autor_emenda: "Parlamentar E2E Federal", valor_empenhado: 50, valor_pago: 20 } });
  for (let i = 1; i <= 23; i++) {
    const number = String(i).padStart(4, "0"),
      code = "20249990" + number;
    await db.emenda.create({
      data: {
        codigo_emenda: code,
        ano: 2024,
        numero_emenda: number,
        nome_autor: "Parlamentar E2E Federal",
        tipo_emenda: "Individual",
        emenda_alocacao: {
          create: {
            localidade_gasto: "CAJAZEIRAS - PB",
            funcao: "Saúde",
            subfuncao: "Atenção básica",
            valor_empenhado: 1000,
            valor_liquidado: 700,
            valor_pago: 400,
          },
        },
        documento_despesa: {
          create: (i === 1
            ? ["Empenho", "Liquidação", "Pagamento"]
            : ["Empenho"]
          ).map((stage, j) => ({
            codigo_documento:
              "999001000012024" +
              ["NE", "NL", "OB"][j] +
              String(i).padStart(6, "0"),
            estagio: stage,
            orgao_executor: "999001",
            funcao: "Saúde",
            valor_documento: j === 0 ? 1000 : j === 1 ? 700 : 400,
            data: new Date("2024-06-01"),
            nome_favorecido: "Hospital E2E Federal",
            uf_favorecido: "PB",
          })),
        },
      },
    });
    await db.emenda_estadual.create({
      data: {
        ano: 2024,
        numero_emenda: number,
        nome_deputado: "Parlamentar E2E Estadual",
        beneficiario_final: i === 1 ? "Hospital E2E" : "Associação E2E",
        valor: 5000,
        tipo: "Individual",
        secretaria: "Secretaria E2E",
        objeto: "Objeto E2E",
      },
    });
    if (i !== 2)
      await db.emenda_estadual_execucao.create({
        data: {
          ano: 2024,
          numero_emenda: number,
          codigo_orgao: "100",
          nome_orgao: "Órgão E2E Estadual",
          funcao: "Saúde",
          valor_empenhado: i === 3 ? 0 : 1000,
          valor_liquidado: i === 3 ? 0 : 500,
          valor_pago: i === 3 ? 0 : 300,
        },
      });
  }
  await db.emenda_estadual_execucao.createMany({
    data: [
      {
        ano: 2024,
        numero_emenda: "0001",
        codigo_orgao: "200",
        nome_orgao: "Educação E2E",
        funcao: "Educação",
        valor_empenhado: 2000,
        valor_liquidado: null,
        valor_pago: null,
      },
      {
        ano: 2024,
        numero_emenda: "0999",
        codigo_orgao: "100",
        funcao: "Saúde",
        valor_empenhado: 999999,
        valor_liquidado: 999999,
        valor_pago: 999999,
      },
    ],
  });
  await db.emenda_estadual.create({
    data: {
      ano: 2025,
      numero_emenda: "0001",
      nome_deputado: "Parlamentar E2E Estadual",
      beneficiario_final: "Beneficiário 2025 E2E",
      valor: 7000,
    },
  });
  await db.emenda_estadual_execucao.create({
    data: {
      ano: 2025,
      numero_emenda: "0001",
      valor_empenhado: 7000,
      valor_liquidado: 6000,
      valor_pago: 5000,
    },
  });
}
