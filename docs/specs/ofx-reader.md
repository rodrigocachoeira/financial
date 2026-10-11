# Spec: leitor de OFX do Nubank

- **Fase do roadmap:** 1
- **Status:** implementada em 2026-10-10; dúvidas em aberto aprovadas como propostas

## Objetivo

Transformar o conteúdo de um arquivo OFX exportado pelo Nubank (conta ou cartão) em uma estrutura tipada, com os campos derivados que as fases seguintes usam. Sem banco de dados, sem interface.

## Entrada e saída

Código em `src/lib/ofx/`.

```ts
/** Decodifica os bytes do arquivo conforme o cabeçalho (UTF-8 ou windows-1252). */
function decodeOfx(bytes: Uint8Array): string;

/** Interpreta o texto de um OFX do Nubank. Lança OfxParseError se o arquivo for inválido. */
function parseNubankOfx(content: string): ParsedStatement;

type Source = "ACCOUNT" | "CREDIT_CARD";

type TransactionKind =
  | "PIX_SENT"
  | "PIX_RECEIVED"
  | "DEBIT_PURCHASE"
  | "BILL_PAYMENT"            // conta: "Pagamento de fatura"
  | "CARD_PURCHASE"
  | "CARD_PAYMENT_RECEIVED"   // cartão: "Pagamento recebido"
  | "OTHER";

interface ParsedStatement {
  source: Source;
  accountId: string;            // ACCTID
  periodStart: string;          // "AAAA-MM-DD"
  periodEnd: string;            // "AAAA-MM-DD"
  ledgerBalanceCents: number | null;
  ledgerBalanceDate: string | null;
  transactions: ParsedTransaction[];
}

interface ParsedTransaction {
  externalId: string;           // FITID
  date: string;                 // "AAAA-MM-DD"
  amountCents: number;          // negativo é saída
  description: string;          // MEMO original, sem alteração
  kind: TransactionKind;
  merchant: string | null;
  installment: { number: number; total: number } | null;
}

class OfxParseError extends Error {}
```

## Regras

De `docs/formats/nubank.md`:

- A origem vem do bloco de mensagens: `BANKMSGSRSV1` é `ACCOUNT`, `CREDITCARDMSGSRSV1` é `CREDIT_CARD`.
- Datas `AAAAMMDD000000[-3:BRT]` viram `AAAA-MM-DD`, usando só os oito primeiros dígitos. Hora e fuso são ignorados.
- `TRNAMT` é convertido com `toCents` de `src/lib/money.ts`.
- Tags de valor são aceitas com ou sem fechamento na mesma linha (`<MEMO>x</MEMO>` e `<MEMO>x`).
- Entidades SGML em valores (`&amp;`, `&lt;`, `&gt;`) são decodificadas.

De `docs/domain.md`:

- `description` nunca é alterada (seção Valores e datas).
- `kind` é definido pelo início da descrição e pela origem:

| Origem | Descrição começa com | `kind` |
|---|---|---|
| conta | `Transferência enviada pelo Pix` | `PIX_SENT` |
| conta | `Transferência recebida pelo Pix` | `PIX_RECEIVED` |
| conta | `Compra no débito` | `DEBIT_PURCHASE` |
| conta | `Pagamento de fatura` | `BILL_PAYMENT` |
| conta | qualquer outra | `OTHER` |
| cartão | `Pagamento recebido` | `CARD_PAYMENT_RECEIVED` |
| cartão | qualquer outra | `CARD_PURCHASE` |

- Transferência interna (seção Transferências internas) é `BILL_PAYMENT` ou `CARD_PAYMENT_RECEIVED`. O leitor exporta `isInternalTransfer(kind)`.
- `installment` vem do sufixo ` - Parcela n/total` no cartão (seção Parcelas); sem sufixo é `null`.
- `merchant` (seção Estabelecimento):
  - Pix: o nome da contraparte, segunda parte da descrição separada por ` - `.
  - Compra no débito: o texto após o primeiro ` - `.
  - Compra no cartão: a descrição sem o sufixo de parcela.
  - `BILL_PAYMENT`, `CARD_PAYMENT_RECEIVED` e `OTHER`: `null`.
  - Normalização: sem espaços nas pontas, espaços repetidos viram um, tudo em maiúsculas.

## Critérios de aceite

1. `fixtures/nubank/account.ofx` resulta em `source: "ACCOUNT"`, `accountId: "1234567-8"`, período `2026-01-01` a `2026-01-31`, saldo `347173` em `2026-01-31` e 5 transações.
2. `fixtures/nubank/credit-card.ofx` resulta em `source: "CREDIT_CARD"`, período `2026-01-03` a `2026-02-03`, saldo `-49710` e 5 transações.
3. As transações mantêm a ordem do arquivo.
4. Os valores da conta são, em ordem: `500000`, `-4590`, `-125037`, `-3200`, `-20000`.
5. Os `kind` da conta são, em ordem: `PIX_RECEIVED`, `PIX_SENT`, `BILL_PAYMENT`, `DEBIT_PURCHASE`, `PIX_SENT`.
6. Os `merchant` da conta são, em ordem: `EMPRESA FICTICIA LTDA`, `PADARIA MODELO LTDA`, `null`, `MERCADO EXEMPLO`, `FULANO DE TAL`.
7. No cartão, `MP *LOJAEXEMPLO - Parcela 2/10` resulta em `merchant: "MP *LOJAEXEMPLO"` e `installment: { number: 2, total: 10 }`; `Streaming Exemplo` resulta em `merchant: "STREAMING EXEMPLO"` e `installment: null`.
8. No cartão, `Pagamento recebido` resulta em `kind: "CARD_PAYMENT_RECEIVED"`, valor positivo e `merchant: null`.
9. `description` é idêntica ao `MEMO` do arquivo em todas as transações, incluindo acentos.
10. `isInternalTransfer` é verdadeiro apenas para `BILL_PAYMENT` e `CARD_PAYMENT_RECEIVED`.
11. `decodeOfx` lê corretamente um arquivo UTF-8 com acentos e um arquivo windows-1252 com acentos.
12. O mesmo conteúdo com quebras de linha CRLF produz o mesmo resultado.

## Casos de borda

| Entrada | Resultado |
|---|---|
| Texto vazio ou sem `<OFX>` | `OfxParseError` |
| Sem bloco de conta nem de cartão | `OfxParseError` |
| Transação sem `FITID`, `DTPOSTED` ou `TRNAMT` | `OfxParseError` |
| Data ou valor em formato inválido | `OfxParseError` |
| `FITID` repetido no mesmo arquivo | `OfxParseError` |
| `BANKTRANLIST` sem transações | lista vazia, sem erro |
| Sem `LEDGERBAL` | saldo e data `null` |
| `MEMO` ausente | `description: ""`, `kind` padrão da origem, `merchant: null` |
| Descrição de Pix com menos partes que o esperado | `kind` mantido, `merchant: null` |
| Instituição com ` - ` no nome | não afeta o `merchant` (separação pela esquerda) |
| Sufixo de parcela com `n > total` ou zero | `installment: null`; o sufixo permanece no `merchant` |

O leitor é estrito: um erro em qualquer transação rejeita o arquivo inteiro. As mensagens de erro citam a tag e a posição da transação, nunca o conteúdo da descrição.

## Fora desta spec

- CSV da conta (leitor secundário, fase posterior).
- Gravação no banco e detecção de duplicidade entre importações (fase 2).
- Categorização (fase 5).
- Remoção do prefixo do intermediador (`MP *`, `IFD *`) do `merchant`.
- `BALLIST` (rendimento líquido do período).
- OFX de outros bancos.

## Dúvidas em aberto

1. **Prefixo do intermediador.** `docs/domain.md` diz que o estabelecimento do cartão perde o prefixo `XX *`. Proposta: adiar para a fase 5, porque só a amostra real mostra quais prefixos existem e casos como `LOJA*PRODUTO` tornam a regra ambígua. Se aprovado, `docs/domain.md` será ajustado.
2. **Arquivo com erro parcial.** Proposta: rejeitar o arquivo inteiro. A alternativa é importar as transações válidas e listar as rejeitadas.
3. **Documento da contraparte.** Proposta: o CPF/CNPJ do Pix fica só dentro de `description`, sem campo próprio.
4. **Rendimento líquido.** Proposta: ignorar o `BALLIST` por enquanto.
