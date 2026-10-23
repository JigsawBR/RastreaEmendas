# Teste de usabilidade do RastreaEmendas

Protocolo para o moderador. Os materiais desta pasta:

| Arquivo | Uso |
|---|---|
| `termo-consentimento.md` | Lido e aceito antes da sessão |
| `tarefas-participante.md` | Entregue ao participante, uma tarefa por vez |
| `questionario.md` | Perfil (antes), facilidade por tarefa e SUS (depois) |
| `resultados.csv` | Registro do moderador: uma linha por participante × tarefa |
| `sus.csv` | Respostas do SUS: uma linha por participante |
| `analisar.py` | Calcula sucesso, tempo, facilidade e SUS a partir dos dois CSVs |

## Objetivo

Verificar se pessoas sem formação em TI conseguem, sozinhas, **encontrar uma emenda, entender em que fase ela está e para onde o dinheiro foi**, que é o problema que o sistema se propõe a resolver. O resultado alimenta o capítulo de avaliação do TCC com dados quantitativos (taxa de sucesso, tempo, SUS) e qualitativos (dificuldades observadas).

## Participantes

- **5 a 8 pessoas.** Cinco participantes costumam revelar a maior parte dos problemas de usabilidade (Nielsen e Landauer, 1993); oito dão mais estabilidade ao SUS.
- Perfil de público-alvo, **fora da área de TI**: estudantes de outros cursos, jornalistas, servidores, conselheiros municipais, cidadãos interessados em transparência.
- Não incluir quem acompanhou o desenvolvimento do sistema.

## Preparação do ambiente

1. Banco carregado com 2024 completo (federal e estadual, inclusive `python -m etl.state.documents --years 2024`).
2. API e front-end rodando; navegador em janela anônima, abrindo na **Visão geral**.
3. **Conferir o gabarito abaixo antes da primeira sessão.** Uma nova carga do ETL pode alterar valores; se mudar, atualize o gabarito e use o mesmo para todos os participantes.
4. Cronômetro e `resultados.csv` aberto. Se houver gravação de tela, ela precisa constar no termo.

## Roteiro da sessão (cerca de 30 minutos)

1. **Acolhida (3 min).** Ler o termo; deixar claro que quem está sendo avaliado é o site, não a pessoa.
2. **Perfil (2 min).** Parte A do questionário.
3. **Pensar em voz alta.** Pedir que a pessoa fale o que procura e o que espera encontrar enquanto usa o site.
4. **Tarefas (15 a 20 min).** Entregar uma tarefa por vez, na ordem. Para cada uma:
   - iniciar o cronômetro quando a pessoa terminar de ler;
   - parar quando ela der a resposta ou desistir; **limite de 4 minutos**;
   - perguntar a facilidade (parte B do questionário, nota de 1 a 7);
   - registrar a linha em `resultados.csv`.
5. **SUS (3 min).** Parte C, respondida pela própria pessoa, sem ajuda.
6. **Conversa final (5 min).** Parte D: o que foi mais difícil, o que mais ajudou, o que mudaria.

### Postura do moderador

- Não ensinar nem indicar onde clicar. Frases neutras: "O que você esperaria encontrar aí?", "Onde você procuraria?", "Fique à vontade para tentar".
- Se a pessoa travar por mais de um minuto, oferecer **uma ajuda** ("Talvez valha olhar o menu") e registrá-la em `ajudas`.
- Anotar falas literais que revelem confusão; elas são o material mais útil para o texto.

## Gabarito do moderador

Base de 19/10/2026, exercício 2024. **Não mostrar ao participante.**

| Tarefa | Resposta correta | Sucesso parcial | Caminho esperado |
|---|---|---|---|
| T1 | Empenhado R$ 300.000,00; pago R$ 286.500,00 | Acertou só um dos valores | Emendas → filtro Parlamentar → detalhe da 0009 |
| T2 | 0004 · Bancada da Paraíba · R$ 81,7 mi | Emenda certa, autor errado ou ausente | Emendas → Ordenar por "Maior valor empenhado" |
| T3 | Não está completa (3/5): faltam liquidação e pagamento | Disse que está incompleta sem apontar as fases | Emendas → filtro Ruy Carneiro → detalhe da 0016 → Completude |
| T4 | 3 emendas | Encontrou as emendas sem contar ou contou errado | Emendas → origem Estadual → Município beneficiado "Sousa" |
| T5 | Cerca de R$ 2,1 mi; está na faixa mais alta | Valor certo sem a faixa, ou o contrário | Municípios → indicador estadual → Cajazeiras |
| T6 | Baixou o CSV com as 40 emendas de 2024 da deputada | Baixou o CSV sem o filtro (ou de outro ano) | Emendas → Estadual → Parlamentar "Cida Ramos" → Exportar CSV |
| T7 | Os documentos reúnem pagamentos de qualquer data, inclusive de anos seguintes (restos a pagar) | Percebeu que são fontes diferentes, sem explicar | Detalhe da 0002/2024 → aviso "Por que os valores pagos diferem?" |

Critério de sucesso em `resultados.csv`: `completo`, `parcial` ou `falha` (inclui desistência e estouro do tempo). A análise conta `parcial` como meio sucesso.

## Análise

```powershell
.venv/Scripts/python.exe docs/teste-usabilidade/analisar.py
```

O script lê `resultados.csv` e `sus.csv` e mostra, por tarefa, a taxa de sucesso, o tempo mediano, as ajudas e a facilidade média. Também calcula o SUS de cada participante, a média, o desvio-padrão e a classificação.

**Como ler o SUS.** A pontuação vai de 0 a 100. A média de referência da literatura é **68** (Sauro, 2011). Na escala de adjetivos de Bangor, Kortum e Miller (2009), cerca de 71 corresponde a "bom" e cerca de 85 a "excelente". O SUS mede a usabilidade percebida; ele não substitui a taxa de sucesso, que mede se a pessoa de fato chegou à resposta correta.

**Para o texto do TCC.** Reporte o número de participantes e o perfil deles, a taxa de sucesso e o tempo por tarefa, o SUS médio com desvio-padrão, e os três a cinco problemas mais frequentes, com as falas que os ilustram e a correção feita (ou proposta). Com 5 a 8 participantes, os números descrevem o grupo; não os generalize como estatística da população.

## Ética

O teste envolve pessoas, mas não coleta nome no registro: cada participante é identificado por um código (P1, P2…). **Confirme com o orientador** se o IFPB exige submissão ao Comitê de Ética em Pesquisa. A Resolução CNS nº 510/2016 dispensa de registro alguns tipos de pesquisa, como a de opinião com participantes não identificados, mas cabe à instituição decidir se o teste se enquadra. Guarde os termos assinados fora do repositório.

## Referências

- BANGOR, A.; KORTUM, P.; MILLER, J. Determining what individual SUS scores mean: adding an adjective rating scale. *Journal of Usability Studies*, v. 4, n. 3, p. 114-123, 2009.
- BROOKE, J. SUS: a "quick and dirty" usability scale. In: JORDAN, P. W. et al. (ed.). *Usability evaluation in industry*. London: Taylor & Francis, 1996. p. 189-194.
- NIELSEN, J.; LANDAUER, T. K. A mathematical model of the finding of usability problems. In: *Proceedings of INTERCHI '93*. ACM, 1993. p. 206-213.
- SAURO, J. *A practical guide to the System Usability Scale*. Denver: Measuring Usability LLC, 2011.
