# Arquitetura do monolito modular

O RastreaEmendas adota um monolito modular no back-end. A API continua sendo
uma única aplicação Node.js e um único artefato de implantação, mas as regras
são organizadas por capacidade de negócio, não por uma camada global de
controllers, services e repositories.

## Visão geral

```text
React ──HTTP──> API Node.js ──ORM──> PostgreSQL <──carga── ETL Python
                    │
                    ├── federal-amendments/
                    │   ├── amendments
                    │   ├── execution
                    │   ├── traceability
                    │   ├── locations
                    │   ├── organizations
                    │   ├── parliamentarians
                    │   ├── analytics
                    │   └── exports
                    └── state-amendments
```

O PostgreSQL é o contrato de integração entre a API e o ETL. O ETL não importa
código do back-end, e o back-end não executa etapas do ETL durante requisições.

## Módulos do back-end

As capacidades federais ficam em `backend/src/modules/federal-amendments/`.
O módulo estadual fica em `backend/src/modules/state-amendments/`.
A organização interna por capacidade e camada continua a mesma.

- `amendments`: consulta e filtros das emendas e de suas alocações.
- `state-amendments`: consulta CODATA, vínculo por ano e número, agregações e exportação estadual.
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

## KISS e SOLID aplicados

A consulta React usa `useAmendmentSearch` para URL, filtros, paginação e acesso
a dados; `EmendasList` apresenta o formulário e `AmendmentResults` renderiza
os resultados. Visão geral e cobertura reutilizam o mesmo registro de fontes.
A consulta federal de listagem e exportação compartilha `findAmendments` e
o mesmo construtor de filtros. O CSV comum fica em `shared/serialization`.
Os três comandos ETL reutilizam `etl/shared/years.py`.

- **SRP:** rota estadual traduz HTTP, serviço coordena a consulta, domínio calcula valores,
  adaptador Prisma consulta o banco e serializador produz CSV.
- **OCP:** a consulta React obtém filtros, endpoints e navegação pelo registro
  de estratégias. Uma fonte nova exige registrar sua estratégia e implementar
  seus contratos; particularidades de negócio continuam explícitas.
- **LSP:** estratégias entregam o contrato comum de consulta e repositórios
  respeitam o contrato estadual, incluindo identidade anual e valores nulos.
  A substituição do repositório por uma implementação em memória é verificada
  em teste unitário; o adaptador real é exercitado no E2E.
- **ISP:** o serviço estadual usa apenas listagem, resumo e busca individual,
  sem depender de operações de carga ou de um repositório CRUD genérico.
- **DIP:** o serviço estadual depende de `StateAmendmentRepository`.
  `app.ts` injeta o adaptador Prisma na criação do serviço e router.

A aplicação desses princípios é gradual e orientada às consultas modificadas.
Módulos simples podem continuar consultando Prisma diretamente. Não há
contêiner de injeção, classes base universais ou abstrações sem consumidor.

## Padrões GoF utilizados

**Strategy:** `frontend/src/shared/lib/amendment-source.ts` encapsula as variantes
federal e estadual; o hook e as telas selecionam uma implementação pelo
contrato `AmendmentSourceStrategy`.

**Adapter:** `prisma-state-amendment-repository.ts` adapta Prisma ao contrato
de domínio `StateAmendmentRepository`. O serviço não importa Prisma,
Express ou variáveis de ambiente.

Repository é um padrão de persistência complementar, não pertence ao catálogo
GoF. As funções `create…` são fábricas simples de composição; não são
apresentadas como o padrão GoF Factory Method.

## Verificação

Veja [E2E com PostgreSQL real](testes-e2e.md) para preparar e executar a suíte.
O E2E não consulta CGU/CODATA pela internet: verifica o caminho
navegador → React → HTTP → Prisma → PostgreSQL com fixtures determinísticas.
Os testes próprios do ETL continuam verificando os comportamentos de carga.
