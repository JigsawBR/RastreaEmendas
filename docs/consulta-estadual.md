# Consulta de emendas estaduais

A origem estadual usa exclusivamente a carga do ETL `python -m etl.state`, cujo cliente em `etl/state/pb.py` consulta a API de Dados Abertos da Paraíba (CODATA): `/orcamento/listagem_emendas` e `/orcamento/execucao_emendas`. A API Node.js lê o PostgreSQL; não consulta a CGU para obter emendas estaduais.

## Cache e carga

O fluxo é CODATA → JSON bruto → transformação → PostgreSQL. Os arquivos ficam em `data/raw/state/pb/listagem_emendas_<ano>.json` e `data/raw/state/pb/execucao_emendas_<ano>.json`, fora do controle de versão.

- `python -m etl.state --years 2023-2026`: reutiliza os arquivos existentes e coleta os que faltarem.
- `python -m etl.state --years 2023-2026 --refresh`: consulta novamente ambos os endpoints para os exercícios selecionados.

Cada arquivo é substituído de forma atômica após concluir a coleta do endpoint e exercício. Uma falha de rede, paginação incompleta ou escrita mantém o cache anterior e interrompe a respectiva carga. Uma falha posterior na transformação ou no banco permite reprocessar o JSON já salvo. A atualização é independente por endpoint e exercício; os arquivos não formam uma transação conjunta.

Os JSONs preservam os campos e valores dos registros retornados pela fonte. A data de modificação registra quando o arquivo foi salvo; reutilizar o cache não altera essa data. O cache não tem expiração automática nem histórico: use `--refresh` para atualizar os dados. As tabelas continuam sendo `emenda_estadual` e `emenda_estadual_execucao`.

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

O detalhe estadual apresenta o **caminho do recurso público**: fonte orçamentária, autoria, solicitante original, destino, órgão executor, credor, desembolso e entrega. Cada etapa mostra evidências e lacunas. A fonte orçamentária não prova toda a origem da arrecadação; o autor parlamentar não é automaticamente o solicitante; o credor não é automaticamente o beneficiário; o pagamento não comprova entrega física. Solicitante e entrega permanecem sem evidência enquanto não houver uma fonte documental integrada que os comprove.

O RF-08 documental usa cinco critérios com peso de 20 pontos: documento de empenho, documento de liquidação, documento de pagamento, função e órgão identificados. Uma fase exige movimento positivo com vínculo confirmado, sem anulação integral daquele registro. O indicador mede presença de evidências, não saldo líquido, regularidade ou entrega. Com documentos ainda não importados, o score permanece `null`. Com coleta parcial, a interface identifica os meses consultados. Uma fase não localizada não prova ausência de execução. A visão territorial de municípios continua usando as fontes federais; beneficiários estaduais não são transformados em municípios por comparação textual.

## Coleta documental estadual

O cliente usa `https://api.dados.pb.gov.br/api/v1` (substituível por `PB_API_BASE_URL`). Requisições GET reutilizam a sessão com retry exponencial, tratamento de 429 e respeito a Retry-After. Os endpoints mensais são `/despesas/notas_empenho`, `/despesas/liquidacoes` e `/despesas/autorizacoes_pagamento`.

```powershell
# Carga da listagem, execução agregada e documentos, por exercício
.venv/Scripts/python.exe -m etl.state --years 2024-2026 --documents

# Apenas documentos, reutilizando as coletas locais
.venv/Scripts/python.exe -m etl.state.documents --years 2024

# Coleta parcial para investigação ou validação
.venv/Scripts/python.exe -m etl.state.documents --years 2024 --months 12
```

`--months` define um novo snapshot anual e **substitui o escopo documental anterior daquele ano**. Para ampliar novamente a cobertura, rode sem `--months`. Os arquivos mensais já coletados são reutilizados; `--refresh` força a atualização na fonte. A cobertura refere-se somente ao exercício consultado; execuções em anos seguintes não são atribuídas automaticamente a uma emenda anterior.

O `init_db` do ETL cria, sem apagar as tabelas existentes, `state_expense_document` e `state_expense_import`. Após atualizar o código, execute `npm run prisma:generate` em `backend` e uma carga estadual para criar as tabelas antes de reiniciar a API. Uma falha de download não substitui os dados documentais no banco: documentos e metadados do novo snapshot só são gravados em uma transação depois de concluir a coleta. As alterações do esquema são aditivas.

Cada documento mantém URL de origem, data UTC da coleta, fase, vínculo e campos de uma lista permitida. Dados bancários são descartados. Os caches ficam em `data/raw/state/pb`, fora do Git. Duplicatas exatas compartilham um hash; movimentos diferentes são preservados. Não há soma dos documentos com os valores agregados.

### Regras de ligação

- Emenda–nota: número numérico normalizado e exercício, com comparação exata no cliente. `0799/2024` corresponde a `0799` no exercício 2024. Um sufixo de outro ano é rejeitado.
- Nota–liquidação/pagamento: órgão, número do empenho, CPF/CNPJ completo do credor e fonte de recursos devem coincidir. Credor mascarado, chave incompleta e colisões com outra emenda ou com nota sem emenda impedem a atribuição.
- Liquidação: exige também `anoExercicio` compatível para o vínculo confirmado. O valor exibido é `valorEmpenhado`, descrito pelo dicionário como valor empenhado referente à liquidação. `valorGD` não é interpretado como valor liquidado. O total liquidado continua vindo da execução agregada.
- Pagamento: a API documenta o ano do pagamento, sem exercício próprio do empenho. A correspondência contextual é exibida como **candidata**, inclusive quando órgão, empenho, credor e fonte coincidem; não conta como prova de pagamento no RF-08. Restos a pagar podem referenciar outros exercícios.
- Principal, reforço e anulação são movimentos distintos. Valores negativos e tipos descritos como anulação/estorno não comprovam uma fase positiva; não são transformados em saldo disponível ou desembolso.

O detalhe REST acrescenta `trajeto`, `documentos`, `coberturaDocumental` (meses por fase e última coleta) e critérios de `rastreabilidade`. A interface permite filtrar documentos por fase e acessar a consulta oficial de origem.

Na validação inicial de 15/10/2026 foram coletados os três endpoints para **dezembro de 2024**: 42.389 notas, 45.848 liquidações e 58.003 autorizações de pagamento. O cruzamento conservador reteve 236 registros documentais vinculados ou candidatos. Esses números não medem a cobertura anual de emendas e não são fixados na interface. A emenda `0799/2024` teve quatro documentos de empenho confirmados, incluindo anulações; isso não comprova pagamento ou entrega.

## Verificação

- `npm test` em `backend`: filtros combinados, identidade anual, paginação, exportação, valores ausentes/zero e resumo com correspondências incompletas.
- `npm run build`, `npm run lint` e `npm run test:ui` em `frontend`: compilação e renderização das telas de ambas as origens.
- `node scripts/verify-state-db.mjs` em `backend`, após o build: consultas somente de leitura nos endpoints usando o PostgreSQL local.

A verificação real encontrou 2.887 emendas na listagem e 2.869 linhas de execução armazenadas em 12/10/2026. Esses números são um registro da validação, não valores fixos na interface.
