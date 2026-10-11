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
- Ao mudar dependências: `docker compose build app` e `docker compose up -V` para recriar o volume de `node_modules`
- `statements/` não é montada no container. Produção roda na Vercel, sem Docker.

## Documentação (leia antes de mexer na área correspondente)

- `docs/product.md`: escopo do MVP e o que está fora dele
- `docs/domain.md`: glossário (nomes usados no código) e regras de negócio
- `docs/formats/nubank.md`: layout dos arquivos OFX e CSV
- `docs/adr/`: decisões de arquitetura já tomadas; não reverter sem novo ADR
- `docs/roadmap.md`: fases e a próxima tarefa

## Convenções

- Código, nomes de arquivos, pastas, tabelas e commits em inglês. Texto de `docs/` e da interface em português.
- Dinheiro é sempre inteiro em centavos (`amountCents`); use `toCents` de `src/lib/money.ts`, nunca `parseFloat`.
- Testes ficam ao lado do código (`foo.ts` e `foo.test.ts`) e usam os arquivos de `fixtures/`.
- Regra de negócio fica em `src/lib/`, sem depender de Next.js nem de Prisma, para ser testável isoladamente.
- Código que acessa o banco fica em `src/server/` e recebe o `PrismaClient` por parâmetro; `src/lib/` nunca importa Prisma.
- Funcionalidade nova começa por uma spec em `docs/specs/`.

## Banco de dados

- Schema em `prisma/schema/`, um arquivo por assunto. Tabelas e colunas em `snake_case` via `@map`; modelos e campos em `camelCase`.
- Todo índice novo precisa de uma consulta que o justifique, registrada na spec.
- Nunca edite uma migração já aplicada; crie outra. Restrições que o Prisma não declara (como `CHECK`) entram em SQL na migração, com `--create-only`.
- `prisma`, `@prisma/client` e `@prisma/adapter-pg` ficam fixados na mesma versão estável (hoje 7.10.0). Em 2026-10-11 a tag `latest` do pacote `prisma` apontava para uma versão `8.0.0-rc`; não atualize sem conferir que as três versões coincidem.
- `yarn test:db` usa o banco `financial_test` e apaga os dados dele a cada teste. Nunca aponte `TEST_DATABASE_URL` para outro banco.

## Privacidade

- Nunca leia, copie ou cite arquivos de `statements/`: são extratos reais. Para entender um formato, use `fixtures/` ou peça uma amostra mascarada.
- Descrições de transações contêm nome e CPF/CNPJ de terceiros: não colocar em logs nem em mensagens de erro.

## Git

- O autor faz os commits. Não rode `git commit` nem `git push`.
