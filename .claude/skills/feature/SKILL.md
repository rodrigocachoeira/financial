---
name: feature
description: Conduz uma funcionalidade ou fase do roadmap pelo ciclo spec, testes, implementação e verificação. Use quando o usuário pedir para iniciar uma fase de docs/roadmap.md ou implementar uma funcionalidade nova.
argument-hint: "[fase do roadmap ou descrição da funcionalidade]"
---

# Ciclo de funcionalidade

Alvo: $ARGUMENTS

Se o alvo estiver vazio, use a fase marcada como `próxima` em `docs/roadmap.md`.

Siga as etapas em ordem. Há uma parada obrigatória na etapa 2.

## 1. Contexto

- Leia `docs/roadmap.md`, `docs/product.md` e `docs/domain.md`.
- Leia o que mais a funcionalidade tocar: `docs/formats/` para importação, `docs/adr/` para decisões de arquitetura, specs anteriores em `docs/specs/`.
- Confira se a funcionalidade está no escopo do MVP. Se estiver em "Fora do escopo", avise e pare.

## 2. Spec (parada obrigatória)

Escreva `docs/specs/<nome-em-ingles>.md`, em português, com:

- **Objetivo:** uma ou duas frases.
- **Entrada e saída:** tipos em TypeScript, com os nomes do glossário de `docs/domain.md`.
- **Regras:** as regras de domínio aplicáveis, citando a seção de origem.
- **Critérios de aceite:** lista verificável; cada item vira pelo menos um teste.
- **Casos de borda:** entradas inválidas, vazias e os casos "ainda não observados".
- **Fora desta spec:** o que fica para outra fase.
- **Dúvidas em aberto:** decisões que dependem do usuário.

Apresente um resumo da spec e **pare para o usuário revisar**. Não escreva código antes da aprovação.

## 3. Testes primeiro

- Escreva os testes ao lado do código (`foo.test.ts`), um grupo por critério de aceite.
- Use os arquivos de `fixtures/`. Se faltar um caso, crie uma fixture sintética nova; nunca copie dados de `statements/`.
- Rode `yarn test` e confirme que os testes novos falham pelo motivo esperado.

## 4. Implementação

- Regra de negócio em `src/lib/`, sem importar Next.js nem Prisma.
- Implemente o mínimo para os testes passarem; não adicione o que a spec não pede.
- Se a implementação mostrar que a spec está errada, corrija a spec e avise, em vez de divergir em silêncio.

## 5. Verificação

Rode os três e corrija até passarem:

```
yarn test
yarn typecheck
yarn lint
```

Se houver interface, abra a página no navegador e confira o comportamento.

## 6. Fechamento

- Atualize o status da fase em `docs/roadmap.md` e indique a próxima.
- Se surgiu regra de domínio ou formato novo, atualize `docs/domain.md` ou `docs/formats/`.
- Se houve decisão de arquitetura, registre um ADR em `docs/adr/`.
- Resuma para o usuário: o que mudou, resultado dos testes, o que não foi verificado e as dúvidas em aberto.
- Não faça commit.
