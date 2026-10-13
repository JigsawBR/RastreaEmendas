export async function seedDatabase(db) {
  await db.unidade_gestora.create({
    data: { codigo: "999001", nome: "Órgão E2E Federal", uf: "PB" },
  });
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
