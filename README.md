# Financial

Aplicação web pessoal para importar extratos e faturas do Nubank e gerar relatórios de consumo.

## Como rodar com Docker

Requer o Docker Desktop.

```bash
docker compose up --build
```

Abra http://localhost:3000. O login exige as variáveis do Google no `.env` (veja [docs/deploy.md](docs/deploy.md)). O Postgres local fica em `localhost:5432` (usuário, senha e banco: `financial`).

Para rodar comandos dentro do container:

```bash
docker compose exec app yarn test
```

## Como rodar sem Docker

Requer Node.js 24 e Yarn (a versão do projeto está fixada em `.yarn/releases`). O banco continua vindo do Docker.

```bash
cp .env.example .env
docker compose up -d db
yarn install
yarn db:deploy
yarn dev
```

## Scripts

| Comando | O que faz |
|---|---|
| `yarn dev` | servidor de desenvolvimento |
| `yarn test` | testes |
| `yarn typecheck` | checagem de tipos |
| `yarn lint` | ESLint |
| `yarn build` | build de produção |
| `yarn test:db` | testes de banco (exige o container `db`) |
| `yarn db:migrate --name <nome>` | cria e aplica uma migração local |
| `yarn db:studio` | abre o Prisma Studio para ver os dados |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/app/` | páginas e rotas da API (Next.js App Router) |
| `src/lib/` | regras de negócio, sem dependência de framework |
| `src/server/` | acesso ao banco de dados |
| `prisma/` | schema e migrações |
| `fixtures/` | extratos sintéticos usados nos testes |
| `docs/` | produto, domínio, formatos, decisões e roadmap |
| `statements/` | extratos reais, fora do git e fora do container |

## Documentação

Comece por [docs/product.md](docs/product.md) e [docs/roadmap.md](docs/roadmap.md). Para configurar o login e publicar, siga [docs/deploy.md](docs/deploy.md).
