import { useState, useHostTheme, Stack, Row, Grid, H1, H2, H3, Text, Table, Select, Divider } from "cursor/canvas";

type Metrics = { amendments: number; documentCount: number; author: number; function: number; organization: number; commitment: number; liquidation: number; payment: number; candidatePayment: number; detailedCreditor: number; object: number; beneficiary: number; source: number; positiveAggregatePaid: number; meanCurrentRF08: number; allPhases: number };
type Scope = { federal: Metrics; state: Metrics };
const m = (amendments:number, documentCount:number, author:number, fn:number, organization:number, commitment:number, liquidation:number, payment:number, candidatePayment:number, detailedCreditor:number, object:number, beneficiary:number, source:number, positiveAggregatePaid:number, meanCurrentRF08:number, allPhases:number):Metrics => ({amendments,documentCount,author,function:fn,organization,commitment,liquidation,payment,candidatePayment,detailedCreditor,object,beneficiary,source,positiveAggregatePaid,meanCurrentRF08,allPhases});
const data: Record<string,Scope> = {
  all: { federal:m(356,10550,356,356,356,356,301,298,0,354,317,354,0,206,93.7,298), state:m(2887,5838,2887,2831,2831,2296,2198,0,329,2296,2887,296,2831,2142,70.3,0) },
  "2023": { federal:m(81,2565,81,81,81,81,78,78,0,81,81,81,0,47,98.5,78), state:m(532,1118,532,512,512,441,402,0,54,441,532,12,512,400,70.2,0) },
  "2024": { federal:m(122,4223,122,122,122,122,109,109,0,122,122,122,0,69,95.7,109), state:m(848,1703,848,823,823,652,623,0,83,652,848,58,823,615,68.9,0) },
  "2025": { federal:m(93,3450,93,93,93,93,78,76,0,93,79,93,0,54,93.1,76), state:m(821,1934,821,816,816,715,696,0,111,715,821,24,816,686,74.1,0) },
  "2026": { federal:m(60,312,60,60,60,60,36,35,0,58,35,58,0,36,83.7,35), state:m(686,1083,686,680,680,488,477,0,81,488,686,202,680,441,67.8,0) },
};
const integer = (n:number) => n.toLocaleString("pt-BR");
const percent = (n:number,d:number) => (n/d*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const coverage = (n:number,d:number) => `${integer(n)} / ${integer(d)} (${percent(n,d)})`;

export default function Comparison() {
  const theme = useHostTheme();
  const [scope,setScope] = useState("all");
  const {federal:f,state:s} = data[scope];
  const selected = scope === "all" ? "2023–2026" : scope;
  return <Stack gap={20} style={{padding:24,maxWidth:1120,margin:"0 auto",color:theme.text.primary,background:theme.bg.editor}}>
    <Text tone="secondary">RASTREAEMENDAS · DIAGNÓSTICO DA BASE LOCAL · 15/10/2026</Text>
    <H1>Federal liga melhor os documentos; estadual ainda precisa confirmar os pagamentos</H1>
    <Text>Nenhuma das duas bases comprova toda a trajetória até a entrega física. A comparação abaixo mede o que está carregado no sistema, sem estimar a cobertura de todas as emendas existentes nas fontes.</Text>
    <Row gap={12} wrap><Text>Exercício das emendas</Text><Select value={scope} onChange={setScope} options={[{value:"all",label:"2023 a 2026"},...["2023","2024","2025","2026"].map(value=>({value,label:value}))]} /></Row>
    <Grid columns="repeat(auto-fit,minmax(280px,1fr))" gap={24}>
      <section style={{borderTop:`2px solid ${theme.accent.primary}`,paddingTop:14}}>
        <H2>Federal destinada à Paraíba</H2>
        <Text weight="bold" style={{fontSize:24}}>{coverage(f.allPhases,f.amendments)}</Text>
        <Text>Emendas com documentos das três fases registrados: empenho, liquidação e pagamento.</Text>
        <Text tone="secondary">{integer(f.amendments)} emendas · {integer(f.documentCount)} vínculos documento–emenda</Text>
      </section>
      <section style={{borderTop:`2px solid ${theme.stroke.primary}`,paddingTop:14}}>
        <H2>Estadual da Paraíba</H2>
        <Text weight="bold" style={{fontSize:24}}>{coverage(s.commitment,s.amendments)}</Text>
        <Text>Emendas com nota de empenho vinculada. Há {integer(s.candidatePayment)} emendas com pagamentos candidatos; nenhuma tem pagamento confirmado pelas regras atuais.</Text>
        <Text tone="secondary">{integer(s.amendments)} emendas · {integer(s.documentCount)} documentos confirmados ou candidatos</Text>
      </section>
    </Grid>
    <Text tone="secondary">Os destaques medem etapas diferentes: fechamento das três fases na federal e vínculo de empenho na estadual. Consulte as mesmas etapas lado a lado abaixo.</Text>
    <H2>Evidências por etapa · {selected}</H2>
    <Table headers={["Etapa / indicador","Federal → PB","Estadual PB"]} rows={[
      ["Autor identificado",coverage(f.author,f.amendments),coverage(s.author,s.amendments)],
      ["Origem orçamentária","Programa, ação e órgão; fonte de recurso não armazenada em campo próprio",`${coverage(s.source,s.amendments)} com fonte informada; não reconstitui toda a arrecadação`],
      ["Finalidade / objeto",`${coverage(f.object,f.amendments)} com histórico/observação documental; campo diferente de objeto formal`,`${coverage(s.object,s.amendments)} com objeto formal da emenda`],
      ["Solicitante original","Sem fonte integrada que o comprove","Sem fonte integrada que o comprove"],
      ["Órgão executor identificado",coverage(f.organization,f.amendments),coverage(s.organization,s.amendments)],
      ["Empenho: documento vinculado",coverage(f.commitment,f.amendments),coverage(s.commitment,s.amendments)],
      ["Liquidação: documento vinculado",coverage(f.liquidation,f.amendments),coverage(s.liquidation,s.amendments)],
      ["Pagamento: documento vinculado",coverage(f.payment,f.amendments),`${coverage(s.payment,s.amendments)} confirmado; ${integer(s.candidatePayment)} emendas com candidatos`],
      ["Favorecido / credor em documento",`${coverage(f.detailedCreditor,f.amendments)}; pode ser destinatário de um repasse`,`${coverage(s.detailedCreditor,s.amendments)}; credor não equivale ao beneficiário final`],
      ["Beneficiário final comprovado","Não medido como campo equivalente; favorecido pode ser prefeitura, fundo ou fornecedor",`${coverage(s.beneficiary,s.amendments)} com campo beneficiário final preenchido; não comprova entrega`],
      ["Valor pago positivo em alguma linha agregada",coverage(f.positiveAggregatePaid,f.amendments),coverage(s.positiveAggregatePaid,s.amendments)],
      ["Entrega física / prestação de contas","Sem evidência integrada","Sem evidência integrada"],
    ]} />
    <Text tone="secondary">Fonte: PostgreSQL local, consulta de 15/10/2026. Denominadores: emendas do exercício selecionado. Presença de documentos não comprova conciliação contábil, saldo líquido ou entrega. As contagens de fase incluem documentos de anulação; o RF-08 estadual aplica filtros adicionais para movimento positivo.</Text>
    <Divider />
    <H2>Por que os percentuais RF-08 não são uma disputa direta</H2>
    <Table headers={["Regra atual","Federal","Estadual"]} rows={[
      ["Média dos scores individuais",`${f.meanCurrentRF08.toLocaleString("pt-BR")}/100`,`${s.meanCurrentRF08.toLocaleString("pt-BR")}/100`],
      ["Critérios","Presença das três fases, função e código de órgão","Mesmos cinco critérios, exigindo vínculo confirmado e movimento positivo nas fases"],
      ["Pagamento","Conta a existência do documento associado à emenda","Candidatos não pontuam: a fonte não identifica o exercício do empenho no pagamento"],
      ["O que 100 significa","Cinco critérios presentes; não prova gasto final após um repasse","Cinco critérios presentes; não prova entrega física"],
    ]} />
    <Text>O bloqueio atual da etapa de pagamento limita o RF-08 estadual a 80/100. Isso é uma limitação da confirmação documental, não evidência de ausência de pagamentos. No recorte selecionado, {integer(s.positiveAggregatePaid)} emendas estaduais têm valor pago positivo na execução agregada.</Text>
    <H2>O que falta para a rastreabilidade que você definiu</H2>
    <Stack gap={12}>
      <div><H3>1. Fechar a ligação estadual com pagamentos</H3><Text>Obter o exercício do empenho ou outro identificador inequívoco. Hoje existem 475 autorizações candidatas nas quatro cargas, abrangendo 329 emendas; não promover coincidências a comprovação.</Text></div>
      <div><H3>2. Acompanhar o gasto depois dos repasses federais</H3><Text>Documento de pagamento da União pode comprovar repasse ao estado ou município. O gasto posterior, a contratação e a entrega pelo destinatário exigem fontes e ligações adicionais. O RF-08 federal alto não fecha essa etapa.</Text></div>
      <div><H3>3. Integrar demanda original e comprovação da entrega</H3><Text>Localizar ofícios, propostas, convênios, atestes, medições e prestações de contas. Autoria parlamentar não comprova solicitante original. Contrato ou pagamento não comprova entrega física.</Text></div>
    </Stack>
    <Divider />
    <Text tone="secondary">Escopo temporal: estaduais de 2023–2025 com os 12 meses consultados; estaduais de 2026 de janeiro a outubro (outubro parcial). A federal reflete o snapshot já carregado, sem nova coleta nesta análise. O recorte federal por localidade explícita PB não inclui automaticamente emendas Nacional/MÚLTIPLO. Universo e atualização diferem entre as bases.</Text>
    <Text tone="secondary">Reprodução: tmp/compare-traceability.mjs; métricas: tmp/traceability-comparison.json. Fórmulas: calculate-traceability.ts (federal) e state-trail.ts (estadual). Somar vínculos federais não equivale a contar documentos únicos entre emendas.</Text>
  </Stack>;
}
