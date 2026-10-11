# ADR 0002: Yarn e Docker no desenvolvimento

- **Data:** 2026-10-10
- **Status:** aceita

## Contexto

O autor prefere Yarn ao npm e quer rodar o projeto inteiro em containers.

## Decisão

- **Gerenciador de pacotes:** Yarn 4, com a versão fixada no repositório (`.yarn/releases` e `yarnPath` em `.yarnrc.yml`) e `nodeLinker: node-modules`.
- **Ambiente de desenvolvimento:** Docker Compose com dois serviços, `app` (Next.js em modo dev) e `db` (PostgreSQL 17).
- **Produção:** continua na Vercel com Neon, sem Docker (ver ADR 0001).

## Motivos

- Fixar o Yarn no repositório dispensa Corepack e instalação global: qualquer `yarn` na máquina ou no container delega para a mesma versão.
- `node-modules` em vez de Plug'n'Play evita incompatibilidades com Next.js e ferramentas.
- O Postgres local permite desenvolver e testar migrações sem tocar no banco do Neon.

## Consequências

- O Yarn não instala dependências *peer* automaticamente; elas precisam estar no `package.json` (caso do `vite`, exigido pelo Vitest).
- No Windows, o container não recebe eventos de arquivo do código montado; o hot reload usa polling e é mais lento que fora do Docker.
- `node_modules` do container vive em um volume próprio (binários Linux); ao mudar dependências é preciso reconstruir a imagem e recriar o volume.
- A pasta `statements/` é excluída do container e do contexto de build.
- O banco local é Postgres comum, não Neon: diferenças do driver serverless só aparecem em produção.
