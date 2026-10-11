# Roadmap

Cada fase termina em algo verificável. Uma fase só começa com a spec escrita em `docs/specs/`.

| Fase | Entrega | Como verificar | Status |
|---|---|---|---|
| 0 | Projeto Next.js, testes, documentação de contexto | `yarn test`, `yarn typecheck`, `yarn lint` e `yarn build` passam | feita |
| 1 | Leitor de OFX do Nubank (conta e cartão) em `src/lib/`, sem banco | testes com `fixtures/nubank/*.ofx` | feita (falta conferir com arquivo real) |
| 2 | Banco de dados: schema Prisma, Neon, migração inicial | migração aplicada; teste de gravação sem duplicar | feita (banco local; Neon entra na fase 3) |
| 3 | Login de usuário único e deploy na Vercel | rota protegida inacessível sem login, em produção | próxima |
| 4 | Tela de upload e lista de transações | importar as fixtures pela interface | |
| 5 | Categorização por regras e correção manual que vira regra | testes das regras; correção reflete na importação seguinte | |
| 6 | Relatórios: por categoria, mês a mês, estabelecimentos, recorrentes, parcelas futuras | testes dos cálculos com dados conhecidos | |
| 7 | Dicas geradas por IA com dados agregados | spec define o que é enviado ao serviço | |
| 8 | PWA | instalar no iPhone pela tela de início | |

## Pendências fora das fases

- Criar contas na Vercel e no Neon (necessárias a partir da fase 2).
- Exportar faturas com estorno, IOF e juros para completar `docs/formats/nubank.md`.
