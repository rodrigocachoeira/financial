# ADR 0001: Stack da aplicação

- **Data:** 2026-10-10
- **Status:** aceita

## Contexto

Aplicação pessoal para importar extratos (inicialmente Nubank) e gerar relatórios de consumo, indicadores e dicas financeiras. Requisitos que pesaram na decisão:

- Custo zero de hospedagem e de distribuição.
- Uso no iPhone sem pagar o Apple Developer Program.
- Desenvolvimento inteiro em Windows, sem Mac.
- Back-end e banco de dados próprios, para acessar os mesmos dados do PC e do celular.
- O autor já desenvolve com React.

## Decisão

- **Aplicação:** Next.js (App Router) com TypeScript, front-end e API no mesmo projeto.
- **Acesso a dados:** Prisma.
- **Banco:** PostgreSQL no Neon (plano gratuito).
- **Hospedagem:** Vercel (plano Hobby).
- **Entrega inicial:** aplicação web responsiva. PWA fica para uma fase futura.

## Alternativas descartadas

- **App nativo (Swift, React Native, Flutter):** instalação permanente no iPhone exige conta paga da Apple e build em macOS.
- **PWA local-first sem back-end:** custo e privacidade melhores, mas sem sincronização entre aparelhos e com risco de perda dos dados locais.
- **Front-end Vite com API separada:** dois projetos para configurar e publicar, sem ganho nesse tamanho.
- **Supabase:** entrega login e API prontos, mas o projeto gratuito é pausado por inatividade e reduz o aprendizado de back-end.

## Consequências

- Dados financeiros ficam em um banco na nuvem: autenticação é obrigatória desde o primeiro deploy.
- O app depende de internet; suporte offline não é objetivo por enquanto.
- O plano Hobby da Vercel é restrito a uso pessoal e não comercial.
- O banco do Neon suspende quando ocioso, então a primeira requisição pode ser lenta.
- Migrar para PWA depois exige apenas manifesto e service worker; empacotar como app nativo continua possível via Capacitor.
