import { useState, useHostTheme, Stack, Row, Grid, H1, H2, H3, Text, Table, Select, Link, Divider } from "cursor/canvas";

const findings = [
  {status:"testado",gap:"Beneficiário estadual",source:"Convênios PB",url:"https://api.dados.pb.gov.br/api/v1/convenios/estado_municipios?ano=2024&per_page=2",key:"Emenda/ano explícitos no detalhamento + objeto e autoria; cadastro CGE para avançar a outros registros",result:"0576/2024 → Termo de Fomento 0025/2024 → Instituto Vem Cuidar de Mim, João Pessoa. O campo beneficiário da listagem está vazio.",limit:"Instrumento identifica convenente e objeto, sem comprovar execução ou entrega. Amostra testada; cobertura total não calculada."},
  {status:"testado",gap:"Contratação estadual",source:"Contratos PB → PNCP",url:"https://api.dados.pb.gov.br/api/v1/compras/contratos?anoInicioVigencia=2024&registroCge=24121772&per_page=2",key:"Cadastro CGE normalizado, número do contrato e CNPJ do contratado",result:"0799/2024 → CGE 24-12177-2 → contrato 0565/2024 → PNCP 08778268000160/2024/318.",limit:"Duas unidades repetem o contrato. Deduplicar pelo identificador PNCP; não atribuir todo o valor contratual à emenda."},
  {status:"testado",gap:"Beneficiário em texto",source:"Objetos da base local",url:"https://api.dados.pb.gov.br/swagger/",key:"Trecho do objeto + CNPJ validado + confirmação em instrumento",result:"1.214 de 2.887 objetos contêm padrão de CNPJ (42,1%). A emenda 0576/2024 é um caso confirmado por outra fonte.",limit:"Padrão de CNPJ é candidato, não 1.214 beneficiários comprovados. Manter papéis de credor, executor e beneficiário separados."},
  {status:"pendente",gap:"Pagamento estadual",source:"Ordem cronológica PB",url:"https://api.dados.pb.gov.br/swagger/",key:"Empenho, liquidação, autorização, unidade, contrato, credor e fonte; falta resolver o exercício do empenho",result:"Endpoint respondeu com dados, inclusive anulações e valores zero. Uma consulta para o empenho 6595 / AP 13217, em dezembro de 2024, não retornou correspondência.",limit:"Não comprovou uma chave universal. Fila não equivale a pagamento. Pedir à CGE/SEFAZ a ligação contábil e o exercício do empenho."},
  {status:"documentado",gap:"Gasto após transferência especial",source:"Transferegov Especiais",url:"https://api-publica.transferegov.gestao.gov.br/especiais/docs",key:"Emenda → id_plano_acao → plano/executor → relatório → documentos de execução",result:"APIs de relatórios novos e legados, documentos de liquidação, metas e gestão financeira estão documentadas e acessíveis.",limit:"Os relatórios consultados para o plano PB 67971 vieram vazios. Validar cobertura e cadastro. Documento do repasse não comprova aplicação pelo beneficiário."},
  {status:"documentado",gap:"Gasto após convênio federal",source:"Transferegov / arquivos SICONV",url:"https://api-publica.transferegov.gestao.gov.br/downloads",key:"Validar chaves entre emenda, proposta, instrumento, licitação, contrato e pagamento do convenente",result:"Listagem confirmou arquivos de emendas, propostas, convênios, licitações, contratos, pagamentos, OBTV e medições de obras.",limit:"Arquivos localizados; cruzamento PB ainda não executado. Desembolso da União e pagamento ao fornecedor são etapas distintas."},
  {status:"documentado",gap:"Solicitante da indicação federal",source:"Transferegov Parcerias",url:"https://api-publica.transferegov.gestao.gov.br/parcerias/docs",key:"Número/ano da emenda e beneficiário; indicacao_id_solicitante, indicacao_nm_solicitante, indicacao_tp_solicitante",result:"Os campos existem na especificação. A consulta de beneficiários PB/2024 veio vazia; propostas PB/2024 retornaram dados.",limit:"Solicitante da indicação não equivale ao demandante original. Proposta em elaboração ou rejeitada não comprova execução."},
  {status:"documentado",gap:"Comprovação da entrega",source:"GeoPB / PNCP / relatórios",url:"https://geopb.tce.pb.gov.br/",key:"Contrato, órgão, empresa e identidade da obra; documento assinado de medição, ateste ou recebimento",result:"GeoPB oferece evolução, medições e arquivos de obras; PNCP documenta acesso aos arquivos do contrato. O registro GeoPB examinado não tinha documento de finalização.",limit:"Nenhum vínculo GeoPB–emenda da base foi comprovado nesta pesquisa. NF, contrato e declaração não substituem recebimento atestado."},
  {status:"pendente",gap:"Demanda original estadual",source:"PBdoc / secretaria executora",url:"https://plone-codata-portal.apps.codataprd.pb.gov.br/portal_pbdoc/manual",key:"Número do processo/ofício já citado na nota, plano de trabalho e identificação do proponente",result:"Manuais confirmam processos e documentos consultáveis conforme permissões. Existe orientação de consulta com gov.br.",limit:"Sem API pública de conteúdo validada. Tramitação não garante acesso às peças. Pedir os documentos públicos pelo SIC quando necessário."},
];
const labels:Record<string,string> = {testado:"Comprovação em amostra",documentado:"Fonte documentada; integração pendente",pendente:"Depende de validação ou acesso à informação"};

export default function Research() {
  const theme=useHostTheme();
  const [filter,setFilter]=useState("all");
  const shown=findings.filter(f=>filter==="all"||filter===f.status);
  return <Stack gap={20} style={{maxWidth:1150,padding:24,margin:"0 auto",background:theme.bg.editor,color:theme.text.primary}}>
    <Text tone="secondary">RASTREAEMENDAS · PESQUISA EM FONTES OFICIAIS · 15/10/2026</Text>
    <H1>Há fontes adicionais para avançar; o pagamento estadual ainda exige uma chave segura</H1>
    <Text>Foram testadas consultas públicas e examinadas especificações e documentos oficiais. A pesquisa identificou caminhos de integração, sem alterar a classificação dos pagamentos ou recalcular a rastreabilidade do sistema.</Text>
    <Grid columns="repeat(auto-fit,minmax(280px,1fr))" gap={24}>
      <section style={{paddingTop:12,borderTop:`2px solid ${theme.accent.primary}`}}>
        <H2>Dois vínculos já comprovados</H2>
        <Text>0576/2024 → instrumento e beneficiário.</Text>
        <Text>0799/2024 → contrato estadual e PNCP.</Text>
        <Text tone="secondary">Casos concretos sustentam a integração de convênios e contratos por referência da emenda e cadastro CGE.</Text>
      </section>
      <section style={{paddingTop:12,borderTop:`2px solid ${theme.stroke.primary}`}}>
        <H2>O que não foi resolvido</H2>
        <Text>Exercício do empenho nos pagamentos estaduais, demanda original em todos os casos e entrega física de cada objeto.</Text>
        <Text tone="secondary">O relatório inclui um pedido de dados à CGE/SEFAZ e referências para localizar as peças públicas nos processos.</Text>
      </section>
    </Grid>
    <Row gap={12} wrap><Text>Filtrar pelo nível de comprovação</Text><Select value={filter} onChange={setFilter} options={[{value:"all",label:"Todos os achados"},...Object.entries(labels).map(([value,label])=>({value,label}))]} /></Row>
    <H2>Mapa das lacunas, fontes e chaves</H2>
    <Table headers={["Lacuna / fonte","O que liga os registros","Resultado e limite"]} rows={shown.map(f=>[
      <Stack gap={6}><Text weight="bold">{f.gap}</Text><Link href={f.url}>{f.source}</Link><Text tone="secondary">{labels[f.status]}</Text></Stack>,
      f.key,
      <Stack gap={8}><Text>{f.result}</Text><Text tone="secondary">{f.limit}</Text></Stack>,
    ])} />
    <Text tone="secondary">Fontes: consultas oficiais e base local. Os resultados de amostra não são estimativas da cobertura de toda a Paraíba. A pesquisa não comprova entrega em nenhum dos exemplos estaduais.</Text>
    <Divider />
    <H2>Separar os papéis é necessário para responder “quem solicitou”</H2>
    <Table headers={["Papel","Evidência a buscar"]} rows={[
      ["Autor da emenda","Cadastro e ato parlamentar"],
      ["Solicitante da indicação","Campo específico da indicação e atas/ofícios correspondentes"],
      ["Proponente / demandante original","Proposta, ofício de solicitação ou peça inicial do processo administrativo"],
      ["Credor contratado","Nota, contrato, CNPJ e documento de pagamento"],
      ["Beneficiário do objeto","Plano de trabalho e instrumento; pode ser diferente do recebedor financeiro"],
    ]} />
    <Text>A API de Parcerias oferece campos de solicitante da indicação, mas isso não identifica automaticamente a entidade ou pessoa que apresentou a demanda ao parlamentar. Preservar os papéis e a prova documental de cada um.</Text>
    <H2>Entrega: qual evidência sustenta qual afirmação?</H2>
    <Text>Contrato comprova a obrigação contratada; documento fiscal registra cobrança; medição/ateste/termo de recebimento documenta a verificação do objeto. Relatório apresentado pelo gestor deve manter identificação de quem declarou e do órgão que analisou. Publicação de documento não equivale a auditoria independente.</Text>
    <Row gap={16} wrap><Link href="https://pncp.gov.br/manual/pt-br/latest/contrato_empenho/consultar_todos_os_documentos_de_um_contrato_ou_empenho.html">Arquivos de contratos no PNCP</Link><Link href="https://geopb.tce.pb.gov.br/consulta/detalhes/5975">Exemplo de obra no GeoPB</Link><Link href="https://portalfns.saude.gov.br/consultas/">Consultas FNS para saúde</Link></Row>
    <H2>Plano de avanço</H2>
    <Stack gap={10}>
      <div><H3>1. Convênios e contratos estaduais</H3><Text>Integrar referências de emenda, cadastro CGE, instrumento, destinatário e contrato. Guardar evidência do vínculo e deduplicar por identificador do instrumento.</Text></div>
      <div><H3>2. Beneficiários extraídos com validação</H3><Text>A base tem 1.214 objetos com padrão de CNPJ. Extrair candidatos com trecho e origem, validar CNPJ e confrontar com o instrumento; não promover fornecedor a beneficiário final.</Text></div>
      <div><H3>3. Chave contábil dos pagamentos</H3><Text>Validar a ordem cronológica e solicitar à CGE/SEFAZ o exercício do empenho e a relação emenda–nota–liquidação–autorização/ordem. Manter candidatos enquanto faltar prova.</Text></div>
      <div><H3>4. Execução posterior ao repasse federal</H3><Text>Expandir por modalidade: especiais; convênios/contratos de repasse; saúde. O Transferegov atual tem novos endpoints e paginação diferente do cliente legado do projeto.</Text></div>
      <div><H3>5. Documentos de demanda e entrega</H3><Text>Referenciar processo e peças públicas, identificar o emissor e manter validação documental. O relatório contém minuta de pedido de acesso à informação, ainda não enviada.</Text></div>
    </Stack>
    <Divider />
    <Text tone="secondary">Classificação contábil: a Nota Técnica STN 2916/2026 distingue CO e EP. Esses marcadores ajudam a identificar origem/tipo; não individualizam sozinhos uma emenda. O envio de EP na MSC é previsto a partir de 2027, sem fechar retroativamente 2023–2026.</Text>
    <Link href="https://cdn.tesouro.gov.br/sistemas-internos/apex/producao/sistemas/thot/arquivos/publicacoes/33484_1042177/anexos/28106_931915/SEI_60550926_Nota_Tecnica_2916.pdf">Nota técnica do Tesouro</Link>
    <Text tone="secondary">Relatório completo, consultas e minuta: docs/pesquisa-fontes-rastreabilidade.md. Reprodução dos testes: tmp/research-traceability-links.mjs. Nenhuma das fontes localizadas garante preenchimento integral de todos os exercícios.</Text>
  </Stack>;
}
