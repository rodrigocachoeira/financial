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
- Estorno abate o gasto da categoria da compra original; não é receita. No cartão, todo crédito que não seja pagamento de fatura é estorno (`CARD_REFUND`): estorno de compra, IOF devolvido, desconto.
- O estorno aponta para o estabelecimento da compra, e o IOF e sua devolução para o estabelecimento `IOF`, de modo que se anulem na mesma categoria.

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
- As regras são reaplicadas ao fim de toda importação.

### Recorrência

- Gasto recorrente: mesmo estabelecimento, valor parecido, em pelo menos três meses seguidos. Os limites exatos serão definidos na spec do relatório.

## Privacidade

- Descrições de Pix contêm nome, CPF/CNPJ e dados bancários de terceiros. Esses dados não vão para logs, mensagens de erro nem para o serviço de IA.
