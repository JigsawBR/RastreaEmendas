# Emendas "MÚLTIPLO" e nacionais

A API `/emendas` da CGU registra parte das emendas com localidade `"MÚLTIPLO"`
ou `"Nacional"`, sem informar a UF. Até a carga de 2026-10-29 o filtro do ETL
só aceitava localidades terminadas em `" - PB"` e `"PARAÍBA (UF)"`, e essas
emendas ficavam fora do sistema mesmo quando o dinheiro ia inteiro para a
Paraíba.

## Como a UF é obtida

O arquivo aberto de emendas da CGU (`EmendasParlamentares.csv`, dentro do ZIP
histórico de `/download-de-dados/emendas-parlamentares`) traz, por linha, a UF
e o município além da localidade. Com ele as linhas `"MÚLTIPLO"` e
`"Nacional"` se dividem em três casos:

| Caso no arquivo aberto | Tratamento |
|---|---|
| `MÚLTIPLO` com UF = PARAÍBA e nenhuma linha da mesma emenda em outra UF | Emenda inteira da Paraíba: entra na carga federal como qualquer outra |
| `Nacional`, ou `MÚLTIPLO` com UF = "Múltiplo" | Emenda repartida entre estados: guardada à parte, em `emenda_nacional` |
| `MÚLTIPLO` com uma única UF diferente da Paraíba | Fora do recorte |

O casamento com a API usa a chave (código da emenda, função, subfunção). As
326 emendas "MÚLTIPLO" da Paraíba em 2023–2026 casaram todas com uma linha da
API. Como controle, as linhas com município da Paraíba explícito no arquivo
aberto coincidem exatamente com as já carregadas pela API (81, 122 e 93
emendas em 2023, 2024 e 2025).

O código está em `etl/federal/abrangencia.py` (regras) e
`etl/federal/__main__.py` (filtro da carga federal). Os testes ficam em
`etl/tests/test_abrangencia.py`.

## Emendas "MÚLTIPLO" da Paraíba

Elas entram em `emenda`/`emenda_alocacao` com a localidade `"MÚLTIPLO"` e
passam pela mesma revalidação de valores, documentos, enriquecimento e
classificação de favorecidos. Na interface, a localidade aparece como
"Vários municípios da PB".

| Ano | Emendas | Empenhado | Pago |
|---|---|---|---|
| 2023 | 97 | R$ 657,8 mi | R$ 588,7 mi |
| 2024 | 67 | R$ 665,1 mi | R$ 630,3 mi |
| 2025 | 84 | R$ 875,6 mi | R$ 803,3 mi |
| 2026 | 79 | R$ 735,6 mi | R$ 546,8 mi |

Em 2026 são 79 emendas porque uma delas já estava na base por ter também uma
linha municipal. Por modalidade: 224 individuais com finalidade definida
(R$ 1,23 bi), 89 transferências especiais (R$ 835,2 mi) e 14 de bancada
(R$ 865,0 mi).

Os empenhos dessas emendas vão quase todos para municípios: R$ 2,76 bi em
6.969 documentos, contra R$ 144,4 mi para o estado e R$ 28,2 mi para
fornecedores privados. É coerente com a localidade: a CGU usa `"MÚLTIPLO"`
quando a mesma emenda é repartida entre vários municípios, sobretudo
custeio de saúde fundo a fundo.

## Efeito nos totais federais da Paraíba

| Ano | Emendas | Empenhado | Pago | Pago/empenhado |
|---|---|---|---|---|
| 2023 | 81 → 178 | R$ 187,0 mi → R$ 844,9 mi | R$ 49,6 mi → R$ 638,3 mi | 26,5% → 75,5% |
| 2024 | 122 → 189 | R$ 223,8 mi → R$ 888,9 mi | R$ 85,5 mi → R$ 715,8 mi | 38,2% → 80,5% |
| 2025 | 93 → 177 | R$ 189,5 mi → R$ 1.065,0 mi | R$ 31,6 mi → R$ 834,9 mi | 16,7% → 78,4% |
| 2026 | 67 → 145 | R$ 57,7 mi → R$ 793,3 mi | R$ 16,2 mi → R$ 563,0 mi | 28,1% → 71,0% |

A taxa de execução sobe porque transferências fundo a fundo e especiais são
pagas logo após o empenho, ao contrário das emendas executadas por compra
direta. Comparações com números anteriores a esta carga precisam levar isso
em conta.

## Emendas nacionais

As emendas repartidas entre estados não entram nos totais da Paraíba: os
valores da CGU cobrem todos os estados e não há como separar a parte
paraibana na própria emenda. `etl/federal/load_nacionais.py` usa o
`EmendasParlamentares_PorFavorecido.csv` (tabela `favorecido`) para medir o
que **entes públicos** da Paraíba receberam de cada uma. A esfera vem da
natureza jurídica do favorecido. Entidades privadas aparecem apenas como sede:
uma empresa ou organização social sediada na Paraíba não indica que o
recurso foi aplicado no estado.

| Ano | Emendas | Recebido por entes públicos da PB | Recebido por privados sediados na PB |
|---|---|---|---|
| 2023 | 6 | R$ 182,4 mi | R$ 7,8 mi |
| 2024 | 16 | R$ 90,1 mi | R$ 27 mil |
| 2025 | 14 | R$ 301,8 mi | R$ 6,2 mi |
| 2026 | 8 | R$ 305,8 mi | — |

Só são guardadas emendas com ao menos um ente público da Paraíba entre os
favorecidos. Os dados ficam em `emenda_nacional` e `emenda_nacional_destino`,
a API os expõe em `GET /emendas-nacionais` e a interface em
`/emendas-nacionais`, com aviso de que não estão somados aos indicadores.

## Limites

- O arquivo aberto é histórico e a carga federal o lê do cache; use
  `--refresh` para baixá-lo de novo.
- Uma emenda que deixa de aparecer na fonte não é removida, como no restante
  da carga federal.
- O recebido por entes nacionais vem do arquivo de favorecidos, que registra
  o que foi pago ao favorecido, e não o empenhado.
- `"MÚLTIPLO"` informa que a emenda é repartida, mas não diz entre quais
  municípios. O município beneficiado vem do favorecido do empenho, quando a
  natureza jurídica é municipal.
