# Diagramas do RastreaEmendas

Os arquivos `.mmd` sao a fonte (sintaxe Mermaid) e os `.png` sao as imagens
geradas a partir deles. Para regerar apos editar um `.mmd`:

```
cd docs/diagramas
npx -y @mermaid-js/mermaid-cli -i <arquivo>.mmd -o <arquivo>.png -p puppeteer-config.json -b white -s 2
```

`puppeteer-config.json` aponta para o Chrome instalado na maquina, evitando o
download do Chromium pelo Puppeteer.

O diagrama de casos de uso e a excecao: a fonte e `casos_de_uso.svg`, escrito a
mao porque o Mermaid nao suporta a notacao UML de casos de uso. Para regerar o
PNG a partir dele:

```
chrome --headless --disable-gpu --no-sandbox --force-device-scale-factor=2 ^
  --window-size=1500,1000 --default-background-color=ffffff ^
  --screenshot=<caminho absoluto>\casos_de_uso.png file:///<caminho>/casos_de_uso.svg
```

Os caminhos precisam ser absolutos: com caminho relativo o Chrome headless
falha com "Acesso negado" ao gravar o PNG.

## arquitetura_fluxo.png

Fluxo de dados de ponta a ponta, em cinco camadas: fontes publicas, ETL em
Python, PostgreSQL, API REST em Node.js e front-end React. Mostra qual modulo
do ETL alimenta qual tabela e qual tabela sustenta cada endpoint e cada tela.

Nao e um diagrama UML: e um diagrama de fluxo de dados, usado para explicar a
integracao das fontes.

## casos_de_uso.png

Diagrama de casos de uso UML cobrindo os oito requisitos funcionais aprovados
no TCC I. Dois atores primarios (o cidadao que consulta e o operador que roda
o ETL) e quatro sistemas externos como atores secundarios.

Relacionamentos modelados:

- RF-03 «include» RF-04, RF-05 e RF-08: a tela de detalhe da emenda sempre
  apresenta os quatro juntos, entao os incluidos nao sao opcionais.
- RF-07 «extend» RF-02: a exportacao so acontece se o usuario pedir, partindo
  de uma consulta ja filtrada.

## der.png

Diagrama entidade-relacionamento das 10 tabelas do banco.

Pontos de atencao ao ler:

- Somente `emenda -> emenda_alocacao` e `emenda -> documento_despesa` tem
  chave estrangeira declarada. As demais ligacoes (tracejadas) sao logicas:
  existem no dado, mas nao sao impostas pelo banco, porque as fontes sao
  independentes e chegam em cargas separadas.
- `emenda` guarda a identidade da emenda e `emenda_alocacao` guarda o grao
  real da API da CGU (emenda x funcao x localidade), motivo pelo qual o
  `codigoEmenda` nao e unico no retorno de `/emendas`.
- `documento_despesa` tem chave composta (`codigo_documento`,
  `codigo_emenda`) porque o mesmo documento pode aparecer em mais de uma
  emenda.
- `unidade_gestora` e a dimensao que traduz os 6 primeiros digitos do
  `codigo_documento` no nome do orgao executor.

## sequencia_rastreabilidade.png

Diagrama de sequencia UML da consulta ao detalhe de uma emenda. Separa a carga
previa do ETL (assincrona) das requisicoes em tempo real, que o React Query
dispara em paralelo, e detalha o calculo do RF-08 (score = criterios atendidos
sobre cinco).
