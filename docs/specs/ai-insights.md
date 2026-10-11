# Spec: dicas com IA

- **Fase do roadmap:** 7
- **Status:** implementada em 2026-10-11, na forma "copiar para o Claude"

## Objetivo

Dar ao usuário dicas de uma IA sobre os gastos de um mês, sem custo adicional e sem que o aplicativo envie dados a terceiros.

## Decisão

O aplicativo **prepara** um texto com instruções e os dados agregados do mês; o usuário o copia e cola em uma conversa no Claude, com a própria conta.

| Opção | Avaliação |
|---|---|
| Copiar para o Claude | **Adotada.** Custo zero (usa a assinatura que o autor já tem), o usuário vê e envia o conteúdo com as próprias mãos, e a conversa permite perguntas de acompanhamento |
| Chamar a API da Anthropic pelo servidor | Adiada. É paga por uso, à parte da assinatura do claude.ai, e contraria o princípio de custo zero. A montagem dos dados já está pronta para ela |

A assinatura Pro do claude.ai não dá acesso à API: são produtos e cobranças separados.

## O que entra no texto

Montado por função pura (`buildInsightsPayload`) a partir das mesmas linhas dos relatórios, e convertido em texto por `buildInsightsPrompt`.

| Seção | Conteúdo |
|---|---|
| Resumo | gasto, receita e saldo do mês; variação do gasto contra o mês anterior; parcela do gasto sem categoria |
| Gasto por categoria | nome, valor, participação e valor do mês anterior |
| Gasto total por mês | até seis meses, a partir do primeiro mês com gasto |
| Maiores estabelecimentos | até dez: nome, categoria, número de compras e gasto. **Somente compras no cartão e no débito** |
| Cobranças recorrentes | nome, categoria, meses seguidos e valor mensal médio. Somente cartão e débito |
| Parcelas futuras | total comprometido, valor por mês e, por compra em aberto, parcelas restantes e valor mensal |

## O que nunca entra

- Descrições de transações, datas de transações individuais e identificadores (`FITID`, conta, cartão, ids internos).
- Nomes, CPF/CNPJ e dados bancários de contrapartes de Pix. O valor do Pix entra somado na categoria.
- Transações em categorias que não contam como gasto.
- O e-mail do usuário e qualquer dado de sessão.

Um teste monta linhas com esses dados e procura cada um deles no resultado.

## Instruções ao modelo

O texto pede de três a seis dicas práticas e fixa as regras: usar apenas os números fornecidos; toda economia estimada é uma conta sobre eles, mostrada; tom direto e sem julgamento, em português do Brasil; não recomendar produtos de investimento, de crédito ou instituições; e dizer quando os dados não bastam em vez de supor.

Dois cuidados para não induzir o modelo a erro:

- meses anteriores ao primeiro com gasto não aparecem, porque zero ali significaria "não gastou nada" quando na verdade não há extrato importado;
- o valor do mês anterior por categoria só aparece quando existe mês anterior com gasto.

## Interface

Na tela de relatórios, abaixo do resumo do mês, o cartão "Dicas com IA":

- **Copiar para o Claude:** copia o texto para a área de transferência e confirma.
- **Abrir o Claude:** abre `https://claude.ai/new` em outra aba. O texto **não** vai na URL: dados financeiros não entram em endereços.
- **Ver o que será copiado:** mostra o texto completo em um diálogo, com outro botão de copiar.
- Se o navegador negar o acesso à área de transferência, o diálogo abre com o texto para copiar à mão.
- Mês sem gasto: o cartão informa que não há o que analisar.
- Aviso fixo: o aplicativo não envia nada, e as respostas são sugestões de uma IA, não recomendação financeira profissional.

## Verificação

- Unidade: os números batem com os dos relatórios; nomes de Pix, identificadores, datas e ids não aparecem; recorrência de Pix para a mesma pessoa não vira "estabelecimento recorrente"; o texto é determinístico.
- Navegador: o cartão aparece, o diálogo mostra o texto com os valores das fixtures, o caminho de falha da cópia funciona e a seção cabe em 375 px.
- Não verificado: a cópia bem-sucedida (o painel de teste nega a área de transferência) e a qualidade das dicas, que depende de o autor colar o texto no Claude.

## Fora desta spec

- Chamada automática à API, com as dicas exibidas e guardadas no aplicativo.
- Conversa com a IA dentro do aplicativo.
- Sugestões de investimento e categorização de transações por IA.

## Se a API for adotada depois

`buildInsightsPayload` já devolve o objeto estruturado que seria enviado. Faltariam: o SDK da Anthropic no servidor, a chave em variável de ambiente, saída estruturada validada por schema, uma tabela para guardar cada geração com o que foi enviado, e um limite de uso para conter custo.
