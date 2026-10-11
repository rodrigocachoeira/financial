# Spec: upload de extratos e lista de transações

- **Fase do roadmap:** 4
- **Status:** implementada em 2026-10-11; dúvidas em aberto aprovadas como propostas

## Objetivo

Dar à aplicação sua primeira interface útil: enviar arquivos OFX do Nubank pelo navegador, ver o resultado da importação e consultar as transações gravadas. Deve funcionar bem na tela do iPhone.

## Telas

| Caminho | Conteúdo |
|---|---|
| `/` | redireciona para `/transactions` |
| `/transactions` | lista de transações com filtros de mês e conta, e totais do período |
| `/import` | formulário de upload, resultado do último envio e histórico de importações |

Todas exigem sessão. Um cabeçalho comum traz os links "Transações" e "Importar", o e-mail da sessão e "Sair".

### `/import`

- Campo de arquivo que aceita um ou mais `.ofx` (por exemplo, conta e cartão juntos) e botão "Importar".
- Depois do envio, uma linha por arquivo: nome, origem (Conta ou Cartão), período, transações no arquivo, transações novas, ou o motivo da recusa.
- Arquivo já importado aparece como "já importado", sem erro.
- Abaixo, o histórico: data do envio, arquivo, origem, período, total e novas. Mais recentes primeiro.

### `/transactions`

- Filtros na URL: `?month=AAAA-MM&account=ACCOUNT|CREDIT_CARD`. Sem `month`, usa o mês mais recente que tenha transações.
- Seletor de mês com os meses que têm dados; seletor de conta com "Todas", "Conta" e "Cartão".
- Totais do período: entradas, saídas e saldo, **sem contar transferências internas** (regra de `docs/domain.md`).
- Lista ordenada por data decrescente: data, estabelecimento (ou a descrição, quando não houver), origem, parcela (`2/10`) e valor. Saídas e entradas com cores distintas; transferências internas com aparência esmaecida e o rótulo "transferência interna".
- Sem dados: mensagem com link para `/import`.
- Em telas estreitas a lista vira cartões empilhados; não há rolagem horizontal.

## Entrada e saída

```ts
// src/lib/imports/validate-upload.ts (regra pura)
const MAX_FILE_BYTES = 1_000_000;
const MAX_FILES = 12;
type UploadError = "EMPTY" | "TOO_LARGE" | "WRONG_EXTENSION";
function validateUpload(file: { name: string; size: number }): UploadError | null;

// src/lib/format.ts (regra pura)
function formatCents(cents: number): string;      // -4590 -> "-R$ 45,90"
function formatDate(isoDate: string): string;     // "2026-01-05" -> "05/01/2026"
function formatMonth(month: string): string;      // "2026-01" -> "janeiro de 2026"
function parseMonth(value: string | undefined): { start: string; endExclusive: string } | null;

// src/server/imports/import-file.ts
interface ImportFileResult {
  fileName: string;
  status: "IMPORTED" | "ALREADY_IMPORTED" | "REJECTED";
  source?: Source;
  periodStart?: string;
  periodEnd?: string;
  transactionCount?: number;
  newTransactionCount?: number;
  reason?: string;            // só em REJECTED; nunca contém descrição de transação
}
/** Valida, decodifica, interpreta, calcula o SHA-256 e grava. Nunca lança por arquivo inválido. */
function importFile(db: PrismaClient, file: { name: string; bytes: Uint8Array }): Promise<ImportFileResult>;

// src/server/imports/list-imports.ts
function listImports(db: PrismaClient): Promise<ImportRow[]>;

// src/server/transactions/list-transactions.ts
interface TransactionFilters { month: string; source?: Source }
interface TransactionList {
  rows: TransactionRow[];
  totals: { inCents: number; outCents: number; netCents: number };
}
function listTransactions(db: PrismaClient, filters: TransactionFilters): Promise<TransactionList>;
function listMonths(db: PrismaClient): Promise<string[]>;   // "AAAA-MM", mais recente primeiro
```

O envio usa uma server action (`src/app/import/actions.ts`) que chama `getSession()`, limita a `MAX_FILES` arquivos e chama `importFile` para cada um, em sequência.

## Regras

- A server action recusa a chamada sem sessão, antes de ler qualquer arquivo.
- Validação por arquivo: não vazio, até 1 MB, extensão `.ofx` (sem diferenciar maiúsculas). O conteúdo é validado pelo leitor.
- Um arquivo recusado não impede os outros do mesmo envio.
- Erros do leitor (`OfxParseError`) viram `REJECTED` com um motivo em português e o detalhe técnico (tag e posição). Erros inesperados viram um motivo genérico; o detalhe vai para o log do servidor, sem conteúdo do arquivo.
- O arquivo não é guardado; só o resultado interpretado e o hash.
- O filtro de conta usa a origem (`ACCOUNT` ou `CREDIT_CARD`), já que há uma conta de cada.
- `month` inválido na URL é tratado como ausente.
- Depois de uma importação, `/transactions` e o histórico refletem os dados novos sem recarregar manualmente.

## Critérios de aceite

Automatizados (unidade):

1. `validateUpload` aceita `extrato.ofx` e `EXTRATO.OFX`; recusa tamanho zero, acima de 1 MB e `extrato.csv`.
2. `formatCents`, `formatDate` e `formatMonth` produzem os formatos acima, incluindo zero e valores com milhar (`R$ 1.250,37`).
3. `parseMonth("2026-01")` devolve `2026-01-01` e `2026-02-01`; dezembro vira o ano seguinte; `"2026-13"`, `"abc"` e `undefined` devolvem `null`.

Automatizados (banco, `yarn test:db`):

4. `importFile` com `fixtures/nubank/account.ofx` devolve `IMPORTED`, origem `ACCOUNT`, 5 e 5; a segunda chamada devolve `ALREADY_IMPORTED`.
5. `importFile` com conteúdo inválido devolve `REJECTED` com motivo e não grava nada.
6. `listTransactions` de `2026-01` devolve as transações de janeiro das duas fixtures em ordem decrescente de data; o filtro de origem restringe a uma delas.
7. Os totais ignoram `BILL_PAYMENT` e `CARD_PAYMENT_RECEIVED`: com as duas fixtures em janeiro, entradas `500000` e saídas `-77500`.
8. `listMonths` devolve os meses com dados, sem repetição, mais recente primeiro.
9. `listImports` devolve as importações com origem e contagens, mais recentes primeiro.

Verificados no navegador:

10. Enviar as duas fixtures juntas mostra duas linhas de resultado e as transações aparecem em `/transactions`.
11. Reenviar mostra "já importado" e a lista não muda.
12. Enviar um `.txt` e um OFX corrompido mostra a recusa de cada um sem derrubar a página.
13. Os filtros de mês e conta alteram a lista e os totais, e ficam na URL.
14. Em largura de 375 px não há rolagem horizontal em nenhuma das duas telas.
15. Sem sessão, `/transactions` e `/import` redirecionam para `/login`.

## Casos de borda

| Situação | Resultado |
|---|---|
| Nenhum arquivo selecionado | mensagem pedindo um arquivo; nada é enviado |
| Mais de 12 arquivos | envio recusado com mensagem |
| Mesmo arquivo duas vezes no mesmo envio | o segundo aparece como "já importado" |
| Banco sem transações | `/transactions` mostra o estado vazio |
| Mês da URL sem dados | lista vazia e totais zerados, com o seletor ainda utilizável |
| Descrição muito longa | truncada na lista, sem quebrar o layout |

## Fora desta spec

- Categorias na lista e correção manual (fase 5).
- Gráficos e relatórios (fase 6).
- Busca por texto, paginação e edição ou exclusão de transações.
- Pré-visualização antes de gravar e desfazer importação.
- Upload do CSV da conta.

## Dúvidas em aberto

1. **Sem pré-visualização.** Proposta: gravar direto e mostrar o resultado, já que reimportar é inofensivo.
2. **Vários arquivos por envio.** Proposta: aceitar até 12 de uma vez.
3. **Página inicial.** Proposta: `/` leva à lista de transações até existirem os relatórios da fase 6.
4. **Sem paginação.** Proposta: mostrar o mês inteiro, que hoje tem poucas dezenas de linhas.
5. **Dados reais em produção.** Ao usar a tela publicada, seus extratos reais passam a ficar no Neon. É o comportamento esperado do produto; registro aqui para ser uma decisão consciente.
