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
| `FITID` | UUID. Na conta é único por lançamento. No cartão identifica a **compra**, não a linha (ver abaixo) |
| `MEMO` | descrição livre |

### O `FITID` do cartão se repete

Verificado em 2026-10-11 com duas faturas reais. Carregam o mesmo `FITID` da compra original:

- cada parcela da compra, em todas as faturas (`Parcela 10/12` e `Parcela 12/12` têm o mesmo `FITID`);
- a cobrança de IOF da compra (`IOF de "<estabelecimento>"`);
- o estorno da compra (`Estorno de "<estabelecimento>" (<razão social>)`).

Por isso o leitor monta a identidade da linha (`externalId`) com um sufixo:

| Linha | `externalId` |
|---|---|
| compra à vista | `<FITID>` |
| parcela | `<FITID>#p<n>/<total>` |
| IOF da compra | `<FITID>#iof` |
| estorno | `<FITID>#refund` |
| qualquer outra repetição no mesmo arquivo | `<FITID>#<data>:<centavos>`, depois `#2`, `#3` |

O sufixo depende só da própria linha, para que a mesma linha tenha a mesma identidade em qualquer arquivo. A última regra é um recurso para padrões ainda desconhecidos e depende do arquivo; ao encontrar um, acrescente uma regra própria.

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
| `Pagamento recebido` | pagamento da fatura (`CREDIT`, valor positivo); pode haver mais de um por fatura |
| `IOF de "<estabelecimento>"` | IOF de compra internacional (`DEBIT`) |
| `IOF de volta de <estabelecimento>` | devolução do IOF (`CREDIT`), com `FITID` próprio |
| `Estorno de "<estabelecimento>" (<razão social>)` | estorno total ou parcial de uma compra (`CREDIT`) |
| `<estabelecimento> - NuPay` | compra pelo NuPay |

Estabelecimentos costumam vir com prefixo do intermediador, com ou sem espaço (`Mp *Nome`, `Ifd*Nome`, `Dl*Nome`), e em maiúsculas e minúsculas misturadas.

## Ainda não observado

Juros e multa, antecipação de parcelas, resgate e aplicação em caixinha/RDB, boleto, TED, CSV da fatura. Ao encontrar um caso novo, acrescentar aqui e criar a fixture correspondente.
