# Spec: categorização por regras e correção manual

- **Fase do roadmap:** 5
- **Status:** implementada em 2026-10-11; dúvidas em aberto aprovadas como propostas

## Objetivo

Toda transação de gasto ou receita ganha uma categoria. O sistema categoriza sozinho na importação; quando erra, o usuário corrige na lista e a correção passa a valer para aquele estabelecimento, nas transações existentes e nas próximas importações.

## Como a categoria é decidida

Em ordem de prioridade:

1. **Correção manual** na própria transação (`categorySource = MANUAL`). Nunca é sobrescrita.
2. **Categoria do estabelecimento** (`merchants.category_id`). É o que o sistema "aprendeu".
3. **Regras padrão** (`category_rules`): trechos de texto associados a uma categoria, como `IFOOD` para Alimentação. Valem quando o estabelecimento ainda não tem categoria.
4. Nenhuma: a transação fica **sem categoria** e aparece destacada para o usuário resolver.

Transferências internas (pagamento de fatura) não recebem categoria nem controle de edição.

## Dados

### Mudanças no schema

```prisma
model Category {
  // já existe: id, name, createdAt
  color String            // hexadecimal, usado nos selos e, na fase 6, nos gráficos
  rules CategoryRule[]
}

/// Trecho de texto que, contido no nome do estabelecimento, sugere uma categoria.
model CategoryRule {
  id         String   @id @default(uuid(7)) @db.Uuid
  pattern    String   @unique              // maiúsculas, sem espaços nas pontas
  categoryId String   @map("category_id") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([categoryId])
  @@map("category_rules")
}
```

Nenhum índice novo em `transactions`: `(category_id, date)` já existe.

### Dados iniciais (na migração)

Categorias: Alimentação, Mercado, Transporte, Moradia, Saúde, Lazer, Assinaturas, Compras, Educação, Pets, Serviços e taxas, Pessoas, Renda, Outros.

72 regras padrão para estabelecimentos comuns no Brasil. Exemplos:

| Trecho | Categoria |
|---|---|
| `IFOOD`, `IFD`, `RAPPI`, `RESTAURANTE`, `PADARIA`, `PIZZ`, `BURGER` | Alimentação |
| `SUPERMERC`, `ATACAD`, `CARREFOUR`, `ASSAI` | Mercado |
| `UBER`, `99APP`, `POSTO`, `IPIRANGA`, `SEM PARAR`, `ESTACIONAMENTO` | Transporte |
| `NETFLIX`, `SPOTIFY`, `DISNEY`, `YOUTUBE`, `APPLE.COM/BILL` | Assinaturas |
| `FARMAC`, `DROGA` | Saúde |
| `COBASI`, `PETZ`, `PETLOVE` | Pets |
| `MERCADOLIVRE`, `AMAZON`, `SHOPEE`, `MAGALU` | Compras |
| `IOF` | Serviços e taxas |

A inserção é idempotente (`ON CONFLICT DO NOTHING`).

## Entrada e saída

```ts
// src/lib/categorization/match-rule.ts (regra pura)
interface Rule { pattern: string; categoryId: string }
/** Categoria da regra cujo trecho inicia alguma palavra do nome; com mais de uma, vence o trecho mais longo. */
function matchRule(merchantName: string, rules: Rule[]): string | null;

// src/server/categorization/apply-rules.ts
/**
 * 1. Estabelecimentos sem categoria recebem a da regra padrão que casar.
 * 2. Transações não manuais e não internas recebem a categoria do seu estabelecimento (source RULE).
 * Devolve quantas transações mudaram.
 */
function applyRules(db: PrismaClient): Promise<number>;

// src/server/categorization/set-transaction-category.ts
interface SetCategoryResult { merchant: string | null; updatedCount: number }
/**
 * Marca a transação como MANUAL com a categoria dada (ou sem categoria, com null).
 * Se ela tiver estabelecimento: grava a categoria no estabelecimento e a aplica às
 * outras transações não manuais dele.
 */
function setTransactionCategory(db: PrismaClient, transactionId: string, categoryId: string | null): Promise<SetCategoryResult>;

// src/server/categorization/list-categories.ts
function listCategories(db: PrismaClient): Promise<{ id: string; name: string; color: string }[]>;
```

`importFile` chama `applyRules` depois de gravar, inclusive quando o arquivo já tinha sido importado. `listTransactions` passa a devolver `category` (`{ id, name, color } | null`) e `categorySource`, e a aceitar o filtro `category` (um id ou `"none"`).

## Interface

Na lista de `/transactions`:

- Cada transação mostra um selo com a cor e o nome da categoria. "Sem categoria" aparece em destaque de aviso.
- O selo é um seletor: escolher outra categoria grava na hora, com indicador de progresso na linha.
- Depois de uma correção, uma mensagem informa o alcance: "Categoria aplicada a 4 transações de COBASI".
- Novo filtro "Categoria", com "Todas", "Sem categoria" e cada categoria. Fica na URL (`category=`).
- Em 375 px o seletor cabe na linha de selos, sem rolagem horizontal.

## Regras

- `matchRule` compara em maiúsculas; o nome do estabelecimento já vem normalizado do leitor.
- O trecho precisa iniciar uma palavra do nome (`IOF` não casa com `BIOFARMA`). A spec original previa "contido em qualquer posição", o que gerava falsos positivos; por isso a regra `MERCADO` saiu da lista inicial (casaria com `MERCADOPAGO`).
- A correção manual em uma transação sem estabelecimento afeta só ela.
- Corrigir para "Sem categoria" remove a categoria da transação e do estabelecimento; as demais transações não manuais dele voltam a ficar sem categoria, salvo se uma regra padrão casar na próxima aplicação.
- A server action de correção exige sessão e valida que a transação e a categoria existem.
- Totais do período não mudam nesta fase; o gasto por categoria é da fase 6.

## Critérios de aceite

Automatizados (unidade):

1. `matchRule("IFD *RESTAURANTE EXEMPLO", …)` devolve Alimentação; `"UBER EATS"` com regras `UBER` e `UBER EATS` devolve a do trecho mais longo; nome sem regra devolve `null`.

Automatizados (banco):

2. A migração cria as 14 categorias e as regras padrão; rodá-la em banco já populado não duplica.
3. Importar `credit-card.ofx` categoriza `IFD *RESTAURANTE EXEMPLO` como Alimentação com `source = RULE`, deixa `MP *LOJAEXEMPLO` sem categoria e não categoriza `Pagamento recebido`.
4. `setTransactionCategory` em uma compra de um estabelecimento com três transações: a escolhida fica `MANUAL`, as outras duas ficam `RULE` com a mesma categoria, o estabelecimento guarda a categoria e `updatedCount` é 3.
5. Uma transação já `MANUAL` do mesmo estabelecimento não muda quando outra é corrigida.
6. Depois de uma correção, importar outro arquivo com o mesmo estabelecimento já grava a transação nova com a categoria corrigida.
7. `setTransactionCategory` com transação ou categoria inexistente lança erro e não altera nada.
8. `applyRules` é idempotente: a segunda chamada devolve 0.
9. `listTransactions` devolve a categoria de cada linha e respeita o filtro por categoria e por `"none"`.

Verificados no navegador:

10. Trocar a categoria de uma linha atualiza o selo, mostra a mensagem de alcance e as outras linhas do mesmo estabelecimento mudam junto.
11. O filtro "Sem categoria" lista só as pendentes.
12. As telas continuam sem rolagem horizontal em 375 px.

## Casos de borda

| Situação | Resultado |
|---|---|
| Estabelecimento casa com duas regras de mesmo tamanho | vence a de trecho alfabeticamente menor (determinístico) |
| Pix para pessoa física | sem regra padrão; fica sem categoria até a primeira correção |
| Transação `OTHER` sem estabelecimento (por exemplo "Débito em conta") | sem categoria; correção vale só para ela |
| Categoria apagada no futuro | transações e estabelecimentos voltam a "sem categoria" (`SetNull`); regras somem (`Cascade`) |

## Fora desta spec

- Criar, renomear, recolorir ou apagar categorias pela interface.
- Editar as regras padrão pela interface.
- Relatório de gasto por categoria (fase 6).
- Sugestão de categoria por IA (avaliar na fase 7).
- Remoção do prefixo do intermediador: o casamento por trecho contido já resolve `IFD *...` e `MP *...`.

## Dúvidas em aberto

1. **Regras padrão no banco.** Proposta: guardá-las na tabela `category_rules`, semeada pela migração, em vez de uma lista no código. Permite editá-las no futuro sem deploy.
2. **Correção vale para o passado.** Proposta: ao corrigir uma transação, aplicar também às outras não manuais do mesmo estabelecimento, e não só às próximas importações.
3. **Transações já importadas em produção.** Proposta: as regras são reaplicadas ao fim de toda importação. Depois do deploy, basta reenviar qualquer arquivo para categorizar o que já existe.
4. **Lista de categorias.** As 14 acima são um ponto de partida; diga se quer tirar, incluir ou renomear alguma. "Pessoas" serve para Pix a pessoas físicas.
5. **Sem tela de gerenciar categorias.** Proposta: deixar para depois; por enquanto a lista é a da migração.
