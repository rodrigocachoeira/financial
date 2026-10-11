# Spec: rendimento da conta nos relatórios

- **Fase do roadmap:** melhoria entre as fases 7 e 8
- **Status:** implementada em 2026-10-11

## Objetivo

Mostrar, mês a mês, o rendimento líquido da conta do Nubank, que o extrato já informa e o aplicativo descartava.

## Origem do dado

O OFX da conta traz, fora da lista de lançamentos, um resumo:

```
<BALLIST><BAL>
<NAME>RENDIMENTO LIQUIDO</NAME>
<DESC>RENDIMENTO LIQUIDO NO PERIODO</DESC>
<VALUE>12.34</VALUE>
</BAL></BALLIST>
```

- É **um valor por arquivo**, referente ao período do extrato inteiro. Não há lançamentos de rendimento.
- É líquido: já vem com os descontos aplicados pelo banco.
- O OFX do cartão não tem esse bloco.
- Rendimento de caixinhas: não observado; provavelmente fica fora desse valor.

## Comportamento

- O leitor devolve `netYieldCents` (nulo quando o arquivo não informa) e a importação o grava em `imports.net_yield_cents`.
- Reenviar um extrato importado antes desta mudança preenche o valor, sem criar outra importação.
- O rendimento **não** entra na receita nem no saldo: é mostrado à parte.

### Rendimento de um mês

Como o banco informa um valor por arquivo, e não por dia:

- só contam extratos cujo período está inteiro dentro do mês;
- havendo mais de um, vale o que vai mais longe no mês; no empate, o que começa antes e, depois, o importado por último. **Os valores nunca são somados**: um extrato mais completo substitui o anterior;
- um extrato que termina antes do último dia do mês é marcado como parcial, com a data até onde vale;
- um extrato que cobre mais de um mês não pode ser dividido e fica de fora; a tela avisa quando isso acontece.

## Interface

Na tela de relatórios:

- um quarto cartão no resumo, "Rendimento", com o valor do mês, "parcial, até dd/mm" quando for o caso, ou um traço com "sem extrato da conta no mês";
- uma seção "Rendimento da conta", ao final, com os seis meses que terminam no mês de referência, o total dos meses com extrato e a marcação de meses sem extrato ou parciais.

No texto das dicas com IA, o rendimento do mês entra no resumo, com a observação de que não está somado na receita.

## Verificação

- Unidade: leitura do bloco (ausente, zero, outro nome, valor inválido), escolha do extrato do mês, parcial, vários meses, anos bissextos.
- Banco: gravação, cartão sem rendimento, preenchimento ao reenviar, substituição de extrato parcial por completo.
- Navegador: cartão e seção com dados de teste em 375 px.

## Fora desta spec

- Rendimento de caixinhas e de investimentos.
- Rendimento bruto e imposto retido.
- Somar o rendimento à receita ou ao saldo.
