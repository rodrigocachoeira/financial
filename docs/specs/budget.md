# Spec: orçamento por categoria

- **Fase do roadmap:** melhoria entre as fases 7 e 8
- **Status:** implementada em 2026-10-11; dúvidas em aberto aprovadas como propostas. Verificada em largura de desktop, que é o foco atual

## Objetivo

Permitir que o usuário defina um limite mensal de gasto por categoria e acompanhe, durante o mês, quanto já usou, quanto resta e se o ritmo está acima do planejado.

## Conceitos

- **Limite:** valor mensal planejado para uma categoria.
- **Gasto:** o mesmo dos relatórios (`spentCents`): saídas menos estornos, parcelas do mês incluídas, sem transferências internas.
- **Ritmo:** quanto do limite foi usado comparado com quanto do mês já passou.
- **Data dos dados:** o dia do lançamento mais recente importado no mês. Os dados entram por importação, então o "hoje" do orçamento é até onde os extratos chegam, não o dia do calendário.

## Dados

```prisma
/// Monthly spending limit of a category, valid from a month onwards.
model Budget {
  id          String   @id @default(uuid(7)) @db.Uuid
  categoryId  String   @map("category_id") @db.Uuid
  /// First month the limit applies to, YYYY-MM.
  startMonth  String   @map("start_month")
  /// Null ends the limit from that month on.
  amountCents Int?     @map("amount_cents")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([categoryId, startMonth])
  @@map("budgets")
}
```

O limite de uma categoria em um mês é o da linha com o maior `startMonth` que não passe daquele mês. Assim, mudar o limite em outubro não muda como setembro é avaliado. A chave única já serve de índice para essa busca; a tabela terá poucas dezenas de linhas.

Restrição em SQL na migração: `amount_cents` nulo ou maior que zero, e `start_month` no formato `AAAA-MM`.

## Entrada e saída

```ts
// src/lib/budget/budget.ts (pura)
interface BudgetEntry { categoryId: string; startMonth: string; amountCents: number | null }

/** Limite em vigor no mês, ou null. */
function budgetFor(entries: BudgetEntry[], categoryId: string, month: string): number | null;

type BudgetStatus = "ON_TRACK" | "ATTENTION" | "OVER";

interface CategoryBudget {
  category: ReportCategory;
  limitCents: number;
  spentCents: number;
  remainingCents: number;        // negativo quando estourou
  usedFraction: number;          // gasto / limite
  status: BudgetStatus;
  dailyRemainingCents: number | null; // só em mês em andamento, com saldo positivo
}

interface BudgetReport {
  month: string;
  /** Null em mês encerrado: não há ritmo a acompanhar. */
  pace: { asOf: string; monthFraction: number; daysLeft: number } | null;
  budgeted: CategoryBudget[];                        // ordenadas por fração usada, maior primeiro
  unbudgeted: { category: ReportCategory; spentCents: number; suggestedCents: number | null }[];
  uncategorizedCents: number;                        // gasto sem categoria, fora de qualquer limite
  totals: { limitCents: number; spentCents: number; remainingCents: number };
  /** Soma dos limites sobre a receita média dos três meses anteriores; null sem receita. */
  plannedShareOfIncome: number | null;
}

function budgetReport(input: { rows; entries; categories; month; currentMonth }): BudgetReport;
function suggestLimit(averageCents: number): number;

// src/server/budget/
function loadBudgets(db: PrismaClient): Promise<BudgetEntry[]>;
function setBudget(db: PrismaClient, categoryId: string, startMonth: string, amountCents: number | null): Promise<void>;
```

## Regras

- **Situação de cada categoria:**
  - `OVER`: gasto maior que o limite.
  - `ATTENTION`: mês em andamento, pelo menos metade do limite usado e fração usada mais de 15 pontos percentuais acima da fração do mês decorrida.
  - `ON_TRACK`: os demais casos.
- **Mês em andamento** é o mês-calendário atual, no fuso de São Paulo. A fração decorrida usa a data dos dados: com extrato até o dia 10 de um mês de 30 dias, um terço do mês passou. Sem lançamento no mês, não há ritmo.
- **Mês encerrado** mostra só o resultado final, sem ritmo nem valor por dia.
- **Valor por dia:** saldo restante dividido pelos dias que faltam depois da data dos dados.
- **Sugestão de limite:** a média dos três meses anteriores com dados (a mesma da comparação com a média), arredondada para cima: múltiplos de R$ 10 até R$ 500, de R$ 50 acima disso. Sem histórico, não há sugestão.
- **Categorias que não contam como gasto** não podem ter limite.
- **Gasto sem categoria** não entra em nenhum limite e aparece como aviso, com link para a lista filtrada.
- **Definir um limite** grava a vigência a partir do mês selecionado na tela; gravar de novo no mesmo mês substitui. **Remover** grava vigência nula a partir daquele mês.
- **Apagar uma categoria** apaga seus limites.
- A sobra de um mês não passa para o seguinte.

## Interface

Nova aba **Orçamento** nos relatórios (`/reports/budget`), entre "Mês" e "Ano", com seletor de mês.

- **Resumo:** planejado, gasto nas categorias com limite e restante. Em mês em andamento, a linha "dados até dd/mm, x% do mês". Quando houver receita de referência: "o planejado equivale a x% da sua receita média".
- **Categorias com limite:** uma linha por categoria com o nome, "R$ 640 de R$ 800", uma barra de progresso e o complemento ("restam R$ 160, cerca de R$ 11 por dia" ou "estourou em R$ 50").
  - A barra é um medidor: o preenchimento muda de cor com a situação (destaque, aviso, vermelho) e sempre vem com um rótulo em texto; em mês em andamento, um marcador mostra onde o gasto estaria no ritmo exato.
- **Categorias sem limite com gasto no mês:** valor gasto e o botão "Definir limite", que já propõe a sugestão.
- **Edição:** tocar em uma linha abre um diálogo com o valor do limite, o atalho "usar a sugestão (R$ X)", a informação "vale a partir de <mês>" e "Remover limite".
- Sem nenhum limite definido: explicação curta e a lista de categorias com gasto para começar.

Tudo cabe em 375 px. Com quatro abas, a faixa de abas rola na horizontal se faltar largura.

## Critérios de aceite

Automatizados (unidade):

1. `budgetFor` devolve o limite da vigência mais recente que não passe do mês; `null` antes da primeira vigência e depois de uma remoção.
2. `budgetReport` em mês encerrado: gasto, restante e fração corretos; `OVER` quando passa do limite; sem ritmo nem valor por dia.
3. Em mês em andamento com dados até o dia 10 de 30: `monthFraction` de um terço; categoria com 80% usado é `ATTENTION`; com 40% é `ON_TRACK`; com 45% usado não é `ATTENTION` mesmo acima do ritmo (abaixo de metade do limite).
4. `dailyRemainingCents` é o restante dividido pelos dias que faltam; `null` quando estourou ou no último dia.
5. Estorno reduz o gasto da categoria; transferências internas e categorias que não contam como gasto ficam fora.
6. `unbudgeted` lista categorias com gasto e sem limite, com sugestão; sem histórico a sugestão é `null`.
7. `suggestLimit` arredonda para cima nos múltiplos definidos.
8. `plannedShareOfIncome` usa a receita média dos meses anteriores com receita.

Automatizados (banco):

9. `setBudget` cria, substitui no mesmo mês e encerra com `null`; recusa categoria inexistente, categoria que não conta como gasto, valor não positivo e mês inválido.
10. Mudar o limite a partir de um mês não altera o limite dos meses anteriores.
11. Apagar a categoria apaga seus limites.

Verificados no navegador:

12. Definir, alterar e remover um limite pela tela atualiza a lista e mostra confirmação.
13. As três situações aparecem com cor e rótulo; o marcador de ritmo aparece só em mês em andamento.
14. A aba cabe em 375 px.

## Fora desta spec

- Limite total do mês, independente de categoria.
- Sobra ou estouro acumulados para o mês seguinte.
- Metas de economia e previsão de saldo.
- Notificações ao se aproximar do limite.
- Incluir o orçamento no texto das dicas com IA (acréscimo simples, em seguida).

## Dúvidas em aberto

1. **Limite com vigência.** Proposta: cada limite vale "a partir de um mês", para o histórico não mudar quando você ajusta o valor. A alternativa mais simples é um único valor por categoria, que reavalia os meses passados pelo limite atual.
2. **Ritmo pela data dos dados.** Proposta: medir o andamento do mês até o último lançamento importado, não até o dia de hoje. Com extrato até o dia 10, o app compara seu gasto com um terço do mês.
3. **Critério de "atenção".** Proposta: pelo menos metade do limite usado e 15 pontos acima do ritmo. Menos que isso geraria alerta nos primeiros dias do mês por causa de uma única compra.
4. **Sem acumular sobra.** Proposta: cada mês começa do zero.
5. **Onde editar.** Proposta: só na aba Orçamento, tocando na categoria.
