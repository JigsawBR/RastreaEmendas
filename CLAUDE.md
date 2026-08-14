# RastreaEmendas

Plataforma web para rastreabilidade da execução de emendas parlamentares
destinadas ao estado da Paraíba. É o TCC (Análise e Desenvolvimento de
Sistemas, IFPB Campus Cajazeiras) de José Matheus de Almeida Silva,
orientado pelo Prof. Dr. Fabio Gomes de Andrade.

O TCC I (proposta) já foi defendido e aprovado. Estamos na fase de
implementação, que corresponde ao TCC II.

## O problema que o sistema resolve

Os dados de emendas são públicos, mas fragmentados. É fácil descobrir
**quem recebe** (qual município recebeu recursos) e difícil reconstruir
**como se gasta**: em qual estágio de execução o dinheiro está e por qual
órgão está sendo aplicado. O sistema integra as fontes públicas e
reconstrói essa cadeia para a Paraíba.

## Stack definida

- **ETL:** Python (`requests`, `pandas`)
- **Banco:** PostgreSQL, acesso via ORM
- **Back-end:** Node.js, API REST
- **Front-end:** React

O front-end em React é requisito do trabalho, não uma preferência
negociável — está declarado no documento aprovado pela banca.

## Fonte de dados principal

API do Portal da Transparência (CGU).

- Base: `https://api.portaldatransparencia.gov.br/api-de-dados`
- Header obrigatório: `chave-api-dados: <TOKEN>`
- Rate limit: 90 req/min das 6h às 24h; 300 req/min das 0h às 6h
- A consulta web do Portal limita download a 20.000 registros, por isso a
  opção por API e arquivos de dados abertos

Endpoints usados:

- `GET /emendas?ano=&pagina=` — lista as emendas (Brasil inteiro)
- `GET /emendas/documentos/{codigoEmenda}` — documentos de despesa

Swagger oficial: `https://api.portaldatransparencia.gov.br/swagger-ui/index.html`
(OpenAPI em `/v3/api-docs`).

**A chave NUNCA vai no código.** Ler sempre de variável de ambiente
`PORTAL_API_KEY` (ou `.env` fora do controle de versão).

## Particularidades reais dos dados (revalidadas em 2026-08-13)

Estas foram descobertas rodando o ETL contra a API real. Não confie na
documentação de terceiros; ela diverge em pontos:

- **`/emendas` NÃO tem parâmetro de UF.** O `codigoUF` usado no teste de
  viabilidade é silenciosamente ignorado e o retorno é o Brasil inteiro
  (~7.000 linhas/ano, ~470 páginas). Confirmado no OpenAPI: os únicos
  parâmetros são `codigoEmenda`, `numeroEmenda`, `nomeAutor`,
  `tipoEmenda`, `ano`, `codigoFuncao`, `codigoSubfuncao`, `pagina`.
  O filtro por PB é feito no cliente, via `localidadeDoGasto` terminando
  em `" - PB"` ou igual a `"PARAÍBA (UF)"`.
- **`codigoEmenda` NÃO é único no retorno de `/emendas`.** O grão real é
  emenda × função × localidade: a mesma emenda pode ter várias linhas com
  localidades e valores distintos (ex.: uma linha municipal de R$ 100 mil
  e outra "MÚLTIPLO" de R$ 16 mi). Por isso o banco separa `emenda`
  (identidade) de `emenda_alocacao` (grão da API). Existem também
  localidades `"Nacional"` e `"MÚLTIPLO"`, que não permitem atribuir o
  gasto a uma UF — limitação a documentar.
- `/emendas/documentos/{codigo}` **repete documentos** com `id` interno
  distinto e todos os demais campos idênticos. Deduplicar por
  `codigoDocumento`.
- Alguns registros de `/emendas` vêm com `codigoEmenda = "S/I"` (Sem
  Informação). A barra quebra a URL do endpoint de documentos e a API
  devolve 403 — filtrar para códigos puramente numéricos antes de
  consultar documentos.
- **Arquivos abertos:** `/download-de-dados/emendas-parlamentares/{ano}`
  devolve um único arquivo **histórico** (todos os anos) independente do
  `{ano}` da URL. Baixar uma vez só; filtrar por ano lendo `"Ano/Mês"`.
  O ZIP tem 3 CSVs (`EmendasParlamentares.csv`,
  `EmendasParlamentares_Convenios.csv`, `EmendasParlamentares_PorFavorecido.csv`),
  encoding `latin-1`, separador `;`.
- **API do Transferegov** (`api.transferegov.gestao.gov.br/transferenciasespeciais`)
  cobre transferências especiais (EC 105) com muito mais granularidade que
  a CGU: 384 planos de ação PB em 2024 contra apenas 4 emendas
  "Transferências Especiais" via API da CGU. Sintaxe PostgREST
  (`?campo=eq.valor&limit=1000&offset=`), sem chave, paginação por
  `limit`/`offset` com `Content-Range`. O `numero_emenda_parlamentar` do
  Transferegov casa 1:1 com o `codigoEmenda` da CGU.
- Os campos de função chamam-se **`funcao` e `subfuncao`** (NÃO
  `nomeFuncao`/`nomeSubfuncao`, como consta em docs não-oficiais).
- Valores monetários vêm como **string em formato brasileiro**
  (`"100.000,00"`). Parsing correto: remover `.`, trocar `,` por `.`.
- Campos retornados por `/emendas`: `codigoEmenda`, `ano`, `tipoEmenda`,
  `autor`, `nomeAutor`, `numeroEmenda`, `localidadeDoGasto`, `funcao`,
  `subfuncao`, `valorEmpenhado`, `valorLiquidado`, `valorPago`,
  `valorRestoInscrito`, `valorRestoCancelado`, `valorRestoPago`.
- Campos de `/emendas/documentos/{codigo}`: `id`, `data`, `fase`,
  `codigoDocumento`, `codigoDocumentoResumido`, `especieTipo`,
  `tipoEmenda`. A `fase` assume `Empenho`, `Liquidação` ou `Pagamento`.
  Alguns registros trazem `data = "Sem informação"` no lugar da data —
  o parser precisa tolerar isso e guardar `NULL`.
- **O órgão executor não vem em campo próprio.** Ele é derivável dos 6
  primeiros dígitos do `codigoDocumento`, que correspondem à unidade
  gestora (UG). Formato: `UG(6) + gestão(5) + ano(4) + tipo(2) + nº(6)`.
  Ex.: `783330000012024NE000489`.
- `valorPago` pode ser **maior** que `valorEmpenhado` numa mesma função,
  porque pagamentos incluem restos a pagar de exercícios anteriores. Não
  tratar isso como erro de dados.

## Resultados do teste de viabilidade (PB, exercício 2024)

- 83 emendas, 14 parlamentares, 11 localidades
- Empenhado R$ 21.036.075,77 | Liquidado R$ 10.238.564,32 | Pago R$ 10.228.519,68
- Taxa de execução (pago/empenhado): **48,6%**
- Restos a pagar inscritos: R$ 16.199.560,37
- Completude de 100% em todos os campos críticos
- Cadeia completa (empenho + liquidação + pagamento): **87,5%** da amostra
- Função dominante: Saúde (35 emendas, R$ 9,7 mi empenhados)

**Atualização 2026-08-13 (ETL real):** a limitação de modalidades do
teste de viabilidade não se confirmou. Com o filtro correto no cliente,
PB 2024 tem **122 emendas** (110 Individual - Finalidade Definida, 8 de
Bancada, 4 Individual - Transferências Especiais), 13 localidades
explícitas, R$ 179,9 mi empenhados e R$ 62,4 mi pagos; 4.223 documentos;
cadeia completa (3 fases) em 109/122 = **89,3%**. A divergência para os
83/R$ 21 mi do teste de viabilidade provavelmente veio do filtro
`codigoUF` ignorado combinado com paginação parcial. Permanecem em
aberto: (a) emendas com localidade "Nacional"/"MÚLTIPLO" que podem
beneficiar a PB mas não são atribuíveis por este endpoint; (b) a
comparação com os arquivos de dados abertos para confirmar cobertura;
(c) emendas de comissão existem no retorno nacional, mas nenhuma com
localidade PB em 2024.

## Modelo de dados aprovado no TCC I

Três tabelas relacionais:

- `Emenda` — codigoEmenda (PK), modalidade, parlamentar, ano, valorTotal
- `Favorecido` — idFavorecido (PK), codigoEmenda (FK), municipio, tipo, valorDestinado
- `DocumentoDespesa` — numEmpenho (PK), codigoEmenda (FK), estagio, funcao,
  orgaoExecutor, valorEmpenhado, valorPago

Chaves de ligação: `codigoEmenda` e `numEmpenho`.

A banca questionou por que não usar **star schema** ou um modelo mais
normalizado. Essa decisão ainda está em aberto e precisa ser respondida
no documento — considerar que a carga é analítica (dashboard), o que
favorece um esquema estrela.

## Requisitos funcionais (do documento aprovado)

- RF-01 Importar dados das fontes públicas via ETL
- RF-02 Consultar emendas por filtros (município, órgão, função, parlamentar, exercício)
- RF-03 Exibir a cadeia de execução de uma emenda
- RF-04 Apresentar distribuição por função e órgão
- RF-05 Comparar valores empenhado e pago
- RF-06 Visualizar dados por município da Paraíba
- RF-07 Exportar registros de uma consulta
- RF-08 Indicar a completude dos dados de uma emenda

O **RF-08 é o diferencial do trabalho** e a resposta à pergunta mais
provável da banca ("e se o cruzamento não fechar?"). A fórmula deve ser
baseada na completude da cadeia medida no teste de viabilidade: uma
emenda é rastreável quando tem as três fases e os campos de função e
órgão preenchidos.

## Pendências da banca ainda não resolvidas

1. Seção de fundamentação sobre ETL, integração e dados abertos
2. Definição formal de como o RF-08 será calculado
3. Incluir protótipo de tela no documento
4. Ajustar cronograma do ETL (a banca estranhou ir até janeiro)
5. Responder sobre star schema vs. modelo normalizado
6. A banca queria que o ETL já tivesse começado no TCC I

## Convenções

- Código e identificadores em inglês; textos de interface em português
- Commits em português, no imperativo
- Nada de chaves, tokens ou dados pessoais no repositório
- Ao consumir a API, sempre implementar retry com backoff exponencial:
  a API instabiliza entre 9h e 12h e devolve 429 ao estourar o limite
