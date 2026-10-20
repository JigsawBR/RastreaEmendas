# Mapa de municípios da Paraíba

A tela `/municipios` apresenta os 223 municípios com quatro categorias:
federais (verde), estaduais (laranja), ambas as origens (roxo) e vínculo não
identificado no filtro (cinza). Permite escolher exercício de 2023 a 2026,
filtrar a origem, selecionar pelo mapa/teclado ou pela lista de municípios e
abrir emendas vinculadas. A geometria do IBGE é empacotada com o front-end;
nenhuma consulta externa a mapas é necessária para visualizar a tela.

## Regra do destaque

- Federal: valor positivo nas alocações CGU, na execução mensal ou nos planos
  especiais. As três fontes permanecem separadas. Pagamento pode comprovar
  apenas o repasse, e valor de plano representa previsão.
- Estadual: empenho líquido positivo **transferido ao município** (modalidade
  de aplicação 40–42, ver `docs/consulta-estadual.md`), ou convênio confirmado
  em que o próprio município é o convenente. A sede de entidades privadas,
  credoras ou convenentes, não municipaliza o recurso: antes desta regra,
  João Pessoa recebia 72 emendas estaduais de 2024 no mapa, das quais só 15 eram
  transferências à prefeitura. Os 359 convênios confirmados são todos termos de
  fomento com OSCs e hoje não geram destaque.
  Somente emendas presentes na listagem estadual são incluídas. Uma emenda pode
  ter vínculos com mais de uma cidade; as contagens municipais não devem ser
  somadas como quantidade de emendas únicas.
- Contratos com endereço do fornecedor, extrações de texto e outros vínculos
  candidatos não são usados para distribuir emendas entre municípios.
- Os nomes são associados ao catálogo oficial IBGE por igualdade, ignorando
  acentos, caixa, espaços e o sufixo ` - PB`. Para beneficiários de planos,
  também é removido o prefixo `MUNICIPIO DE/DO/DA`. Não há correspondência
  aproximada por semelhança ou busca de um nome dentro do objeto da emenda.

O município do convenente não comprova onde o serviço foi entregue. O destaque
estadual é um vínculo territorial e não atribui automaticamente o valor da
emenda ou do instrumento àquela cidade. Sem identificação explícita, o registro
permanece fora do mapa e a tela informa essa limitação. Ausência de destaque
não comprova ausência de recebimento. Cinza também pode resultar do filtro.

O exercício federal considera ano da emenda nas alocações e planos; a execução
mensal usa ano do gasto e é identificada separadamente. O exercício estadual
usa o ano da emenda. O detalhamento tabular federal anterior permanece abaixo
do mapa e tem seus próprios recortes de fonte.

## Fontes geográficas e atualização

Malha simplificada da [API de Malhas v3 do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3),
UF 25, com divisão por município e qualidade mínima. Os códigos e nomes vêm
da [API de Localidades do IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/estados/25/municipios).
As URLs de origem e a data da coleta estão em `frontend/public/maps/paraiba.geojson`.
A malha serve à navegação, sem precisão cartográfica para medição de áreas.

Para atualizar os dois artefatos (geometria e catálogo do servidor):

```text
node frontend/scripts/download-pb-map.mjs
```

Em ambientes nos quais a cadeia HTTPS do IBGE é resolvida apenas pelo Windows,
os JSON originais podem ser baixados em `tmp/ibge/geometry.json` e
`tmp/ibge/names.json`, respectivamente. Depois execute o mesmo script com
`--from-local`. O script valida o total de municípios, códigos únicos e tipos
geométricos antes de gravar. Não desabilita a validação de certificados.

## API e testes

`GET /municipios/mapa?ano=2024` retorna os 223 municípios, com código IBGE,
indicadores federais, vínculos estaduais, cobertura e registros não
municipalizados. Falha de consulta é exibida como erro com nova tentativa;
não é convertida em mapa sem recursos.

Na pasta `backend`, `node scripts/verify-municipality-map.mjs` confere os quatro
exercícios na base real, sem alterar dados. Testes unitários validam agregação,
deduplicação, normalização, exclusão de candidatos/anulações e isolamento por
exercício. Os E2E verificam as quatro cores, seleção por teclado/lista, filtros,
troca de ano, erro e responsividade em desktop/celular, com PostgreSQL isolado.
