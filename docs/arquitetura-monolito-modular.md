# Arquitetura do monolito modular

O RastreaEmendas adota um monolito modular no back-end. A API continua sendo
uma única aplicação Node.js e um único artefato de implantação, mas as regras
são organizadas por capacidade de negócio, não por uma camada global de
controllers, services e repositories.

## Visão geral

```text
React ──HTTP──> API Node.js ──ORM──> PostgreSQL <──carga── ETL Python
                    │
                    ├── amendments
                    ├── execution
                    ├── traceability
                    ├── locations
                    ├── organizations
                    ├── parliamentarians
                    ├── analytics
                    └── exports
```

O PostgreSQL é o contrato de integração entre a API e o ETL. O ETL não importa
código do back-end, e o back-end não executa etapas do ETL durante requisições.

## Módulos do back-end

- `amendments`: consulta e filtros das emendas e de suas alocações.
- `execution`: cadeia de documentos, distribuição e destino dos recursos.
- `traceability`: regra do RF-08 e seu endpoint.
- `locations`: visão agregada por município ou pelo conjunto do estado.
- `organizations`: órgãos e unidades gestoras.
- `parliamentarians`: agregações por autor da emenda.
- `analytics`: indicadores consolidados do dashboard.
- `exports`: geração das exportações solicitadas pelo RF-07.
- `shared`: somente infraestrutura e comportamentos realmente transversais.

Cada módulo pode usar as pastas `domain`, `application`, `infrastructure` e
`http` quando elas forem necessárias. Não se criam pastas vazias apenas para
seguir o padrão. Regras que podem ser executadas sem banco ou HTTP pertencem a
`domain`; coordenação de casos de uso pertence a `application`; Prisma e
integrações pertencem a `infrastructure`; rotas e tradução da resposta
pertencem a `http`.

## Regras de dependência

1. `app.ts` é a raiz de composição e registra os routers dos módulos.
2. Um módulo não importa a camada HTTP de outro módulo.
3. Regras de domínio não importam Express, Prisma ou variáveis de ambiente.
4. Código em `shared` não contém regra específica de emenda parlamentar.
5. O contrato HTTP existente deve ser preservado ao mover uma implementação.
6. Uma dependência entre módulos deve apontar para uma função de aplicação
   explícita, como a consulta de destino dos recursos.

## RF-08

A rastreabilidade é calculada no módulo `traceability` por cinco critérios de
mesmo peso: existência de empenho, liquidação e pagamento, além de função e
órgão executor preenchidos. O resultado é a quantidade de critérios atendidos
dividida por cinco. A função de domínio é independente do banco e possui teste
automatizado próprio.

## Modelo de dados analítico

O banco relacional continua sendo a fonte integrada e auditável. Consultas de
dashboard podem ser promovidas para views ou materialized views quando medições
mostrarem necessidade. A adoção do monolito modular não exige, por si só, a
duplicação imediata dos dados em um esquema estrela.
