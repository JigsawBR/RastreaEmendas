# Carga e validação do exercício de 2023

Conferência realizada em 05/10/2026 na base local. As telas de consulta usam
emendas federais com localidade explicitamente atribuída à Paraíba pela CGU.

## Dados disponíveis

- 81 emendas federais, 15 parlamentares e 24 localidades.
- 81 alocações, preservando o grão emenda × função × localidade.
- 2.533 documentos distintos, com 2.565 vínculos a emendas.
- 518 vínculos de empenho, 774 de liquidação e 1.273 de pagamento.
- Todos os documentos foram detalhados e têm UG resolvida por nome.
- Nenhum empenho ou pagamento ficou sem valor informado. Em 748 registros
  de liquidação, a fonte não informou o valor; o banco mantém `NULL`.

| Indicador das alocações de 2023 | Valor |
| --- | ---: |
| Empenhado | R$ 187.041.938,35 |
| Liquidado | R$ 50.392.051,38 |
| Pago | R$ 49.552.694,70 |
| Restos a pagar inscritos | R$ 18.839.575,13 |
| Diferença empenhado − pago | R$ 137.489.243,65 |
| Relação pago / empenhado | 26,49% |

Também foram carregadas 532 emendas estaduais e 524 registros estaduais de
execução, 385 planos e 394 empenhos do Transferegov, 1.341 registros de
favorecidos e 1.591 linhas de despesas federais dos 12 meses de 2023.
Essas bases são complementares: seus valores não devem ser somados entre si.
As emendas estaduais ainda não têm consulta própria na interface.

## RF-01 a RF-05

| RF | Implementação e conferência |
| --- | --- |
| RF-01 | ETLs da CGU, Transferegov e portal estadual executados para 2023. Enriquecimento por exercício retomável; nova execução confirmou zero documentos pendentes. Downloads completos e validados antes de publicar o cache; substituição mensal transacional. |
| RF-02 | 2023 disponível nos seletores. Filtros de exercício, município, parlamentar, função e órgão conferidos na API, além de filtros combinados na interface. |
| RF-03 | Cadeias das 81 emendas conferidas. Os três estágios continuam disponíveis quando uma fase não tem documentos. Documentos de execução posterior permanecem ligados à emenda de 2023. |
| RF-04 | Distribuições das 81 emendas conferidas. Função usa alocações; UG usa documentos de cada fase. Valores ausentes e totais parciais são identificados, e empenhos não são apresentados como pagamentos efetivados. |
| RF-05 | Totais do painel comparados ao banco; diferença e relação entre empenhado e pago exibidas. Pagamentos podem incluir restos de exercícios anteriores; a diferença não é apresentada como dívida ou saldo disponível. |

Os testes do ETL e do back-end passaram, assim como a compilação da interface.
A carga de detalhes concluiu 2.533 consultas sem erros nem respostas vazias.
A conferência cruzada não encontrou a assinatura exata de corrupção por
fator 10.000 entre a soma dos empenhos e as alocações de 2023.
As quantidades dos demais exercícios permaneceram: 122 emendas em 2024,
93 em 2025 e 60 em 2026.

## Cobertura e atualização

A carga federal reutilizou as listagens em cache e revalidou os valores das
81 emendas na API. O detalhamento dos documentos foi consultado na API nesta
execução. Para renovar integralmente as listagens e os documentos associados,
use `python -m etl --years 2023 --refresh` e depois
`python -m etl.enrich_documentos --years 2023`.

Localidades “Nacional” e “MÚLTIPLO” não permitem atribuir o gasto a uma UF pelo
endpoint de emendas. Por isso, 81 é a quantidade do recorte explícito da CGU,
não uma garantia de cobertura de todas as emendas que possam beneficiar a PB.
Os totais dos documentos podem divergir das alocações por incluírem execução
em outros exercícios e por terem outra abrangência.
