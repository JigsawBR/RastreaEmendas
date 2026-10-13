# RastreaEmendas — briefing do protótipo Figma

## Objetivo

Projetar a experiência antes de novas alterações na aplicação. O protótipo deve
permitir consultar emendas destinadas à Paraíba, compreender os estágios de
execução e distinguir dados disponíveis de informações ainda não identificadas.
Prioridade desta rodada: RF-01 a RF-05.

Arquivo editável criado:
https://www.figma.com/design/UyYe74520RSjMttSRE99j8

Inclui quatro telas desktop e três versões móveis (visão geral, consulta e
detalhe), com navegação de exemplo, Auto Layout e componentes reutilizáveis.
Os dados são ilustrativos. Filtros e importação são representações visuais;
o protótipo não executa consultas ou cargas reais. A aplicação não foi alterada
para aplicar esta proposta visual.

## Direção visual proposta

Interface institucional clara, com fundo cinza muito suave, superfícies brancas,
verde escuro como cor principal e tipografia legível. Evitar aparência de painel
financeiro de investimentos. Reservar âmbar para informação parcial e vermelho
para falhas; não representar ausência de informação apenas por cor.

Desktop de referência: 1440 px. Versão móvel de referência: 390 px.
Navegação: Visão geral, Emendas, Municípios e Sobre os dados.
Operações de importação ficam em uma área administrativa separada da consulta
pública. Os componentes devem ter variantes de carregamento, vazio e erro.

## Telas e fluxo principal

1. **Visão geral:** seleção de exercício (2023–2026), identificação explícita da
   esfera e da fonte, data da atualização, totais empenhado/liquidado/pago e
   comparação entre empenhado e pago. Ação principal: consultar emendas.
2. **Consulta de emendas:** filtros por município, parlamentar, função, órgão e
   exercício; filtros aplicados visíveis; quantidade de resultados, paginação
   e acesso ao detalhe. Em telas pequenas, filtros em painel recolhível e
   resultados em cartões. Distinguir ausência de carga de busca sem resultados.
3. **Detalhe da emenda:** identificação, autor, exercício, modalidade e
   localidades; comparação financeira; linha de execução com empenho,
   liquidação e pagamento; documentos agrupados por fase; distribuição de
   valores por função e órgão; indicador de completude já existente.
4. **Sobre os dados / importação:** visão pública das fontes, cobertura e
   limitações; proposta administrativa separada para escolher fonte e anos,
   iniciar carga e acompanhar andamento, última execução e falhas. Essa
   interface administrativa é proposta de design, não funcionalidade existente.

Fluxo navegável: visão geral → consulta filtrada → detalhe → documentos por
fase → retorno à consulta preservando filtros.

## Estados obrigatórios

- Exercício ainda sem carga: explicar a situação, sem afirmar que não há emendas.
- Fonte indisponível: mostrar erro e data da última carga válida, quando conhecida.
- Fase sem documentos: manter a fase visível, identificada como não encontrada
  na base carregada; não concluir que a despesa nunca chegou àquela fase.
- Valor não informado: diferenciar de R$ 0,00. Somatórios incompletos devem
  indicar que são parciais.
- Pago superior ao empenhado: explicar a possibilidade de restos a pagar.
- Empenhado zero: não calcular percentual de execução.
- Diferença entre alocações e documentos: identificar as bases utilizadas;
  não prometer conciliação nem chamar a diferença de saldo disponível.
- Federal e estadual: distinguir origem orçamentária de destino do recurso.
  O seletor entre esferas é uma proposta; as telas atuais consultam emendas
  federais. Não apresentar a consulta estadual como já implementada.

## Componentes editáveis previstos

Cabeçalho, navegação, seletor de exercício/esfera, campo de busca, filtros,
botões, cartões de indicadores, comparação financeira, tabela de resultados,
paginação, estados de dados, etapas da execução, lista de documentos e legenda
de cobertura. Usar estilos de cor e tipografia, componentes com variantes e
Auto Layout no arquivo Figma, quando a integração permitir.

## Conteúdo e validação

Textos em português. Usar dados ilustrativos identificados como exemplos, ou
dados públicos verificados acompanhados da data da consulta. Não inventar
horários de atualização, taxas de completude ou execução de cargas.
Revisar legibilidade, contraste, navegação por teclado e adaptação móvel.
Entregar link para o arquivo editável e para o fluxo de apresentação.
