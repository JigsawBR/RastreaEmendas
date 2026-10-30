# Estrutura do projeto

O código é separado pela origem das emendas e pela responsabilidade de cada componente.

```text
RastreaEmendas/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── federal-amendments/  # CGU e fontes federais complementares
│   │   │   └── state-amendments/    # CODATA / Paraíba
│   │   ├── shared/                 # banco, validação HTTP e CSV
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/                     # contrato PostgreSQL
│   ├── scripts/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── federal-amendments/  # API, detalhes, municípios e destinos
│   │   │   └── state-amendments/    # API e detalhe estadual
│   │   ├── shared/                 # HTTP, tipos, componentes, hooks e estratégias
│   │   ├── pages/                  # visão geral, consulta e fontes (ambas as origens)
│   │   └── assets/
│   ├── public/
│   ├── e2e/
│   └── scripts/
├── etl/
│   ├── federal/                    # CGU, dados abertos, UGs e Transferegov
│   ├── state/                      # cliente e carga CODATA
│   ├── shared/                     # configuração, HTTP, banco, parsers e exercícios
│   ├── tests/
│   ├── requirements.txt
│   └── __main__.py                 # mantém python -m etl como entrada federal
├── data/                           # arquivos locais, ignorados pelo Git
│   └── raw/
│       ├── federal/                # cache CGU, documentos e arquivos baixados
│       └── state/
│           └── pb/                 # listagem e execução brutas da CODATA por ano
└── docs/
    ├── design/                     # referências de tela em PDF
    ├── diagramas/                  # fontes e imagens dos diagramas
    └── tcc/                        # documento acadêmico local
```

## Onde encontrar as emendas

- Federais: `backend/src/modules/federal-amendments/`, `frontend/src/features/federal-amendments/` e `etl/federal/`.
- Estaduais: `backend/src/modules/state-amendments/`, `frontend/src/features/state-amendments/` e `etl/state/`.
- Código usado por ambas as origens: pastas `shared/` de cada componente. Os modelos ORM do ETL ficam reunidos em `etl/shared/models.py`, pois definem o contrato integrado do banco.

No back-end federal, cada capacidade mantém as camadas `application`, `domain`, `http` e `infrastructure` que utiliza. Os endereços HTTP continuam iguais: `/emendas`, `/resumo`, `/municipios` e `/estaduais/...`. As emendas aplicadas em vários estados ficam em `/emendas-nacionais`, fora dos totais da Paraíba.

## Executar o ETL

Na raiz, com o ambiente Python ativado:

```text
python -m etl.federal --years 2023-2026
python -m etl.federal --years 2023-2026 --refresh
python -m etl.state --years 2023-2026
python -m etl.state --years 2023-2026 --refresh
python -m etl.federal.load_transferegov --years 2023-2026
python -m etl.federal.enrich_documentos --years 2023
python -m etl.federal.load_favorecidos --years 2023
python -m etl.federal.load_nacionais --years 2023-2026
python -m etl.federal.load_despesas --years 2023
python -m etl.federal.load_ugs
python -m etl.federal.classify_favorecidos
python -m etl.federal.validate_empenhos
```

Os antigos comandos `etl.load_pb` e `etl.load_*` passaram para os caminhos acima. `python -m etl` continua sendo um atalho para a carga federal. O cache existente foi movido para `data/raw/federal/`; novos downloads usam essa mesma pasta. A rotina estadual salva a listagem e a execução brutas da CODATA em `data/raw/state/pb/listagem_emendas_<ano>.json` e `data/raw/state/pb/execucao_emendas_<ano>.json`, antes da transformação e da carga. Ela reutiliza esse cache por padrão; `--refresh` coleta novamente e substitui cada arquivo somente depois da consulta completa. Os registros ficam no JSON sem alterações; a data de modificação indica quando o arquivo foi salvo.

A configuração continua lendo o `.env` da raiz para o ETL e `backend/.env` para a API. Dados e segredos permanecem fora do controle de versão.

## Verificar

- Back-end: `npm test` na pasta `backend`.
- Front-end: `npm run build`, `npm run lint` e `npm run test:ui` na pasta `frontend`.
- ETL: `python -m unittest discover -s etl/tests -v` na raiz.
