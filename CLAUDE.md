# Financial

Aplicação web pessoal que importa extratos e faturas do Nubank e mostra para onde vai o dinheiro. Next.js (App Router) + TypeScript, Prisma, PostgreSQL no Neon, deploy na Vercel.

@AGENTS.md

## Comandos

O gerenciador de pacotes é o Yarn 4 (fixado em `.yarn/releases`). Não use `npm`.

- `yarn dev`: servidor local em http://localhost:3000
- `yarn test`: testes (Vitest), uma execução
- `yarn typecheck`: checagem de tipos
- `yarn lint`: ESLint
- `yarn build`: build de produção
- `yarn test:db`: testes de banco (`*.db.test.ts`); exige o container `db` no ar
- `yarn db:migrate --name <nome>`: cria e aplica uma migração no banco local
- `yarn db:generate`: regenera o cliente Prisma em `src/generated/prisma`
- `yarn ofx:summary <arquivo.ofx>`: totais de um OFX, sem exibir descrições (para o autor conferir arquivos reais)

Antes de dar uma tarefa por concluída, rode `yarn test`, `yarn typecheck` e `yarn lint`. Se mexeu em `prisma/` ou `src/server/`, rode também `yarn test:db`.

## Docker (ambiente de desenvolvimento)

- `docker compose up --build`: sobe o app (porta 3000) e o Postgres local (porta 5432)
- `docker compose exec app yarn test`: roda um comando dentro do container do app
- Ao mudar dependências: basta reiniciar o app (`docker compose restart app`); o container roda `yarn install` ao subir
- Se o container mostrar estilo ou código antigo, reinicie o app: a subida limpa o cache `.next`, que já serviu CSS desatualizado
- `statements/` não é montada no container. Produção roda na Vercel, sem Docker.

## Documentação (leia antes de mexer na área correspondente)

- `docs/product.md`: escopo do MVP e o que está fora dele
- `docs/domain.md`: glossário (nomes usados no código) e regras de negócio
- `docs/formats/nubank.md`: layout dos arquivos OFX e CSV
- `docs/adr/`: decisões de arquitetura já tomadas; não reverter sem novo ADR
- `docs/roadmap.md`: fases e a próxima tarefa
- `docs/deploy.md`: variáveis de ambiente e passo a passo de Google, Neon e Vercel

## Convenções

- Código, nomes de arquivos, pastas, tabelas e commits em inglês. Texto de `docs/` e da interface em português.
- O que conta como gasto ou receita é decidido só em `src/lib/reports/amounts.ts`. Relatórios e totais usam essas funções; não refaça a regra em consultas ou componentes.
- Cálculos de relatório são funções puras em `src/lib/reports/` sobre as linhas de `loadReportRows`.
- Nunca compare transações pelo `FITID` puro: no cartão ele se repete. Use o `externalId` montado pelo leitor (`docs/formats/nubank.md`).
- Dinheiro é sempre inteiro em centavos (`amountCents`); use `toCents` de `src/lib/money.ts`, nunca `parseFloat`.
- Testes ficam ao lado do código (`foo.ts` e `foo.test.ts`) e usam os arquivos de `fixtures/`.
- Regra de negócio fica em `src/lib/`, sem depender de Next.js nem de Prisma, para ser testável isoladamente.
- Código que acessa o banco fica em `src/server/` e recebe o `PrismaClient` por parâmetro; `src/lib/` nunca importa Prisma.
- Páginas e server actions obtêm o cliente com `getDb()` (`src/server/db.ts`), dentro da função, nunca no topo do módulo: o build precisa passar sem `DATABASE_URL`.
- Páginas protegidas ficam em `src/app/(app)/`, que traz o cabeçalho comum. Leitura de dados fica em um componente assíncrono dentro de `<Suspense>` e começa por `requireSession()`.
- Datas trafegam como `"AAAA-MM-DD"`; a conversão para `Date` fica em `src/server/dates.ts`. Formatação para a tela em `src/lib/format.ts`.
- A interface é usada no iPhone: toda tela nova deve funcionar em 375 px de largura, sem rolagem horizontal.

## Interface

- Cores vêm dos tokens de `src/app/globals.css` (`bg-surface`, `text-muted`, `border-border`, `bg-accent`, `text-positive`, `text-negative`, e as variantes `-soft`), com valores para tema claro e escuro. Não use cores fixas do Tailwind (`zinc-*`, `red-*`) nas telas.
- Botões, cartões, selos e esqueletos usam as classes de `src/components/ui.ts`; ícones vêm de `src/components/icons.tsx`. Não adicione biblioteca de ícones ou de componentes.
- Gráficos são HTML e CSS próprios, sem biblioteca: uma cor só (o destaque) para magnitude, cor de categoria apenas como bolinha ao lado do nome, texto sempre nos tokens de texto, e uma tabela `sr-only` com os mesmos números.
- Listas de escolha usam `SelectMenu` (`src/components/select-menu.tsx`), que abre um menu flutuante no desktop e uma folha inferior no celular, com busca opcional (`searchable`) e criação a partir do texto digitado (`onCreate`). Não use `<select>` nativo: a lista aberta dele não aceita estilo.
- Modais usam `Dialog` (`src/components/dialog.tsx`), sobre o `<dialog>` nativo. Campos de texto têm fonte de 16 px no celular, para o iOS não dar zoom ao focar.
- Toda ação demorada mostra progresso: `Spinner` no botão durante o envio e esqueleto no `fallback` do `<Suspense>`.
- Entrada de dinheiro em `text-positive`, saída em `text-foreground` com ícone em `negative`, transferência interna em `text-muted`.
- Funcionalidade nova começa por uma spec em `docs/specs/`.

## Autenticação

- Tudo é protegido por padrão. Caminhos públicos são só os listados em `isPublicPath` (`src/lib/auth/access.ts`).
- Toda página protegida chama `requireSession()` e toda rota de API ou server action chama `getSession()` (`src/server/auth/session.ts`), mesmo com o `src/proxy.ts` no caminho. O proxy é só uma checagem otimista.
- `cacheComponents` está ligado: leitura de sessão fica dentro de `<Suspense>`, nunca no topo de um layout.
- No Next.js 16 o arquivo é `proxy.ts`; não crie `middleware.ts`.
- Não registre e-mail nem token em logs.

## Banco de dados

- Schema em `prisma/schema/`, um arquivo por assunto. Tabelas e colunas em `snake_case` via `@map`; modelos e campos em `camelCase`.
- Todo índice novo precisa de uma consulta que o justifique, registrada na spec.
- Nunca edite uma migração já aplicada; crie outra. Restrições que o Prisma não declara (como `CHECK`) entram em SQL na migração, com `--create-only`.
- `prisma`, `@prisma/client` e `@prisma/adapter-pg` ficam fixados na mesma versão estável (hoje 7.10.0). Em 2026-10-11 a tag `latest` do pacote `prisma` apontava para uma versão `8.0.0-rc`; não atualize sem conferir que as três versões coincidem.
- `yarn test:db` usa o banco `financial_test` e apaga os dados importados dele a cada teste. Nunca aponte `TEST_DATABASE_URL` para outro banco.
- Categorias e regras padrão iniciais são dados de migração (`-- seed:` no SQL, com `ON CONFLICT DO NOTHING`); o usuário também cria e apaga categorias pela interface. Os testes de banco não apagam as categorias semeadas e removem as que criarem.
- Nomes de categoria são comparados com `searchKey` (`src/lib/categorization/category-name.ts`), que ignora acentos, maiúsculas e espaçamento. Toda escrita em categorias passa por `src/server/categorization/manage-categories.ts`.
- Ids vindos do navegador passam por `isUuid` (`src/lib/uuid.ts`) antes de chegar a uma consulta.

## Privacidade

- Nunca leia, copie ou cite arquivos de `statements/`: são extratos reais. Para entender um formato, use `fixtures/` ou peça uma amostra mascarada.
- Descrições de transações contêm nome e CPF/CNPJ de terceiros: não colocar em logs nem em mensagens de erro.

## Git

- O autor faz os commits. Não rode `git commit` nem `git push`.
