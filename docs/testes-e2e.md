# E2E com PostgreSQL real

## Execução

Requer Node.js, dependências instaladas em backend/frontend e um PostgreSQL
acessível. Configure `E2E_DATABASE_URL` no ambiente ou `DATABASE_URL` em
`backend/.env` (ignorado pelo Git). O usuário do banco precisa criar schemas.
Prefira um banco dedicado de testes em CI.

Na pasta `frontend`:

```powershell
npx playwright install chromium
npm run test:e2e
```

Filtrar cenários: `npm run test:e2e -- --project=desktop` ou
`npm run test:e2e -- --grep "consulta estadual"`.

O runner cria um schema exclusivo `rastrea_e2e_<pid>_<aleatório>`,
aplica o schema Prisma nele e insere dados fictícios federais e estaduais.
Compila a API e inicia API/Vite em portas locais livres. A mesma suíte roda
em Chromium desktop e com viewport/toque de celular. Não há mocks HTTP,
interceptação de requests nem banco em memória.

## Isolamento e evidências

A URL de conexão do teste recebe explicitamente o schema temporário.
O runner não executa reset/migrações na base original. Em `finally`, remove
somente o schema gerado nesta execução e compara inventário de tabelas e
contagens originais de emendas, alocações, documentos e emendas estaduais.
O schema é removido também quando algum teste falha normalmente.
Interrupção forçada do processo ou desligamento pode deixar o schema
temporário no banco; o nome aparece no início da execução.

`playwright-report/` e `test-results/` ficam fora do Git. Em falhas,
o relatório inclui screenshot e trace. Não publique relatórios que
eventualmente contenham dados de um ambiente externo.

## Cobertura

- Consulta estadual com beneficiário, parlamentar, função e órgão; CSV e
  retorno do detalhe preservando filtros.
- Paginação, retorno à página e troca federal/estadual.
- Consulta federal filtrada, CSV completo e detalhe.
- Empenho, liquidação, pagamento e RF-08 completo/incompleto federal.
- Distinção de valor ausente e zero, soma parcial e mesma numeração em anos diferentes.
- Resumo estadual excluindo execução sem listagem; cobertura e exercício vazio.
- Respostas HTTP 400/404 e valores conferidos diretamente no contrato da API.
- Interface em desktop e celular, com verificação de largura em consulta e cobertura.

A suíte mede integração com o banco real, usando dados de teste. Não mede
disponibilidade das APIs públicas, completude do ETL externo ou todos os
navegadores. O RF-08 estadual permanece não avaliável na fonte agregada.

Outras verificações:

```powershell
cd backend
npm test
cd ../frontend
npm run build
npm run lint
npm run test:ui
cd ..
.venv/Scripts/python.exe -m unittest discover -s etl/tests -v
```

Referência: [Playwright — servidores de teste](https://playwright.dev/docs/test-webserver).
