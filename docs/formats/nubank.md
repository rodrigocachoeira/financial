# Formatos de exportação do Nubank

Levantado em 2026-10-10 a partir de exportações reais (conta de setembro/2026 e uma fatura do cartão), analisadas com os valores mascarados. Exemplos sintéticos ficam em `fixtures/nubank/`.

## Arquivos

| Origem | Nome do arquivo | Formatos |
|---|---|---|
| Conta | `NU_<conta>_<DDMMMAAAA>_<DDMMMAAAA>.<ext>` (mês em português: `01SET2026`) | CSV, OFX, PDF |
| Cartão | `Nubank_<AAAA-MM-DD>.ofx` (data de vencimento da fatura, a confirmar) | OFX (CSV não analisado) |

**Decisão:** o importador lê **OFX** para conta e cartão. É um único leitor para as duas origens e traz período, saldo e identificador da conta, que o CSV não tem. O CSV da conta fica como leitor secundário.

## OFX (conta e cartão)

OFX 1.02 em SGML: cabeçalho `CHAVE:VALOR`, depois tags. Uma tag por linha, quebra de linha LF. Tags de valor têm fechamento na mesma linha (`<MEMO>texto</MEMO>`).

| Item | Conta | Cartão |
|---|---|---|
| Cabeçalho `ENCODING` / `CHARSET` | `UTF-8` / `NONE` | `USASCII` / `1252` |
| Acentos no `MEMO` | sim | não observados |
| Bloco de mensagens | `BANKMSGSRSV1 > STMTTRNRS > STMTRS` | `CREDITCARDMSGSRSV1 > CCSTMTTRNRS > CCSTMTRS` |
| Identificação | `BANKACCTFROM` (`BANKID`, `BRANCHID`, `ACCTID`, `ACCTTYPE=CHECKING`) | `CCACCTFROM` (`ACCTID` em formato UUID) |
| Extras | `LEDGERBAL` e `BALLIST` com `RENDIMENTO LIQUIDO` | `LEDGERBAL` |

Campos comuns:

- `CURDEF`: `BRL`.
- `BANKTRANLIST`: `DTSTART`, `DTEND` e uma lista de `STMTTRN`.
- Datas: `AAAAMMDD000000[-3:BRT]`. A hora é sempre zero; usar só a data. `DTSERVER` vem em `[0:GMT]`.

Cada `STMTTRN`:

| Tag | Conteúdo |
|---|---|
| `TRNTYPE` | `CREDIT` ou `DEBIT` |
| `DTPOSTED` | data da transação |
| `TRNAMT` | decimal com ponto e duas casas; negativo é saída (`-123.45`) |
| `FITID` | UUID, único por transação |
| `MEMO` | descrição livre |

## CSV da conta

UTF-8 sem BOM, LF, separador vírgula, sem aspas nas amostras (usar um leitor de CSV de verdade mesmo assim).

```
Data,Valor,Identificador,Descrição
```

| Coluna | Formato |
|---|---|
| `Data` | `DD/MM/AAAA` |
| `Valor` | decimal com ponto; negativo é saída |
| `Identificador` | UUID, **igual ao `FITID` do OFX** da mesma transação |
| `Descrição` | igual ao `MEMO` do OFX |

## Padrões de descrição

Conta, com partes separadas por ` - `:

| Início da descrição | Estrutura |
|---|---|
| `Transferência enviada pelo Pix` | ` - <nome> - <CPF/CNPJ> - <instituição> (<código>) Agência: <n> Conta: <n>` |
| `Transferência recebida pelo Pix` | mesma estrutura |
| `Pagamento de fatura` | sem complemento |
| `Compra no débito via <meio>` | ` - <estabelecimento>` |
| `Débito em <...>` | a detalhar com mais amostras |

O nome da instituição pode conter ` - `, então separar pela esquerda (tipo, nome, documento) e tratar o resto como instituição.

Cartão:

| Padrão | Significado |
|---|---|
| `<estabelecimento>` | compra à vista |
| `<estabelecimento> - Parcela <n>/<total>` | parcela de compra parcelada |
| `Pagamento recebido` | pagamento da fatura anterior (`CREDIT`, valor positivo) |

Estabelecimentos costumam vir com prefixo do intermediador (`XX *NOME`).

## Ainda não observado

Estorno, IOF e compra internacional, juros e multa, resgate e aplicação em caixinha/RDB, boleto, TED, CSV da fatura. Ao encontrar um caso novo, acrescentar aqui e criar a fixture correspondente.
