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
│   └── traceability
├── shared
└── app.ts
```

Na pasta `backend`, use `npm run dev` para desenvolvimento, `npm run build`
para compilar e `npm test` para executar a verificação automatizada.
