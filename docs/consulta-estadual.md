# Consulta de emendas estaduais

A origem estadual usa exclusivamente a carga do ETL `python -m etl.load_pb`, cujo cliente em `etl/pb.py` consulta a API de Dados Abertos da Paraíba (CODATA): `/orcamento/listagem_emendas` e `/orcamento/execucao_emendas`. A API Node.js lê o PostgreSQL; não consulta a CGU para obter emendas estaduais.

## API

- `GET /estaduais/resumo?ano=2024`: indicadores da origem estadual.
- `GET /estaduais/emendas?ano=2024&parlamentar=&beneficiario=&funcao=&orgao=&limit=20&offset=0`: consulta paginada.
- `GET /estaduais/emendas/2024/001`: identidade, destinação, execução por função/órgão e linhas de classificação.
- `GET /estaduais/export/emendas`: CSV de toda a consulta filtrada, sem o limite de paginação.

Sem `ano`, listagem, resumo e exportação abrangem todos os exercícios carregados. `limit` é limitado a 200. Valores de texto usam busca sem distinção de maiúsculas; órgão aceita nome ou código exato. Função e órgão devem corresponder à mesma linha de execução. O filtro `municipio` é rejeitado na API estadual: o esquema atual tem beneficiário, sem município estruturado.

## Identidade e valores

A ligação é por **ano e número da emenda**, incluindo zeros iniciais. Números iguais em exercícios distintos permanecem separados. A identidade de uma emenda não deve ser inferida apenas pelo número.

O valor destinado é lido uma vez da listagem. Ele não é somado a cada linha da execução. Os totais empenhado/liquidado/pago são somas das linhas de execução associadas. Os filtros de função e órgão restringem os totais da listagem ao recorte correspondente; o detalhe mostra todas as linhas da emenda.

- Zero informado permanece zero.
- Ausência de valor permanece `null`.
- Somatórios com campos ausentes informam quantas linhas não têm valor.
- Emendas sem execução vinculada são contabilizadas separadamente.
- O resumo exclui linhas de execução sem identidade correspondente na listagem e informa sua quantidade.
- Percentuais e diferenças não são apresentados quando os valores necessários estão ausentes ou parciais; o percentual do painel também exige execução vinculada para todas as emendas do recorte.

As linhas da execução podem ter várias classificações por emenda. A consulta conserva o grão armazenado pelo ETL, sem eliminar linhas por uma chave presumida ou somar `valor_emenda` repetido na execução. Os totais não certificam conciliação documental.

## Interface

Visão geral e consulta têm o seletor **Origem da emenda**, com Federal (CGU) e Estadual (CODATA). Origem, exercício e filtros ficam na URL. A navegação preserva a origem, e o retorno do detalhe preserva filtros e paginação. A página de fontes também permite consultar a cobertura estadual por exercício.

O RF-08 estadual aparece como **não avaliável**, pois a carga atual contém execução agregada e não documentos individualizados de empenho, liquidação e pagamento. Não se atribui zero ou 100% por mera presença de valores financeiros. A visão territorial de municípios continua usando as fontes federais; beneficiários estaduais não são transformados em municípios por comparação textual.

## Verificação

- `npm test` em `backend`: filtros combinados, identidade anual, paginação, exportação, valores ausentes/zero e resumo com correspondências incompletas.
- `npm run build`, `npm run lint` e `npm run test:ui` em `frontend`: compilação e renderização das telas de ambas as origens.
- `node scripts/verify-state-db.mjs` em `backend`, após o build: consultas somente de leitura nos endpoints usando o PostgreSQL local.

A verificação real encontrou 2.887 emendas na listagem e 2.869 linhas de execução armazenadas em 12/10/2026. Esses números são um registro da validação, não valores fixos na interface.
