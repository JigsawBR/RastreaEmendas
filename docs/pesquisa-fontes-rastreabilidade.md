# Fontes para fechar as lacunas de rastreabilidade

Pesquisa realizada em 15/10/2026. Escopo: emendas federais destinadas à Paraíba e emendas estaduais da Paraíba, com foco nas lacunas do sistema atual. Os testes foram consultas de leitura; não representam uma nova integração ou uma estimativa de cobertura final.

## Resultado

Há caminhos concretos para avançar nas quatro lacunas. Dois vínculos estaduais adicionais foram comprovados em amostras: emenda–instrumento–beneficiário e empenho–contrato–PNCP. O pagamento estadual ainda exige uma chave inequívoca do exercício do empenho; a pesquisa não comprovou uma solução universal. Solicitante e entrega exigem distinguir papéis e tipos de evidência, além de incorporar documentos.

## 1. Federal: gasto depois do repasse

### Transferências especiais

A [nova API de Especiais](https://api-publica.transferegov.gestao.gov.br/especiais/docs) documenta planos, executores, metas, relatórios e dados financeiros. A especificação JSON foi consultada diretamente em `/especiais/openapi.json` e inclui:

- `/planos-acao-especiais`: identificador do plano e número/ano da emenda;
- `/planos-trabalho-especiais`, `/executores-especiais` e `/meta-especiais`;
- `/relatorios-gestao-especiais` e `/relatorios-gestao-novos-especiais`, filtráveis por `id_plano_acao`;
- `/relatorios-gestao-documento-liquidacao-especiais`, filtrável por `id_relatorio_gestao_novo`;
- `/gestao-financeira-lancamentos-especiais` e `/gestao-financeira-subtransacoes-especiais`.

A integração proposta é emenda → plano de ação → executor/plano de trabalho → relatório de gestão → documentos de execução. Nem todo endpoint financeiro é gasto final: documentos hábeis e ordens de pagamento também podem tratar do repasse da União. Conferir a semântica de cada tabela antes de atribuir uma etapa.

O [FAQ oficial das especiais](https://www.gov.br/transferegov/pt-br/sobre/transferencias-especiais/perguntas-frequentes-faq/perguntas-frequente-faq-sobre-transferencia-especial/) indica o relatório de gestão como local de documentação da aplicação dos recursos, incluindo registros de contratação e recebimento. A publicação ou declaração do gestor não equivale a auditoria independente. No plano PB `67971`, consultado como amostra, os dois endpoints de relatório retornaram listas vazias. Isso não demonstra ausência de execução ou de relatórios em toda a PB; é necessário conferir a cobertura e o cadastro do plano na nova API e na consulta pública.

### Convênios e contratos de repasse

O [repositório oficial de arquivos](https://api-publica.transferegov.gestao.gov.br/downloads) expõe conjuntos que vão além do desembolso federal. A listagem do armazenamento foi acessada e confirmou `siconv_emenda.zip`, `siconv_proposta.zip`, `siconv_convenio.zip`, `siconv_licitacao.zip`, `siconv_contrato.zip`, `siconv_pagamento.zip`, `siconv_obtv_convenente.zip` e `siconv_acomp_obras_contratos_medicoes_modulo_empresas.zip`.

O próximo teste deve baixar os dicionários e validar as chaves reais entre emenda, proposta, instrumento, licitação, contrato e pagamento do convenente. A presença desses arquivos foi confirmada; não foi calculada a cobertura da PB nem executado o cruzamento desses CSVs. Não confundir `siconv_desembolso` com pagamento final ao fornecedor. O Transferegov [descreve a consulta pública](https://www.gov.br/pt-br/servicos/consultar-dados-da-plataforma-mais-brasil?id=12471&origem=servico) como acesso a propostas, execução e prestação de contas dos instrumentos cadastrados.

### Saúde e execução municipal

Para transferências da saúde, as [consultas oficiais do FNS](https://portalfns.saude.gov.br/consultas/) oferecem proposta FAF-FNS, pagamentos detalhados e convênios. Devem ser usadas por proposta, beneficiário e instrumento, conforme a modalidade; não foi validada uma API pública de gasto final do destinatário nesta pesquisa.

O TCE-PB informa que o [Observatório/SAGRES permite consultar pagamentos estaduais e municipais](https://tce.pb.gov.br/noticias/presidente-do-tce-pb-reune-imprensa-em-cafe-com-dados-e-apresenta-novas-ferramentas-de-transparencia/). É uma fonte complementar para a aplicação local. O portal atual [SAGRES Cidadão](https://sagrescidadao.tce.pb.gov.br/) apresentou CAPTCHA nesta inspeção; uma API/exportação pública atual não foi validada. Priorizar exportações oficiais ou solicitação do leiaute ao TCE, sem presumir uma integração disponível.

Regra de ligação proposta: exigir referência à emenda, instrumento, proposta ou classificação complementar que individualize a despesa. CNPJ do município, proximidade de datas ou fonte de recursos genérica, isoladamente, não identificam a emenda específica.

## 2. Estadual: beneficiário além do campo vazio

### Vínculo real comprovado: emenda 0576/2024

Na base local, o campo `beneficiario_final` dessa emenda é `NULL`. Entretanto, o objeto identifica o Instituto Vem Cuidar de Mim e seu CNPJ.

A [consulta oficial de convênios de 2024](https://api.dados.pb.gov.br/api/v1/convenios/estado_municipios?ano=2024&per_page=2) retornou o Termo de Fomento `0025/2024`, cadastro CGE `25-80015-9`, convenente **Instituto Vem Cuidar de Mim**, município de João Pessoa e detalhamento com referência explícita à emenda `576/2024` e à autoria. Também informa o endereço do documento do instrumento. Embora o nome do endpoint seja Estado–Municípios, a amostra inclui entidades privadas e termos de fomento.

Portanto, o campo vazio da listagem não impede identificar o destinatário em outra fonte. A referência explícita emenda/ano e a compatibilidade de objeto e autoria sustentam esse caso. O instrumento ainda não comprova a entrega dos cursos.

### Extração dos objetos

Uma busca local encontrou **1.214 de 2.887 objetos (42,1%) com padrão textual de CNPJ**. Esse é um indicador de potencial de extração, não de 1.214 beneficiários validados. Podem existir vários CNPJs ou papéis diferentes no mesmo texto.

Implementação recomendada: manter o campo original e acrescentar identificações com origem, trecho de evidência, CNPJ validado, papel (convenente, beneficiário indicado, credor ou executor) e estado de validação. Cruzar candidatos com cadastro CGE, documento do convênio e objeto; não preencher automaticamente beneficiário final com o nome do fornecedor.

### Vínculo real comprovado: emenda 0799/2024

O registro CGE `24121772` das notas foi encontrado na [API de contratos](https://api.dados.pb.gov.br/api/v1/compras/contratos?anoInicioVigencia=2024&registroCge=24121772&per_page=2), formatado como `24-12177-2`. A resposta identifica o contrato `0565/2024`, a EXA Engenharia e Arquitetura, o processo e a URL do [contrato no PNCP](https://pncp.gov.br/app/contratos/08778268000160/2024/318).

A ligação usa cadastro CGE normalizado, contrato e CNPJ compatíveis com as notas. Há duas linhas do mesmo contrato, associadas a códigos de unidades diferentes: deduplicar pelo identificador do contrato/PNCP antes de totalizar. O valor total do contrato não deve ser atribuído integralmente à emenda; um contrato pode ter outras fontes e aditivos. Esse caso comprova o vínculo contratual, não a entrega ou o pagamento.

## 3. Estadual: confirmar pagamentos

O [Swagger estadual](https://api.dados.pb.gov.br/swagger/) documenta `/despesas/ordem_cronologica_pagamentos` e `/despesas/ordem_cronologica_pagamentos_rp`. Há campos de empenho, autorização de pagamento, liquidação, contrato, unidade gestora, credor, fonte, status e data de execução. Esses elementos podem reforçar uma correspondência e distinguir movimentos de restos a pagar.

O endpoint comum respondeu à amostra de dezembro de 2024, mas também trouxe anulação de liquidação e `valorPago = 0`. Na amostra, registros de referência dezembro/2024 tinham data de execução em janeiro/2025. Logo, pertencer à fila não comprova pagamento e ano de referência não deve ser presumido como exercício do empenho.

A consulta filtrada para a emenda candidata `0861/2024` (empenho `6595`, autorização `13217`) não retornou registro na ordem cronológica daquele mês. O endpoint de restos a pagar também não retornou registros na pequena consulta testada. São resultados de amostra; não provam inexistência de pagamento ou indisponibilidade em todos os períodos.

**Conclusão:** existe uma fonte complementar para investigar, mas não foi comprovado o fechamento universal dessa lacuna. A ação decisiva é obter da CGE/SEFAZ o vínculo entre emenda, exercício do empenho, unidade, nota e autorização/ordem de pagamento, ou a chave original do sistema contábil. As classificações de órgão/unidade das fontes também precisam de correspondência oficial.

## 4. Solicitante original: separar três papéis

É necessário distinguir autor da emenda, solicitante da indicação parlamentar e proponente/demandante original.

A [API de Parcerias do Transferegov](https://api-publica.transferegov.gestao.gov.br/parcerias/docs), em `/beneficiario_emenda_parlamentar`, documenta `indicacao_id_solicitante`, `indicacao_nm_solicitante` e `indicacao_tp_solicitante`. O endpoint de indicação também registra apoiadores. Esses campos podem identificar o agente da indicação, sem demonstrar quem procurou originalmente o parlamentar. A consulta PB/2024 testada retornou lista vazia; a existência do campo não garante preenchimento histórico.

O endpoint `/proposta`, filtrado para PB/2024, retornou propostas com ente recebedor, problema, público-alvo e resultado esperado, inclusive em situações de elaboração/rejeição. Uma proposta não pode ser tratada como emenda executada sem o vínculo ao instrumento e o respectivo status.

A [Portaria Conjunta de 15/01/2026, atualizada em setembro](https://www.gov.br/transferegov/pt-br/legislacao/portarias/portaria-conjunta-mpo-mgi-sri-pr-no-2-de-15-de-janeiro-de-2026) trata de propostas, indicações e registros de solicitantes em emendas coletivas. Sua aplicabilidade não significa que todos os campos estejam publicados para 2023–2026.

Na PB, o caminho documental é o processo administrativo, os ofícios de solicitação e o plano de trabalho. O [manual oficial do PBdoc](https://plone-codata-portal.apps.codataprd.pb.gov.br/portal_pbdoc/manual) descreve identificação dos processos e documentos; a [orientação sobre consulta](https://plone-codata-portal.apps.codataprd.pb.gov.br/portal_pbdoc/mural-de-avisos/atualizacao-do-pbdoc-versao-10-0.121) prevê acesso gov.br. Consulta de tramitação não assegura acesso integral às peças. Não foi validada uma API pública de conteúdo. Usar o número do processo já presente na nota e solicitar as peças públicas quando necessário.

## 5. Entrega: buscar o documento que atesta o objeto

O [GeoPB](https://geopb.tce.pb.gov.br/) tem consulta pública de obras. Um [registro público examinado](https://geopb.tce.pb.gov.br/consulta/detalhes/5975) apresenta medições, pagamentos, evolução e arquivos; o documento de finalização estava ausente naquele registro. A busca deve usar contrato, órgão, empresa e objeto e exigir confirmação da identidade da obra. O exemplo confirma a estrutura da fonte, sem relação comprovada com uma emenda da base.

O [PNCP permite consultar os arquivos de um contrato/empenho](https://pncp.gov.br/manual/pt-br/latest/contrato_empenho/consultar_todos_os_documentos_de_um_contrato_ou_empenho.html), por CNPJ do órgão, ano e sequencial PNCP. O portal também passou a [recepcionar fontes orçamentárias e instrumentos de cobrança](https://www.gov.br/pncp/pt-br/central-de-conteudo/noticias/portal-nacional-de-contratacoes-publicas-passa-a-recepcionar-e-exibir-origem-dos-recursos-orcamentarios-em-contratacoes-publicas). A API documenta consulta de documentos fiscais, mas sua existência não garante notas fiscais ou atestes para cada contrato histórico.

Para afirmar recebimento, buscar termo de recebimento provisório/definitivo, ateste do fiscal, medição assinada ou relatório de cumprimento do objeto. Nota fiscal demonstra cobrança/documentação fiscal; contrato demonstra obrigação; declaração do gestor demonstra informação prestada. Registrar essas categorias separadamente, com URL, data, identificação do emissor e arquivo verificável. Nem mesmo um ateste publicado equivale, por si só, a auditoria independente da obra.

## 6. Classificação contábil: útil, mas não é a chave de uma emenda específica

A [Nota Técnica STN 2916/2026](https://cdn.tesouro.gov.br/sistemas-internos/apex/producao/sistemas/thot/arquivos/publicacoes/33484_1042177/anexos/28106_931915/SEI_60550926_Nota_Tecnica_2916.pdf) distingue CO, usado no acompanhamento de transferências recebidas, de EP, usado na identificação de emendas do próprio ente. EP classifica tipos de emenda; não individualiza sozinho o número de uma emenda. O envio da informação EP na MSC é previsto a partir de 2027, portanto não fecha retroativamente a base de 2023–2026. Conferir os campos efetivamente publicados pelo ente e solicitar sua correspondência com as chaves locais.

## 7. Pedido de dados pronto para adaptação

Destinatários sugeridos: CGE/SEFAZ para vínculos contábeis; SEPLAG e secretaria executora para identificação da demanda e documentos. Protocolar no canal oficial de acesso à informação indicado no [Portal da Transparência da PB](https://transparencia.pb.gov.br/perguntas-frequentes). Texto preparado para revisão; nenhum pedido foi enviado nesta pesquisa.

> Solicito acesso aos dados existentes relativos à execução das emendas parlamentares estaduais da Paraíba dos exercícios de 2023 a 2026, preferencialmente em CSV ou JSON, acompanhados de dicionário de dados. Solicito a relação entre número e exercício da emenda, órgão e unidade gestora, número e exercício do empenho, documento de liquidação, autorização/ordem de pagamento, data, situação e valor do pagamento, identificação de restos a pagar, cadastro CGE e número do contrato/convênio, quando disponíveis. Peço a identificação da chave original que relaciona esses registros e a correspondência entre os códigos de órgãos/unidades usados nas bases públicas. Solicito também os campos existentes de proponente, beneficiário e solicitante da demanda, com referências aos ofícios e processos administrativos. Para documentos de execução, peço indicação de onde consultar as peças públicas, incluindo plano de trabalho, solicitação original, medições, atestes e termos de recebimento. Caso os registros estejam em bases distintas, solicito os arquivos existentes e a descrição das chaves de ligação. Dados pessoais sem relação com a finalidade de transparência podem ser suprimidos.

## Sequência de implementação recomendada

1. Integrar convênios estaduais e contratos por cadastro CGE; preservar papéis distintos dos participantes. Os dois vínculos exemplificados já foram testados.
2. Extrair beneficiários candidatos dos objetos, validando CNPJ e retendo trecho/fonte; não alterar a informação original.
3. Testar a ordem cronológica e obter a chave contábil de exercício do empenho por acesso à informação; manter pagamentos ambíguos como candidatos.
4. Expandir a integração federal por modalidade: especiais, convênios/contratos de repasse e saúde. Usar referências de instrumento e validar a aplicação posterior, sem confundir repasse com gasto final.
5. Acrescentar evidências de solicitação e entrega com revisão documental e proveniência. A aplicação deve dizer qual peça comprova qual afirmação e qual informação continua não localizada.

Scripts de pesquisa e respostas selecionadas estão em `tmp/research-traceability-links.mjs` e `tmp/traceability-research-samples.json`. Especificações consultadas: `tmp/research-especiais-openapi.json`, `tmp/research-parcerias-openapi.json` e a especificação estadual em `tmp/pb-swagger.json`. As amostras não sustentam um novo percentual de rastreabilidade; este só deve ser calculado depois da integração e validação.
