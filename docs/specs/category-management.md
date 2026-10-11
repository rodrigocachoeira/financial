# Spec: criar e gerenciar categorias

- **Fase do roadmap:** melhoria entre as fases 6 e 7
- **Status:** implementada em 2026-10-11

## Objetivo

Permitir que o usuário crie categorias próprias e mantenha a lista: renomear, trocar a cor, marcar como "não conta como gasto" e apagar.

## Decisão de interface

Foram comparadas três formas de criar uma categoria:

| Opção | Avaliação |
|---|---|
| Criar pelo seletor de categoria da transação | **Adotada.** A necessidade nasce ao categorizar uma transação; criar ali termina com a transação já categorizada |
| Página de categorias | **Adotada para gerenciar.** Renomear, recolorir e apagar não cabem em um menu, e são tarefas raras |
| Botão com modal na página de transações | Descartada. Cria a categoria solta da transação e exige um segundo passo para aplicá-la |

## Comportamento

### No seletor (`SelectMenu`)

- Campo de busca no topo, que filtra ignorando acentos e maiúsculas. Também vale para o filtro de categoria da lista.
- Se o texto digitado não corresponde a nenhuma categoria, aparece "Criar “texto”". Escolher cria a categoria e a aplica à transação; o estabelecimento aprende, como em qualquer correção.
- Só o nome é pedido. A cor vem da paleta (`CATEGORY_COLORS`): a primeira ainda não usada.
- No rodapé do menu, o link "Gerenciar categorias".
- No celular o campo de busca não recebe foco ao abrir, para o teclado não cobrir a lista; a folha sobe acima do teclado quando ele aparece.

### Na página `/categories`

- Lista em ordem alfabética com cor, nome, número de transações e a marca "não conta como gasto".
- "Nova categoria" e o toque em uma linha abrem o mesmo diálogo: nome, cor (paleta de 20) e a opção "Não contar como gasto".
- Apagar pede confirmação e informa quantas transações voltam para "Sem categoria".
- Acesso pelo botão "Categorias" na página de transações e pelo rodapé do seletor. Não entra no cabeçalho, que já está no limite no celular.

## Regras

- O nome é guardado sem espaços nas pontas e sem espaços repetidos, com até 40 caracteres.
- Dois nomes são o mesmo quando coincidem ignorando acentos, maiúsculas e espaçamento ("Alimentação" e "alimentacao"). Criar pelo seletor com um nome equivalente usa a categoria existente; criar ou renomear pela página é recusado.
- Apagar uma categoria deixa suas transações e estabelecimentos sem categoria, inclusive as corrigidas à mão, e remove as regras padrão dela. Na próxima importação, as regras padrão de outras categorias podem voltar a categorizar esses estabelecimentos.
- Qualquer categoria pode ser editada ou apagada, inclusive as que vêm da migração.
- Todas as ações exigem sessão e validam os identificadores recebidos.

## Verificação

- Unidade: normalização e validação de nomes, busca sem acentos, escolha de cor.
- Banco: criar, localizar ou criar, atualizar, apagar e listar com uso.
- Navegador: busca, criação pelo seletor, nome repetido recusado, edição de nome, cor e marca, exclusão com confirmação, diálogo em 375 px.

## Fora desta spec

- Editar as regras padrão (`category_rules`) pela interface.
- Unir duas categorias em uma.
- Ícones por categoria e ordenação manual.
