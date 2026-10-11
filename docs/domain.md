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
| Regra | `CategoryRule` | Associa um estabelecimento ou padrão de descrição a uma categoria |
| Parcela | `Installment` | Posição `n/total` de uma compra parcelada no cartão |
| Fatura | `Statement` | Conjunto de lançamentos do cartão em um ciclo de cobrança |

## Regras

### Valores e datas

- Valor guardado em **centavos, inteiro** (`amountCents`), com sinal: negativo é saída, positivo é entrada.
- Data da transação é só data, sem hora nem fuso.
- A descrição original nunca é alterada; campos derivados (estabelecimento, parcela, tipo) ficam em colunas próprias.

### Duplicidade

- O identificador externo (`FITID` no OFX, `Identificador` no CSV) é único por origem.
- Importar uma transação cujo identificador já existe naquela origem a ignora. Reimportar um arquivo inteiro não muda nada.

### Transferências internas

- `Pagamento de fatura` (saída na conta) e `Pagamento recebido` (entrada no cartão) são o mesmo dinheiro mudando de lugar.
- Os dois recebem o tipo `INTERNAL_TRANSFER` e **ficam fora de qualquer total de gastos ou de receitas**. Sem isso, o gasto do cartão é contado duas vezes.
- Pix para contas do próprio usuário em outros bancos segue a mesma lógica, marcado manualmente ou por regra.

### O que conta como gasto

- Gasto: transação de saída que não é transferência interna.
- Receita: transação de entrada que não é transferência interna nem estorno.
- Estorno abate o gasto da categoria da compra original; não é receita.

### Parcelas

- Uma compra parcelada aparece como uma transação por fatura, com o sufixo ` - Parcela n/total`.
- O gasto do mês considera a parcela daquele mês, não o valor total da compra.
- Parcelas futuras são projeção: para a última parcela vista `n/total`, restam `total - n` parcelas do mesmo valor nos meses seguintes. Não são gravadas como transações.

### Estabelecimento

- No cartão: a descrição sem o sufixo de parcela. O prefixo do intermediador (`MP *`, `IFD *`) é mantido pelo leitor; tratá-lo é assunto da categorização (fase 5).
- Na conta: o nome da contraparte no Pix, ou o estabelecimento da compra no débito.
- A normalização (maiúsculas, espaços, prefixos) existe para que a mesma loja caia sempre na mesma regra.

### Categorização

- Na importação, cada transação recebe a categoria da regra que casar com o estabelecimento; sem regra, fica `Uncategorized`.
- Quando o usuário corrige a categoria de uma transação, o sistema cria ou atualiza a regra daquele estabelecimento. Importações seguintes já usam a nova regra.
- Correção manual em uma transação prevalece sobre qualquer regra e não é sobrescrita em reimportações.

### Recorrência

- Gasto recorrente: mesmo estabelecimento, valor parecido, em pelo menos três meses seguidos. Os limites exatos serão definidos na spec do relatório.

## Privacidade

- Descrições de Pix contêm nome, CPF/CNPJ e dados bancários de terceiros. Esses dados não vão para logs, mensagens de erro nem para o serviço de IA.
