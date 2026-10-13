# RastreaEmendas — interface React

Implementação das quatro telas de referência em `telasFigma/`: visão geral, consulta, detalhe da emenda e fontes/importação. Os valores vêm da API REST; os exemplos dos PDFs não foram incorporados à base.

## Executar

Com a API disponível em `http://localhost:4000`, execute nesta pasta:

```text
npm install
npm run dev
```

Acesse `http://localhost:5173`. O Vite encaminha `/api` para o back-end.

## Validar

```text
npm run build
npm run lint
npm run test:ui
```

A verificação de interface renderiza as páginas com fixtures isoladas e confere filtros por URL, paginação, retorno ao filtro, fases sem valor, empenhado zero e seleção da origem estadual. Não substitui testes de navegador, responsividade ou integração com PostgreSQL.

## Comportamentos

- Visão geral e consulta permitem selecionar a origem Federal (CGU) ou Estadual (CODATA). O detalhe estadual apresenta execução agregada, com RF-08 não avaliável sem documentos individualizados.
- Filtros são aplicados ao enviar o formulário e ficam na URL. O retorno do detalhe preserva filtros e página.
- Consulta apresenta tabela no desktop e cartões em telas pequenas.
- Detalhe mantém as três fases visíveis e permite selecionar os documentos de cada uma. Valores ausentes e somas parciais são identificados.
- Sobre os dados consulta a cobertura federal e estadual por exercício e prepara comandos reais para o ETL. A execução é local, pelo administrador; não há disparo nem monitoramento de carga pelo navegador.
- Datas de última carga não são inventadas: a API atual não disponibiliza esse metadado.
- A página de municípios existente permanece acessível pela navegação.

As cores, dimensões, espaçamentos e superfícies seguem os PDFs. Roboto é a fonte preferencial, com Segoe UI e Arial como alternativas locais.
