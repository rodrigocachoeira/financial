# Spec: melhorias rápidas nos relatórios

- **Fase do roadmap:** melhoria entre as fases 7 e 8
- **Status:** implementada em 2026-10-11

## Objetivo

Cinco melhorias pequenas, inspiradas em aplicativos financeiros de mercado, que aproveitam dados e cálculos que já existiam.

## Organização da tela

Os relatórios passaram a ter três visões, em abas sob o mesmo título: **Mês** (`/reports`), **Ano** (`/reports/year`) e **Recorrentes** (`/reports/subscriptions`). São abas e não itens do cabeçalho, que já está no limite de largura no celular.

## 1. Tela de recorrentes

- Lista as cobranças recorrentes (mesma regra do domínio: três meses seguidos, valor dentro de 20% da mediana, parcelas fora), tomando como referência o mês mais recente com dados.
- Para cada uma: preço atual, há quantos meses se repete, custo em um ano ao preço atual, data da última cobrança e a data esperada da próxima (um mês depois).
- **Alerta de preço:** quando a última cobrança difere da anterior em 5% ou mais, a linha mostra "aumentou" ou "diminuiu" com os dois valores.
- Resumo no topo: total por mês e por ano ao preço atual, e quantas tiveram aumento.
- Limitação: um aumento acima de 20% tira a cobrança da lista, porque deixa de parecer a mesma cobrança.

## 2. Saldo da conta

- O extrato da conta informa o saldo ao fim do período (`LEDGERBAL`), já guardado em cada importação.
- O saldo de um mês é o do extrato com a data mais recente naquele mês; no empate, o importado por último.
- Seção "Saldo da conta" na visão do mês: saldo mais recente, variação desde o primeiro mês listado e os seis meses em barras. Um saldo que não é do último dia do mês traz a data ("em 12/02").
- Só a conta entra; o saldo da fatura do cartão não é saldo de conta.

## 3. Comparação com a média

- Na seção "Gasto por categoria" do mês, cada categoria mostra a média dos três meses anteriores.
- Meses sem nenhum gasto não têm extrato importado e ficam fora da média, para não puxá-la para baixo.
- Uma categoria é marcada como fora do padrão quando está R$ 50 ou mais acima da média **e** pelo menos 25% acima dela. O piso em reais evita alarmes por valores pequenos.
- Sem mês anterior com dados, a comparação não aparece.

## 4. Exportar CSV

- Rota `GET /api/export/transactions?period=<AAAA-MM|AAAA>&account=&category=`, que exige sessão.
- Links: "Exportar CSV" no rodapé da lista de transações, com os filtros em uso, e "Exportar CSV do ano" na visão anual.
- Formato para o Excel em português: separador `;`, vírgula decimal, CRLF e marca de ordem de bytes para os acentos.
- Colunas: Data, Descrição, Estabelecimento, Categoria, Origem, Tipo, Parcela, Valor.
- Texto que um aplicativo de planilha executaria como fórmula (começando por `=`, `+`, `-`, `@`) é neutralizado com um apóstrofo.
- O arquivo contém as descrições completas, com nomes e documentos de contrapartes de Pix. É o dado do próprio usuário, baixado por ele; não passa por terceiros.

## 5. Visão anual

- Seletor de ano com os anos que têm dados.
- Resumo: gasto, receita e saldo do ano, média mensal de gasto nos meses com dados e rendimento da conta somado dos meses com extrato.
- Gasto por mês em doze colunas; cada uma abre o relatório do mês. Sem mês selecionado, todas usam a cor de destaque e só a maior leva rótulo.
- Gasto por categoria e maiores estabelecimentos do ano.

## Mudanças de base

- Os cálculos de relatório ganharam versões para qualquer conjunto de linhas (`summarize`, `categoryBreakdown`, `merchantRanking`), usadas pelo mês e pelo ano.
- `recurringSpending` passou a informar última cobrança, cobrança anterior, variação de preço e data esperada da próxima; o custo anual usa o preço atual.
- Peças de interface comuns foram para `src/app/(app)/reports/parts.tsx`.

## Verificação

- Unidade: períodos, comparação com a média, detalhes das recorrentes, saldo por mês, CSV (separadores, aspas, fórmulas).
- Banco: linhas do ano, saldos por extrato, comparação com meses com dados, exportação de mês e de ano.
- Rota de exportação: 401 sem sessão, 400 com período inválido, cabeçalhos e conteúdo.
- Navegador, em 375 px: as três abas, o gráfico anual, a lista de recorrentes com alerta de aumento, a comparação e o saldo.

## Fora desta spec

- Orçamento por categoria, fila de revisão e previsão do mês (próximas propostas).
- Cancelar assinaturas, lembretes de cobrança e detecção de aumentos acima de 20%.
- Saldo consolidado com cartão e patrimônio.
