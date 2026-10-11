# Spec: relatórios

- **Fase do roadmap:** 6
- **Status:** implementada em 2026-10-11; dúvidas em aberto aprovadas como propostas

## Objetivo

Responder à pergunta do produto, "onde está indo a maior parte do meu dinheiro?", com uma tela de relatórios: gasto por categoria, evolução mês a mês, maiores estabelecimentos, gastos recorrentes e parcelas futuras.

## Definições

Valem para todos os relatórios e seguem `docs/domain.md`:

- **Gasto** de um conjunto de transações: soma das saídas menos os estornos do cartão (`CARD_REFUND`). Transferências internas ficam fora.
- **Receita:** soma das entradas que não são estorno nem transferência interna.
- **Mês:** mês-calendário da data da transação. No cartão, a data é a da compra, e cada parcela vem datada no mês da fatura em que é cobrada.
- **Sem categoria** é tratada como uma categoria a mais, sempre listada por último.
- Transações em categoria marcada como "não conta como gasto" (`counts_as_spending = false`, hoje só "Transferências próprias") ficam fora de gasto e de receita, como as transferências internas.
- As mesmas regras valem para os totais da lista de transações (`src/lib/reports/amounts.ts` é a única fonte).

## Tela `/reports`

Nova entrada "Relatórios" no cabeçalho, antes de "Transações". A página inicial (`/`) passa a levar para ela.

Um seletor de mês (o mesmo componente da lista) define o mês de referência; o padrão é o mês mais recente com dados. As seções, nesta ordem:

1. **Resumo do mês.** Três cartões: gasto, receita e saldo. O de gasto mostra a variação em relação ao mês anterior ("12% a mais que agosto").
2. **Gasto por categoria.** Barras horizontais ordenadas do maior para o menor, com a cor da categoria, o valor e a participação no total. Cada linha leva à lista de transações filtrada por aquele mês e categoria.
3. **Evolução.** Os seis meses que terminam no mês de referência: uma coluna por mês com o gasto total, o mês de referência em destaque. Tocar em um mês o torna o mês de referência. (A spec original previa colunas divididas por categoria. Com até quinze categorias isso exigiria mais cores do que se distingue com segurança; o detalhamento por categoria de qualquer mês fica a um toque, na seção anterior.)
4. **Maiores estabelecimentos.** Os dez com maior gasto no mês: nome, categoria, número de transações e valor.
5. **Recorrentes.** Estabelecimentos cobrados em pelo menos três meses seguidos, com valor mensal médio e custo anual estimado.
6. **Parcelas futuras.** Total comprometido por mês nos próximos doze meses e a lista das compras parceladas em aberto (estabelecimento, parcela atual, parcelas restantes, valor mensal, término).

Seções sem dados mostram uma frase explicando o que falta (por exemplo, "São necessários três meses de histórico para identificar recorrências").

Os gráficos são desenhados com HTML e SVG próprios, sem biblioteca, com alternativa em texto para leitores de tela. Tudo deve caber em 375 px sem rolagem horizontal.

## Entrada e saída

Os cálculos são funções puras sobre linhas simples, em `src/lib/reports/`, para serem testados com dados conhecidos.

```ts
interface ReportRow {
  date: string;                       // AAAA-MM-DD
  amountCents: number;
  kind: TransactionKind;
  merchant: string | null;
  category: { id: string; name: string; color: string } | null;
  purchaseId: string;                 // FITID da compra (externalId sem o sufixo)
  installment: { number: number; total: number } | null;
}

function monthSummary(rows: ReportRow[], month: string): { spentCents: number; incomeCents: number; netCents: number };
function spendingByCategory(rows: ReportRow[], month: string): CategorySpending[];      // maior primeiro; sem categoria por último
function monthlyEvolution(rows: ReportRow[], endMonth: string, months: number): MonthSpending[];
function topMerchants(rows: ReportRow[], month: string, limit: number): MerchantSpending[];
function recurringSpending(rows: ReportRow[], endMonth: string): RecurringSpending[];
function futureInstallments(rows: ReportRow[], afterMonth: string, months: number): FutureInstallments;
```

`src/server/reports/load-report-rows.ts` busca, em uma consulta, as transações não internas dos treze meses que terminam no mês de referência, mais as parcelas mais recentes de cada compra em aberto.

## Regras

- **Variação mensal:** `(gasto do mês − gasto do anterior) / gasto do anterior`. Sem mês anterior com dados, não é exibida.
- **Categoria com gasto líquido zero ou negativo** (estorno maior que a compra no mês) não aparece nas barras; o valor entra no total.
- **Recorrente:** mesmo estabelecimento com gasto em três ou mais meses-calendário seguidos, o último deles sendo o mês de referência ou o anterior, e cada mês dentro de 20% da mediana. Parcelas não contam como recorrência. Custo anual estimado = média mensal × 12.
- **Parcelas futuras:** para cada compra (`purchaseId`), toma-se a parcela de maior número já importada. As restantes (`total − número`) são projetadas uma por mês a partir do mês seguinte ao dela, com o mesmo valor. Só entram meses posteriores ao mês de referência.
- Estabelecimento nulo entra nos totais e nas categorias, mas não nos rankings de estabelecimentos nem em recorrentes.
- A página exige sessão e lê os dados dentro de `<Suspense>`, com esqueleto de carregamento.

## Critérios de aceite

Automatizados (unidade, com linhas montadas à mão):

1. `monthSummary` soma saídas, desconta estornos, ignora transferências internas e separa receitas.
2. `spendingByCategory` ordena do maior para o menor, calcula a participação, põe "sem categoria" por último e omite categorias com líquido não positivo.
3. `monthlyEvolution` devolve exatamente `months` meses, incluindo os sem dados com zero.
4. `topMerchants` respeita o limite, desconta estornos do próprio estabelecimento e ignora estabelecimento nulo.
5. `recurringSpending` encontra um estabelecimento com três meses seguidos e valor estável; não encontra com dois meses, com um mês faltando no meio, com valor fora da tolerância, nem parcelas.
6. `futureInstallments` projeta `total − número` meses a partir da parcela mais recente, ignora compras quitadas e o que já passou do mês de referência.

Automatizados (banco, com as três fixtures):

7. Janeiro: gasto `77500`, receita `500000`; categorias Alimentação `10320`, Assinaturas `3990` e sem categoria `63190`.
8. Fevereiro: gasto `86417`; "Serviços e taxas" não aparece (IOF e devolução se anulam); `MP *VIAGEMEXEMPLO` aparece com `3427`.
9. Parcelas futuras a partir de fevereiro: `MP *LOJAEXEMPLO` com 7 restantes de `8990`, de março a setembro; `ELETRONICOSEXEMPLO*1PRODUTO` não aparece.

Verificados no navegador:

10. A tela carrega com as fixtures, os valores batem com os itens 7 a 9, e a troca de mês atualiza todas as seções.
11. Clicar em uma categoria abre a lista de transações já filtrada.
12. Sem rolagem horizontal em 375 px, em tema claro e escuro.
13. Sem sessão, `/reports` redireciona para `/login`.

## Casos de borda

| Situação | Resultado |
|---|---|
| Banco sem transações | estado vazio com link para importar |
| Mês de referência sem gasto | seções mostram zero, sem divisão por zero |
| Só um mês de dados | sem variação mensal; evolução mostra os outros meses vazios |
| Estabelecimento com um mês sem cobrança no meio | a sequência é interrompida; conta só o trecho mais recente |
| Compra com parcelas faltando no histórico (fatura não importada) | projeta a partir da mais recente que existir |

## Fora desta spec

- Orçamentos, metas e alertas.
- Comparação entre períodos arbitrários e exportação de relatórios.
- Dicas geradas por IA (fase 7), que usarão estes mesmos cálculos como entrada.
- Edição de transações a partir dos relatórios.

## Dúvidas em aberto

1. **Dinheiro que só muda de lugar.** Pix para uma conta sua em outro banco, aplicação em investimento ou caixinha hoje contariam como gasto. Proposta: criar a categoria "Transferências próprias", marcada no banco como "não conta como gasto"; o que você classificar nela sai dos relatórios de gasto. Isso acrescenta uma coluna em `categories`.
2. **Mês da compra, não da fatura.** Proposta: uma compra de 28/08 conta em agosto, mesmo sendo paga na fatura de setembro. É coerente com a lista de transações; a alternativa é agrupar pelo vencimento da fatura.
3. **Recorrência exige três meses.** Você tem cerca de dois meses importados, então essa seção começa vazia até entrar mais histórico. Proposta: manter três meses para evitar falsos positivos.
4. **Página inicial.** Proposta: `/` passa a abrir os relatórios.
5. **Cálculo em memória.** Proposta: carregar as transações de treze meses (alguns milhares de linhas) e calcular em funções puras, mais simples de testar do que consultas agregadas. Se o volume crescer muito, migra-se para agregação no banco usando os índices que já existem.
