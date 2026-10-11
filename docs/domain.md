# Domínio

Glossário e regras de negócio. Termos em inglês são os nomes usados no código.

## Glossário

| Termo | Código | Definição |
|---|---|---|
| Origem | `Source` | De onde vem a transação: conta (`ACCOUNT`) ou cartão de crédito (`CREDIT_CARD`) |
| Importação | `Import` | Um arquivo enviado: origem, período, nome do arquivo, data do envio |
| Transação | `Transaction` | Um lançamento: data, valor, descrição original, identificador externo |
| Estabelecimento | `Merchant` | Quem recebeu ou enviou o dinheiro, já normalizado |
| Categoria | `Category` | Classificação do gasto (Alimentação, Transporte, ...) |
| Regra | `CategoryRule` | Trecho de texto que sugere uma categoria para estabelecimentos ainda sem categoria |
| Limite | `Budget` | Valor mensal planejado para uma categoria, válido a partir de um mês |
| Parcela | `Installment` | Posição `n/total` de uma compra parcelada no cartão |
| Fatura | `Statement` | Conjunto de lançamentos do cartão em um ciclo de cobrança |

## Regras

### Valores e datas

- Valor guardado em **centavos, inteiro** (`amountCents`), com sinal: negativo é saída, positivo é entrada.
- Data da transação é só data, sem hora nem fuso.
- A descrição original nunca é alterada; campos derivados (estabelecimento, parcela, tipo) ficam em colunas próprias.

### Duplicidade

- A identidade externa de uma transação (`externalId`) é única por conta. Na conta é o `FITID`; no cartão é o `FITID` mais um sufixo, porque o Nubank repete o `FITID` entre parcelas, IOF e estorno da mesma compra (ver `docs/formats/nubank.md`).
- Importar uma transação cuja identidade já existe naquela conta a ignora. Reimportar um arquivo não duplica nada; se uma versão anterior do leitor deixou linhas de fora, a reimportação as acrescenta.

### Transferências internas

- `Pagamento de fatura` (saída na conta) e `Pagamento recebido` (entrada no cartão) são o mesmo dinheiro mudando de lugar.
- Os dois recebem o tipo `INTERNAL_TRANSFER` e **ficam fora de qualquer total de gastos ou de receitas**. Sem isso, o gasto do cartão é contado duas vezes.
- Pix para contas do próprio usuário em outros bancos segue a mesma lógica, marcado manualmente ou por regra.

### O que conta como gasto

- Gasto: transação de saída que não é transferência interna.
- Receita: transação de entrada que não é transferência interna nem estorno.
- Dinheiro que só muda de lugar não é gasto nem receita: transações em categoria com `countsAsSpending = false` ("Transferências próprias": Pix entre contas do próprio usuário, aplicações) ficam fora dos totais e dos relatórios.
- Mês de um gasto é o mês-calendário da data da transação. No cartão, a compra conta no mês em que foi feita e cada parcela no mês em que é cobrada.
- Estorno abate o gasto da categoria da compra original; não é receita. No cartão, todo crédito que não seja pagamento de fatura é estorno (`CARD_REFUND`): estorno de compra, IOF devolvido, desconto.
- O estorno aponta para o estabelecimento da compra, e o IOF e sua devolução para o estabelecimento `IOF`, de modo que se anulem na mesma categoria.

### Rendimento da conta

- O extrato da conta informa um rendimento líquido por arquivo, para o período inteiro. Não é receita nem entra no saldo; é mostrado à parte.
- O rendimento de um mês vem do extrato mais completo daquele mês. Valores de extratos diferentes nunca são somados, e um extrato que cobre mais de um mês não é dividido.

### Saldo da conta

- O saldo de um mês é o saldo final do extrato da conta com a data mais recente naquele mês. Não é calculado a partir das transações.

### Comparação com a média

- Uma categoria é comparada com a média dos três meses anteriores que tenham algum gasto. Está fora do padrão quando supera a média em R$ 50 ou mais e em pelo menos 25%.

### Orçamento

- Um limite é um valor mensal de gasto para uma categoria, com vigência a partir de um mês. O limite de um mês é o da vigência mais recente que não passe dele; mudar o limite não reavalia os meses anteriores.
- O gasto medido contra o limite é o mesmo dos relatórios: parcelas do mês contam e estornos abatem.
- O andamento do mês é medido até o lançamento mais recente importado, não até o dia de hoje. Só o mês-calendário atual, no fuso de São Paulo, tem ritmo.
- Situações: estourou (gasto acima do limite); atenção (pelo menos metade do limite usada e mais de 15 pontos percentuais acima do andamento do mês); no ritmo (o resto).
- A sobra de um mês não passa para o seguinte. Categorias que não contam como gasto não têm limite.

### Parcelas

- Uma compra parcelada aparece como uma transação por fatura, com o sufixo ` - Parcela n/total`.
- O gasto do mês considera a parcela daquele mês, não o valor total da compra.
- Parcelas futuras são projeção: para a última parcela vista `n/total`, restam `total - n` parcelas do mesmo valor nos meses seguintes. Não são gravadas como transações.

### Estabelecimento

- No cartão: a descrição sem o sufixo de parcela. O prefixo do intermediador (`MP *`, `IFD *`) é mantido pelo leitor; tratá-lo é assunto da categorização (fase 5).
- Na conta: o nome da contraparte no Pix, ou o estabelecimento da compra no débito.
- A normalização (maiúsculas, espaços, prefixos) existe para que a mesma loja caia sempre na mesma regra.

### Categorização

- Prioridade: correção manual na transação, depois a categoria do estabelecimento, depois as regras padrão. Sem nenhuma, a transação fica sem categoria.
- Regra padrão (`CategoryRule`): um trecho de texto associado a uma categoria. Casa quando alguma palavra do nome do estabelecimento começa pelo trecho (`POSTO` casa com `MP *POSTO CENTRAL`, não com `COMPOSTO`). Com mais de um casamento, vence o trecho mais longo.
- Regras padrão só valem enquanto o estabelecimento não tem categoria própria.
- Quando o usuário corrige a categoria de uma transação, o estabelecimento passa a ter aquela categoria, que é aplicada às outras transações dele não corrigidas à mão e às próximas importações.
- Correção manual em uma transação prevalece sobre qualquer regra e nunca é sobrescrita.
- Transferências internas não têm categoria.
- O usuário cria, renomeia e apaga categorias. Dois nomes são a mesma categoria quando coincidem ignorando acentos, maiúsculas e espaçamento.
- Apagar uma categoria devolve suas transações e estabelecimentos a "sem categoria", inclusive as corrigidas à mão.
- As regras são reaplicadas ao fim de toda importação.

### Recorrência

- Gasto recorrente: mesmo estabelecimento com gasto em três ou mais meses-calendário seguidos, o último sendo o mês de referência ou o anterior, e cada mês dentro de 20% da mediana. Parcelas não são recorrência.
- O custo anual de uma recorrência é projetado pelo preço da última cobrança. Diferença de 5% ou mais entre as duas últimas cobranças é tratada como mudança de preço.

## Privacidade

- Descrições de Pix contêm nome, CPF/CNPJ e dados bancários de terceiros. Esses dados não vão para logs, mensagens de erro nem para o texto das dicas com IA.
- O texto das dicas com IA só contém agregados. Estabelecimentos são citados pelo nome apenas quando vêm de compra no cartão ou no débito; contrapartes de Pix nunca.
