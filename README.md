# RastreaEmendas

Plataforma web para rastreabilidade da execução de emendas parlamentares
destinadas ao estado da Paraíba.

## Componentes

- `frontend`: interface React.
- `backend`: API REST Node.js organizada como monolito modular.
- `etl`: pipeline Python de extração, transformação e carga.
- `backend/prisma`: contrato do banco PostgreSQL usado pela API.

A API e o ETL são executáveis independentes. Eles se integram pelo PostgreSQL,
sem compartilhar código de execução. As decisões e regras de dependência estão
documentadas em [docs/arquitetura-monolito-modular.md](docs/arquitetura-monolito-modular.md).

## Back-end

```text
backend/src
├── modules
│   ├── amendments
│   ├── analytics
│   ├── execution
│   ├── exports
│   ├── locations
│   ├── organizations
│   ├── parliamentarians
│   ├── state-amendments
│   └── traceability
├── shared
└── app.ts
```

Na pasta `backend`, use `npm run dev` para desenvolvimento, `npm run build`
para compilar e `npm test` para executar a verificação automatizada.

## Executar localmente

Com PostgreSQL e as dependências instaladas, configure `DATABASE_URL` no
`.env` da raiz (SQLAlchemy) e em `backend/.env` (Prisma), além de
`PORTAL_API_KEY` no `.env` da raiz. Nunca versione esses arquivos.
Em dois terminais, execute `npm run dev` em `backend` e em `frontend`.
A interface abre em http://localhost:5173 e a API em http://localhost:4000.
`GET /health` verifica a conexão com o banco.

## RF-01: coleta e atualização

A carga local de 2023 e as verificações dos RF-01 a RF-05 estão registradas em
[docs/validacao-2023.md](docs/validacao-2023.md).

Na raiz, com o ambiente Python ativado:

```text
python -m etl --years 2023-2026
python -m etl --years 2023-2026 --refresh
python -m etl.load_transferegov --years 2023-2026
python -m etl.load_pb --years 2023-2026
python -m etl.enrich_documentos --years 2023
python -m etl.load_favorecidos --years 2023
python -m etl.load_despesas --years 2023
```

A primeira execução federal reutiliza o cache disponível. `--refresh` consulta
novamente listagens, detalhes de emendas e documentos; só substitui cada arquivo
de cache depois da respectiva consulta completa. A carga atualiza e insere
registros, mas não remove registros que desapareceram da fonte.
Os valores e favorecidos dos documentos exigem o enriquecimento separado:
`python -m etl.enrich_documentos` (pendentes) ou
`python -m etl.enrich_documentos --retry-all` (também os já enriquecidos).
`--years 2023` restringe o enriquecimento às emendas daquele exercício,
incluindo os documentos executados em anos posteriores. Reexecutar o comando
retoma os documentos pendentes; uma resposta vazia da fonte continua pendente.
Os arquivos mensais de despesas são gravados apenas depois de um download
completo e válido, e cada mês é substituído em uma única transação.
As rotinas estadual e Transferegov consultam diretamente suas fontes e usam
tentativas com espera exponencial. A substituição da execução estadual de cada
ano é transacional: uma falha na inserção desfaz também a exclusão anterior.
Não existe agendamento automático dessas rotinas.

## RF-02 a RF-05: consulta

- A listagem federal filtra município, função, parlamentar, órgão/UG e exercício
  (2023 a 2026, ou todos). Um resultado vazio pode significar ausência de carga.
- O detalhe mantém as três fases da execução visíveis, mesmo sem documentos.
- A distribuição por função usa alocações; a distribuição por UG usa documentos
  da respectiva fase. Valores ausentes são identificados e totais incompletos
  são marcados como parciais. As duas bases podem ter abrangências e datas de
  atualização diferentes; seus totais não são necessariamente conciliados.
- Painel e detalhe mostram a diferença empenhado menos pago e a relação entre
  eles. A diferença não é tratada como saldo disponível ou dívida comprovada;
  pagamentos podem incluir restos a pagar. Com empenhado zero, a razão não é
  calculada.

As telas de visão geral e consulta permitem escolher a origem federal (CGU)
ou estadual (CODATA). A origem estadual consulta a listagem e execução carregadas
pelo ETL estadual, vinculadas por ano e número da emenda, com filtros por
beneficiário, parlamentar, função, órgão e exercício. A cobertura territorial
por municípios permanece nas fontes federais.

Contratos, limites e verificações da consulta estadual estão em
[docs/consulta-estadual.md](docs/consulta-estadual.md).

Verificações: `npm test` em `backend`, `npm run build` em `frontend` e
`python -m unittest discover -s etl/tests -v` na raiz.

## Arquitetura e testes de integração

Consulte [KISS, SOLID e padrões GoF](docs/arquitetura-monolito-modular.md) e
[a suíte E2E com PostgreSQL real](docs/testes-e2e.md). Execute
`npm run test:e2e` na pasta `frontend` para validar desktop e celular
em um schema temporário, preservando a base original.
