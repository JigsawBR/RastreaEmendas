# Evidências complementares de rastreabilidade

O detalhe de emendas federais e estaduais apresenta uma seção de evidências,
com tipo, participante e seu papel, regra de vínculo, URL da fonte e data de
coleta. A cobertura informa o escopo efetivamente processado e diferencia uma
fonte não carregada de um escopo carregado sem vínculos. Encontrar evidências
não altera os valores contábeis nem aumenta automaticamente o RF-08.

## Fontes implementadas

- **Objetos estaduais:** extrai CNPJ com dígitos verificadores válidos e conserva
  o trecho. A entidade citada é candidata; não sobrescreve `beneficiario_final`.
- **Convênios e termos estaduais:** vínculo por referência explícita ao número
  e exercício da emenda; alternativamente, cadastro CGE ligado a uma única
  emenda nas notas. Identifica o convenente, sem presumir solicitante original.
- **Contratos estaduais:** cadastro CGE normalizado e CNPJ do contratado iguais
  aos da nota de empenho. Deduplica o mesmo contrato publicado por mais de uma
  unidade. Conserva processo e endereço do contrato, inclusive PNCP.
- **Ordem cronológica estadual:** consulta número do empenho no mês e ano de
  cada pagamento candidato. Exige também autorização, CNPJ e fonte iguais para
  apresentar o contexto. Continua candidato: a fila não fornece exercício do
  empenho nem resolve a equivalência entre todos os códigos de unidades. Não
  cobre a fila de restos a pagar ou meses fora desse escopo.
- **Transferências especiais:** valida o ID do plano e código completo da
  emenda na API pública nova, a partir dos planos PB já carregados. Busca planos
  de trabalho, relatórios antigos e novos, e documentos de liquidação dos novos
  relatórios. Recebedor e gasto local são **declarações**, não pagamentos
  auditados. Relatório final e plano aprovado não certificam entrega ou contas.
- **SICONV:** lê integralmente, em fluxo, os ZIPs de emendas, propostas,
  convênios, licitações, contratos, pagamentos a favorecidos e medições.
  Exige proponente PB; encadeia documentos pelos IDs da proposta, convênio e
  licitação. `NR_EMENDA` tem oito dígitos e omite o exercício; por isso, sua
  coincidência com os oito últimos dígitos do código CGU gera apenas
  **candidatos**, mesmo quando há uma única emenda correspondente na carga.
  Uma associação pode aparecer em mais de um exercício. O ano do programa não
  é usado para confirmar o ano da emenda. Os registros candidatos podem ser
  de instrumentos antigos e precisam de conferência documental. Não constituem
  um indicador de execução financeira daquela emenda.

Um contrato ou convênio pode receber várias emendas, recursos próprios e
contrapartida. Seu valor global e seus pagamentos não são integralmente
atribuídos a cada emenda. Movimentos podem conter estornos; a situação na fonte
é exibida sem gerar somatórios. A presença de medição não significa conclusão.

## Executar as cargas

Na raiz, ambiente Python e PostgreSQL configurados:

```text
python -m etl.evidence --years 2023-2026
python -m etl.evidence --years 2023-2026 --sources queue
python -m etl.evidence --years 2023-2026 --sources siconv
```

O primeiro comando processa objetos/instrumentos estaduais e transferências
especiais. Pressupõe a carga das emendas, documentos estaduais e planos PB:
`etl.state`, `etl.state.documents`, `etl.federal` e
`etl.federal.load_transferegov`. Nenhuma chave CGU é usada pelas fontes
complementares. `--refresh` ignora os caches. SICONV baixa centenas de MB;
os arquivos nacionais são lidos sem carregá-los inteiros na memória.

`init_db` cria `amendment_evidence` e `evidence_import` via SQLAlchemy. Em
`backend`, execute `npm run prisma:generate` e `npm run build` e reinicie a API
após atualizar o código. Não é necessário zerar o banco.

As cargas substituem somente seu escopo de origem, exercício e fonte em
transação. Coleta ou paginação incompleta preserva a versão anterior daquele
escopo. Outras fontes já concluídas podem ter sido atualizadas antes de uma
falha posterior. Caches JSON são publicados atomicamente; ZIPs são validados
antes da substituição. Os dados ficam em `data/raw/evidence`, fora do Git.
Há retry exponencial nos GETs, cache e até quatro consultas simultâneas na fila.
Datas de coleta não são as datas de atualização interna da fonte.

## Solicitação original, atestes e prestação de contas

Não há conector público validado para obter automaticamente todo o conteúdo
do PBdoc ou relacionar toda obra do GeoPB a uma emenda. O sistema aceita
documentos públicos revisados, com trecho e processo que sustentem o vínculo.
Autoria parlamentar, proponente e solicitante original têm papéis distintos.

Prepare um JSON local com uma lista de documentos. Exemplo **ilustrativo, não
carregado na base**; substitua todos os campos pelos dados da peça real:

```json
[
  {
    "kind": "original_request",
    "title": "Ofício de solicitação",
    "source_url": "https://orgao.gov.br/processo-publico",
    "match_basis": "O ofício cita expressamente a emenda e seu exercício",
    "payload": {
      "nome": "Entidade solicitante identificada na peça",
      "papel": "demandante_original",
      "processo": "Identificador do processo",
      "documentoUrl": "https://orgao.gov.br/oficio-publico.pdf",
      "trecho": "Transcrição breve que identifica a demanda e a emenda",
      "revisadoPor": "Equipe responsável pela revisão documental",
      "revisadoEm": "2026-10-16"
    }
  }
]
```

```text
python -m etl.evidence.reviewed --file data/revisao.json --origin state --year 2024 --number 0576
```

Para emenda federal, use `--origin federal` e o código CGU completo. Tipos
aceitos: `original_request`, `delivery` e `accountability`. Entrega pode conter
ateste, medição assinada ou termo de recebimento; descreva o alcance da peça.
Informe apenas dados necessários à transparência, sem CPF, endereço pessoal
ou conta bancária. URLs devem ser HTTP(S), sem credenciais.

O importador exige emenda existente, processo, URL, trecho e identificação/data
da revisão. **Não verifica automaticamente a autenticidade ou o conteúdo do
PDF**: a revisão humana deve ocorrer antes da importação. Valida todo o arquivo
antes de gravar e substitui apenas os documentos revisados daquela emenda,
preservando outras emendas e fontes. O estado `reviewed` significa documento
revisado, sem certificar regularidade, entrega integral ou aprovação de contas.
Nenhum documento de solicitação ou ateste foi inventado ou importado no ensaio.

## API e validação

`GET /evidencias/:origin/:year/:number`, com `origin=state|federal`. Número
estadual pode conter zeros e `/exercício`; federal exige identidade existente
no ano informado. A resposta contém `evidencias`, `cobertura` e `observacao`.
Links perigosos são eliminados no servidor e no cliente. A tela permite filtrar
por tipo e carregar mais evidências, sem renderizar todos os registros de uma vez.

Verificação real, sem alterar os dados:

```text
cd backend
node scripts/verify-evidence-db.mjs
```

O script confere os casos reais 0576/2024 → Instituto Vem Cuidar de Mim e
0799/2024 → contrato EXA, além dos estados declarados/candidatos. As suítes
Python, Node e E2E cobrem isolamento, idempotência, falhas de coleta, identidade,
descarte de dados bancários, vínculos ambíguos, URLs e apresentação em desktop
e celular. Os E2E usam schema PostgreSQL temporário.

## Carga executada em 16/10/2026

Nos exercícios 2023–2026 foram gravadas 359 evidências de convênios/termos
estaduais, 40 de contratos e 1.270 menções candidatas de CNPJ nos objetos.
Transferências especiais produziram 53 evidências, incluindo 12 registros de relatórios
de gestão e oito despesas locais declaradas. SICONV produziu 18.996
associações candidatas entre emendas e registros de instrumentos/execução;
isso não equivale a 18.996 documentos distintos nem a vínculos confirmados.
2026 não tem relatórios especiais vinculados no escopo dos planos carregados.
Os totais são evidências, não quantidades de emendas com cadeia completa.

A coleta da fila estadual não foi concluída nesta execução: a fonte apresentou
timeouts de leitura e encerramentos de conexão, inclusive após novas tentativas.
A consulta foi interrompida, sem registrar um exercício incompleto como
integralmente consultado. Os caches das consultas concluídas foram preservados
para retomada pelo comando `--sources queue`; nenhum pagamento foi promovido
a confirmado por essa tentativa.

Solicitante original, pagamentos estaduais conciliados individualmente e
entrega física continuam dependendo de documentação e chaves oficiais quando
não constam nas fontes consultadas. O roteiro de fontes e o texto para pedir
dados estão em [pesquisa-fontes-rastreabilidade.md](pesquisa-fontes-rastreabilidade.md).
