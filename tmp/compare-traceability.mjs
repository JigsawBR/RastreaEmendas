import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
require('dotenv').config({ path: new URL('../backend/.env', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const { calculateTraceability } = await import('../backend/dist/modules/federal-amendments/traceability/domain/calculate-traceability.js');
const { buildStateTrail } = await import('../backend/dist/modules/state-amendments/domain/state-trail.js');
const normalize = s => /^\s*\d+(?:\s*\/\s*\d{4})?\s*$/.test(s) ? String(Number(s.split('/')[0])) : null;
const filled = v => typeof v === 'string' && v.trim().length > 0;
const pct = (n, d) => d ? Math.round(n / d * 1000) / 10 : null;
try {
  const [federal, states, executions, documents, imports] = await Promise.all([
    db.emenda.findMany({ where: { ano: { gte: 2023, lte: 2026 } }, include: { emenda_alocacao: true, documento_despesa: true } }),
    db.emenda_estadual.findMany({ where: { ano: { gte: 2023, lte: 2026 } } }),
    db.emenda_estadual_execucao.findMany({ where: { ano: { gte: 2023, lte: 2026 } } }),
    db.state_expense_document.findMany({ where: { year: { gte: 2023, lte: 2026 } } }),
    db.state_expense_import.findMany({ where: { year: { gte: 2023, lte: 2026 } } }),
  ]);
  function summarize(items) {
    const count = key => items.filter(i => i[key]).length;
    const totals = Object.fromEntries(['author','function','organization','commitment','liquidation','payment','candidatePayment','allPhases','beneficiary','source','positiveAggregatePaid','detailedCreditor','object'].map(k => [k, count(k)]));
    return { amendments: items.length, ...totals,
      meanCurrentRF08: items.length ? Math.round(items.reduce((s,i) => s + (i.score ?? 0),0) / items.length * 10)/10 : null,
      currentRF08Complete: items.filter(i => i.score === 100).length,
      documentCount: items.reduce((s,i) => s+i.documentCount,0),
      allPhasesPct: pct(totals.allPhases,items.length),
      paymentPct: pct(totals.payment,items.length),
    };
  }
  const f = federal.map(e => {
    const d = e.documento_despesa, a = e.emenda_alocacao;
    const phase = s => d.some(x => x.estagio === s);
    return { year: e.ano, score: Math.round(calculateTraceability(d,a).score*100),
      author: filled(e.nome_autor), function: a.some(r=>filled(r.funcao)), organization: d.some(r=>filled(r.orgao_executor)),
      commitment: phase('Empenho'), liquidation: phase('Liquidação'), payment: phase('Pagamento'), candidatePayment: false,
      allPhases: phase('Empenho') && phase('Liquidação') && phase('Pagamento'),
      beneficiary: d.some(r=>filled(r.nome_favorecido)), source: false,
      positiveAggregatePaid: a.some(r=>Number(r.valor_pago)>0),
      detailedCreditor: d.some(r=>filled(r.nome_favorecido)), object: d.some(r=>filled(r.observacao)),
      documentCount: d.length,
    };
  });
  const s = states.map(e => {
    const rows = executions.filter(r => r.ano === e.ano && r.numero_emenda === e.numero_emenda);
    const docs = documents.filter(d => d.year === e.ano && d.amendment_number === normalize(e.numero_emenda));
    const trail = buildStateTrail(e, rows, docs, imports.filter(i => i.year === e.ano));
    const confirmed = docs.filter(d => d.link_status === 'confirmed');
    const phase = kind => confirmed.some(d=>d.kind === kind);
    return { year: e.ano, score: trail.rastreabilidade.score,
      author: filled(e.nome_deputado), function: trail.rastreabilidade.criterios.find(c=>c.codigo==='function').presente,
      organization: trail.rastreabilidade.criterios.find(c=>c.codigo==='organization').presente,
      commitment: phase('commitment'), liquidation: phase('liquidation'), payment: phase('payment'),
      candidatePayment: docs.some(d=>d.kind==='payment'&&d.link_status==='candidate'),
      allPhases: phase('commitment')&&phase('liquidation')&&phase('payment'),
      beneficiary: filled(e.beneficiario_final), source: trail.trajeto.find(t=>t.codigo==='source').evidencias.length>0,
      positiveAggregatePaid: rows.some(r=>Number(r.valor_pago)>0),
      detailedCreditor: trail.documentos.some(d=>d.vinculo==='confirmed'&&filled(d.credor)), object: filled(e.objeto),
      documentCount: docs.length,
    };
  });
  const result = { measuredAt: new Date().toISOString(), scope: '2023-2026; documentos estaduais 2026 de janeiro a outubro',
    federal: summarize(f), state: summarize(s),
    years: [2023,2024,2025,2026].map(year=>({year,federal:summarize(f.filter(e=>e.year===year)),state:summarize(s.filter(e=>e.year===year))})),
    stateDocuments: { confirmed: documents.filter(d=>d.link_status==='confirmed').length, candidate:documents.filter(d=>d.link_status==='candidate').length },
    federalEnrichment: { documents: federal.reduce((n,e)=>n+e.documento_despesa.length,0),
      enriched: federal.reduce((n,e)=>n+e.documento_despesa.filter(d=>d.detalhe_atualizado_em!==null).length,0),
      commitmentWithMunicipalRecipient: federal.filter(e=>e.documento_despesa.some(d=>d.destino_recurso==='municipio')).length },
  };
  await writeFile(new URL('./traceability-comparison.json', import.meta.url), JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await db.$disconnect(); }
