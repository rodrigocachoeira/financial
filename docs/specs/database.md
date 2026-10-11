# Spec: banco de dados e gravação de importações

- **Fase do roadmap:** 2
- **Status:** implementada em 2026-10-11; dúvidas em aberto aprovadas como propostas

## Objetivo

Definir o schema do PostgreSQL com Prisma 7, aplicar a migração inicial no Postgres do Docker e gravar o resultado do leitor de OFX (`ParsedStatement`) sem duplicar transações.

## Modelo de dados

```
Account 1 ── N Import 1 ── N Transaction N ── 1 Merchant N ── 1 Category
   └───────────────── N Transaction N ───────────────────────── 1 Category
```

| Tabela | Papel |
|---|---|
| `accounts` | Uma conta ou cartão em uma instituição. Dona das transações. |
| `imports` | Um arquivo enviado: período, saldo, contagens. Histórico e auditoria. |
| `transactions` | Um lançamento. Tabela central, alvo de todos os relatórios. |
| `merchants` | Estabelecimento normalizado. Guarda a categoria padrão (a "regra" de categorização). |
| `categories` | Categoria de gasto. |

### Schema (Prisma)

Organizado em `prisma/schema/`, um arquivo por assunto: `client.prisma`, `enums.prisma`, `account.prisma`, `transaction.prisma`, `catalog.prisma`.

```prisma
enum Institution       { NUBANK }
enum Source            { ACCOUNT  CREDIT_CARD }
enum TransactionKind   { PIX_SENT PIX_RECEIVED DEBIT_PURCHASE BILL_PAYMENT CARD_PURCHASE CARD_PAYMENT_RECEIVED OTHER }
enum CategorySource    { RULE MANUAL }

model Account {
  id          String      @id @default(uuid(7)) @db.Uuid
  institution Institution
  source      Source
  externalId  String      @map("external_id")          // ACCTID do arquivo
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)

  imports      Import[]
  transactions Transaction[]

  @@unique([institution, source, externalId])
  @@map("accounts")
}

model Import {
  id                  String   @id @default(uuid(7)) @db.Uuid
  accountId           String   @map("account_id") @db.Uuid
  fileName            String   @map("file_name")
  fileHash            String   @map("file_hash")        // SHA-256 do arquivo
  periodStart         DateTime @map("period_start") @db.Date
  periodEnd           DateTime @map("period_end") @db.Date
  ledgerBalanceCents  Int?     @map("ledger_balance_cents")
  ledgerBalanceDate   DateTime? @map("ledger_balance_date") @db.Date
  transactionCount    Int      @map("transaction_count")      // no arquivo
  newTransactionCount Int      @map("new_transaction_count")  // de fato gravadas
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  account      Account       @relation(fields: [accountId], references: [id], onDelete: Restrict)
  transactions Transaction[]

  @@unique([accountId, fileHash])
  @@index([accountId, periodStart])
  @@map("imports")
}

model Transaction {
  id                String          @id @default(uuid(7)) @db.Uuid
  accountId         String          @map("account_id") @db.Uuid
  importId          String          @map("import_id") @db.Uuid   // primeira importação que trouxe a transação
  externalId        String          @map("external_id")          // FITID
  date              DateTime        @db.Date
  amountCents       Int             @map("amount_cents")
  description       String
  kind              TransactionKind
  merchantId        String?         @map("merchant_id") @db.Uuid
  installmentNumber Int?            @map("installment_number") @db.SmallInt
  installmentTotal  Int?            @map("installment_total") @db.SmallInt
  categoryId        String?         @map("category_id") @db.Uuid
  categorySource    CategorySource? @map("category_source")
  createdAt         DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt         DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)

  account  Account   @relation(fields: [accountId], references: [id], onDelete: Restrict)
  import   Import    @relation(fields: [importId], references: [id], onDelete: Restrict)
  merchant Merchant? @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@unique([accountId, externalId])
  @@index([date])
  @@index([categoryId, date])
  @@index([merchantId, date])
  @@index([importId])
  @@map("transactions")
}

model Merchant {
  id         String   @id @default(uuid(7)) @db.Uuid
  name       String   @unique                          // normalizado pelo leitor
  categoryId String?  @map("category_id") @db.Uuid     // categoria padrão
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  category     Category?     @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  transactions Transaction[]

  @@index([categoryId])
  @@map("merchants")
}

model Category {
  id        String   @id @default(uuid(7)) @db.Uuid
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  merchants    Merchant[]
  transactions Transaction[]

  @@map("categories")
}
```

### Decisões de modelagem

| Decisão | Motivo |
|---|---|
| Nomes em `snake_case` no banco, `camelCase` no código (`@map`) | Convenção do Postgres; evita aspas em SQL manual |
| Chave primária UUID v7 | Ordenada por tempo (boa para índice B-tree), não revela contagem em URLs |
| Dinheiro em `INTEGER` de centavos | Regra do domínio; comporta até R$ 21 milhões por lançamento |
| Datas de lançamento em `DATE` | O OFX só traz o dia; sem hora não há erro de fuso |
| Carimbos em `TIMESTAMPTZ` | Instante real, independente do fuso do servidor |
| Enums nativos do Postgres | O banco rejeita valores inválidos |
| `Restrict` nas chaves de transação | Impede apagar conta, importação ou estabelecimento que tenha lançamentos |
| `SetNull` na categoria | Apagar uma categoria deixa os lançamentos sem categoria, sem perdê-los |
| `Merchant.categoryId` como regra | A correção do usuário (fase 5) atualiza um único lugar e vale para as próximas importações |
| Restrição `CHECK` das parcelas | `installment_number` e `installment_total` são ambos nulos ou `1 <= number <= total`. O Prisma não declara `CHECK`; entra em SQL na migração |

### Índices

Cada índice corresponde a uma consulta conhecida. Com poucos milhares de linhas por ano o ganho é pequeno; índices sem consulta correspondente não foram criados.

| Índice | Consulta que atende |
|---|---|
| `transactions (account_id, external_id)` único | Impedir duplicidade na importação; também serve filtros por conta |
| `transactions (date)` | Lançamentos e totais de um período |
| `transactions (category_id, date)` | Gasto por categoria no período; evolução mês a mês |
| `transactions (merchant_id, date)` | Maiores estabelecimentos; detecção de recorrência |
| `transactions (import_id)` | Lançamentos de uma importação; o Postgres não indexa chave estrangeira sozinho |
| `imports (account_id, file_hash)` único | Detectar o mesmo arquivo reenviado |
| `imports (account_id, period_start)` | Histórico de importações de uma conta |
| `merchants (name)` único | Localizar o estabelecimento na importação |
| `merchants (category_id)` | Estabelecimentos de uma categoria |

## Gravação

Código de banco em `src/server/`, separado da regra pura de `src/lib/`.

```ts
// src/server/db.ts: instância única do PrismaClient (adaptador pg)

// src/server/imports/import-statement.ts
interface ImportInput {
  statement: ParsedStatement;
  fileName: string;
  fileHash: string;          // SHA-256 em hexadecimal
}
interface ImportResult {
  importId: string;
  alreadyImported: boolean;  // mesmo arquivo já enviado antes
  transactionCount: number;
  newTransactionCount: number;
}
function importStatement(db: PrismaClient, input: ImportInput): Promise<ImportResult>;
```

Regras (seção Duplicidade de `docs/domain.md`):

- Tudo acontece em uma única transação de banco: ou grava tudo, ou nada.
- A conta é localizada por instituição, origem e `accountId`, e criada se não existir.
- Se já existe importação com o mesmo `fileHash` na conta, nada é gravado e o resultado traz `alreadyImported: true`.
- Estabelecimentos novos são criados; os existentes são reaproveitados pelo nome.
- Transações entram com `INSERT ... ON CONFLICT DO NOTHING` na chave `(account_id, external_id)`, em lote.
- Transação que já existia não é alterada: nem categoria, nem estabelecimento, nem `importId`.
- `categoryId` fica nulo nesta fase; a aplicação de regras é da fase 5.

## Ambiente

- Pacotes: `prisma`, `@prisma/client`, `@prisma/adapter-pg` (os três fixados em 7.10.0) e `dotenv`.
- `prisma.config.ts` na raiz; cliente gerado em `src/generated/prisma` (fora do git).
- Scripts: `db:migrate`, `db:deploy`, `db:generate`, `db:studio`, `db:reset`, `test:db`.
- Os scripts `dev`, `build`, `typecheck` e `test:db` rodam `prisma generate` antes. (A spec previa `postinstall`, mas no Docker a instalação acontece antes de o schema ser copiado.)
- Desenvolvimento: `DATABASE_URL` aponta para o Postgres do Docker (`localhost:5432` fora do container, `db:5432` dentro).
- Testes de banco usam um banco separado (`financial_test`) no mesmo container.
- `yarn test` continua sem depender de banco; `yarn test:db` exige o container `db` no ar.

## Critérios de aceite

1. `yarn db:migrate` cria as cinco tabelas, os enums, os índices e o `CHECK` das parcelas em um banco vazio.
2. Importar `fixtures/nubank/account.ofx` cria 1 conta, 1 importação, 5 transações e 4 estabelecimentos.
3. Importar o mesmo arquivo de novo retorna `alreadyImported: true` e não cria nenhuma linha.
4. Importar um arquivo diferente com 3 transações repetidas e 2 novas grava só as 2 novas e registra `transactionCount: 5`, `newTransactionCount: 2`.
5. Uma transação já existente mantém `importId`, categoria e estabelecimento após a reimportação.
6. Conta e cartão com o mesmo `externalId` de transação não colidem (a unicidade é por conta).
7. Valores, datas, `kind`, parcela e descrição gravados são iguais aos do `ParsedStatement`.
8. Dois lançamentos do mesmo estabelecimento apontam para a mesma linha de `merchants`.
9. O banco rejeita parcela inválida (`number > total`, ou só um dos campos preenchido).
10. Uma falha no meio da gravação não deixa conta, importação nem transações parciais.
11. `yarn test`, `yarn typecheck`, `yarn lint` e `yarn build` passam sem banco no ar.

## Fora desta spec

- Tabela de usuários e login (fase 3; a aplicação tem um único usuário).
- Regras de categorização por padrão de descrição e categorias iniciais (fase 5).
- Rota de upload e interface (fase 4).
- Banco no Neon e migração em produção (fase 3).
- Desfazer uma importação.

## Dúvidas em aberto

1. **Categorias e estabelecimentos já nesta fase.** Proposta: criar as tabelas agora, vazias de regra, porque fazem parte do escopo confirmado e evitam alterar `transactions` depois.
2. **Mês de competência do cartão.** Uma compra de 28/01 pode cair na fatura de março. Proposta: guardar a data da compra e o vínculo com a importação (que tem o período da fatura); a fase 6 decide qual usar em cada relatório.
3. **Testes de banco.** Proposta: rodarem contra o Postgres do Docker em um banco separado, em um comando próprio (`yarn test:db`).
4. **Sem tabela de usuários.** Proposta: não adicionar `user_id` nas tabelas enquanto o produto for de usuário único.
