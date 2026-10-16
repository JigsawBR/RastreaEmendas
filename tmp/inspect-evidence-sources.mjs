const r=await fetch('https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov/?restype=container&comp=list');
const xml=await r.text();
for(const chunk of xml.split('<Blob>')) {
  const name=chunk.match(/<Name>([^<]+)/)?.[1];
  if(name&&/^siconv_(emenda|convenio|proposta|pagamento|contrato|acomp_obras_contratos_medicoes_modulo_empresas)\.zip$/.test(name))
    console.log(name, chunk.match(/<Content-Length>([^<]+)/)?.[1]);
}
