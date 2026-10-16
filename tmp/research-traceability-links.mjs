import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
require('dotenv').config({path:fileURLToPath(new URL('../backend/.env',import.meta.url)),quiet:true});
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const wait = ms => new Promise(r=>setTimeout(r,ms));
async function get(url) {
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(45000)});
      const text = await response.text();
      if([429,500,502,503,504].includes(response.status) && attempt<3) { await wait(1000*2**attempt); continue; }
      return {url,status:response.status,text};
    } catch(error) { if(attempt===3) return {url,error:String(error.cause??error)}; await wait(1000*2**attempt); }
  }
}
const results=[];
try {
  const payment=await db.state_expense_document.findFirst({where:{year:2024,kind:'payment',link_status:'candidate'},orderBy:[{month:'desc'},{id:'asc'}]});
  if(payment) {
    const p=payment.payload;
    console.log('Candidate to check:',JSON.stringify({year:payment.year,month:payment.month,amendment:payment.amendment_number,commitment:p.numeroEmpenho,payment:p.numeroDocumento,organ:p.codigoOrgao}));
    const url=new URL('https://api.dados.pb.gov.br/api/v1/despesas/ordem_cronologica_pagamentos');
    for(const [key,value] of Object.entries({ano:2024,mes:payment.month,numeroEmpenho:p.numeroEmpenho,cnpjCpfCredor:p.cnpjCpfCredor,per_page:10})) url.searchParams.set(key,String(value));
    const response=await get(url);
    if(response.text) {
      try { const body=JSON.parse(response.text); response.sample=body.dados; response.pagination=body.paginacao; } catch {}
      delete response.text;
    }
    results.push(response); console.log('Chronology:',JSON.stringify(response));
  }
  for(const url of [
    'https://api-publica.transferegov.gestao.gov.br/especiais/openapi.json',
    'https://api-publica.transferegov.gestao.gov.br/parcerias/openapi.json',
    'https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov/?restype=container&comp=list',
    'https://api-publica.transferegov.gestao.gov.br/parcerias/beneficiario_emenda_parlamentar?sg_uf_beneficiario_emenda=PB&aa_emenda=2024&tamanho_da_pagina=2',
    'https://api-publica.transferegov.gestao.gov.br/parcerias/proposta?sg_uf_recebedor=PB&ano_proposta=2024&tamanho_da_pagina=2',
    'https://api.dados.pb.gov.br/api/v1/despesas/ordem_cronologica_pagamentos?ano=2024&mes=12&per_page=2',
    'https://api.dados.pb.gov.br/api/v1/despesas/ordem_cronologica_pagamentos_rp?ano=2024&mes=12&per_page=2',
    'https://api.dados.pb.gov.br/api/v1/convenios/estado_municipios?ano=2024&per_page=2',
    'https://api.dados.pb.gov.br/api/v1/compras/contratos?anoInicioVigencia=2024&registroCge=24121772&per_page=2',
  ]) {
    const response=await get(url);
    if(response.text) {
      if(response.text.trim().startsWith('{')) {
        try {
          const body=JSON.parse(response.text);
          if(body.paths) {
            const name=url.includes('especiais')?'especiais':'parcerias';
            await writeFile(new URL(`./research-${name}-openapi.json`,import.meta.url),JSON.stringify(body));
            response.endpoints=Object.keys(body.paths).filter(p=>/relator|gestao|execu|pagam|docum|emenda|propost|licit|contrat|benef|plano|prest|meta/i.test(p));
          } else {
            const rows=body.dados??body.data??body.items??body.resultado;
            if(url.includes('api-publica.transferegov')) {
              response.topKeys=Object.keys(body);
              response.sample=Array.isArray(rows)?rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>/id_|emenda|solicitante|situacao|publico_alvo|resultado_esperado|problema_proposta|sg_uf|nm_beneficiario|ano_proposta|nm_ente/i.test(key)))):undefined;
            } else response.sample=Array.isArray(rows)?rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!/cpfGestor|matriculaGestor|nomeGestor/i.test(key)))):rows;
            response.pagination=body.paginacao??body.pagination??body.metadata;
          }
        } catch {}
      } else if(response.text.includes('<Name>')) response.files=[...response.text.matchAll(/<Name>([^<]+)/g)].map(m=>m[1]).filter(n=>/pagamento|desembolso|emenda|licit|contrat|obtv|propost|convenio|meta|etapa|documento|ingresso/i.test(n));
      else response.configuration=response.text.split('\n').filter(l=>l.length<1000&&!/data:image/.test(l)&&/spec-url|openapi|swagger|\.csv|href=|url:|url\s*=/i.test(l)).map(l=>l.trim()).slice(-45);
      delete response.text;
    }
    results.push(response); console.log(JSON.stringify(response));
  }
  const states=await db.emenda_estadual.findMany({select:{ano:true,numero_emenda:true,objeto:true,beneficiario_final:true}});
  console.log('Objects with CNPJ:',states.filter(s=>/\d{2}\.\d{3}\.\d{3}[\/-]\d{4}[.-]\d{2}/.test(s.objeto??'')).length);
  console.log('Amendment 0576/2024:',JSON.stringify(states.find(s=>s.ano===2024&&String(Number(s.numero_emenda.split('/')[0]))==='576')));
  const plan=await db.transferegov_plano_acao.findFirst({where:{uf_beneficiario:'PB',ano_emenda:2024},select:{id_plano_acao:true}});
  if(plan) for(const endpoint of ['relatorios-gestao-especiais','relatorios-gestao-novos-especiais']) {
    const response=await get(`https://api-publica.transferegov.gestao.gov.br/especiais/${endpoint}?id_plano_acao=${plan.id_plano_acao}&tamanho_da_pagina=2`);
    if(response.text) { try { const body=JSON.parse(response.text); response.topKeys=Object.keys(body); const rows=body.dados??body.data??body.items; response.sample=Array.isArray(rows)?rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!/conta|agencia|cpf|email|nome_responsavel/i.test(key)))):undefined; } catch{} delete response.text; }
    results.push(response); console.log('Management report:',JSON.stringify(response));
  }
  await writeFile(new URL('./traceability-research-samples.json',import.meta.url),JSON.stringify(results,null,2));
} finally { await db.$disconnect(); }
