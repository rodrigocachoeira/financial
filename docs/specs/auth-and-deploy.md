# Spec: login com Google e deploy

- **Fase do roadmap:** 3
- **Status:** implementada em 2026-10-11 (critérios 1 a 5 verificados; 6 a 10 dependem das credenciais do autor); dúvidas em aberto aprovadas como propostas

## Objetivo

Publicar a aplicação na Vercel com o banco no Neon, acessível apenas pela conta Google do autor. Nenhuma página ou rota de dados responde sem sessão válida.

## Abordagem

- **Biblioteca:** `next-auth` 4.24 (Auth.js), a versão estável; a 5 ainda é beta. Provedor Google.
- **Sessão:** JWT em cookie `HttpOnly`, assinado com `NEXTAUTH_SECRET`. Sem tabelas de usuário ou de sessão, coerente com a spec do banco.
- **Autorização:** só entra o e-mail definido em `AUTH_ALLOWED_EMAIL`, e apenas se o Google o informar como verificado. Qualquer outra conta é recusada no retorno do Google, antes de existir sessão.
- **Negar por padrão:** tudo é protegido, exceto uma lista explícita de caminhos públicos.

### Duas camadas de proteção

Recomendação da documentação do Next.js 16 (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`):

| Camada | Onde | Papel |
|---|---|---|
| Proxy | `src/proxy.ts` (o antigo `middleware.ts`) | Checagem otimista em toda requisição: sem cookie de sessão válido, páginas redirecionam para `/login` e rotas `/api` respondem 401 |
| Acesso a dados | `src/server/auth/session.ts` | `requireSession()` valida a sessão de novo, junto de cada leitura ou escrita. Toda página, rota e server action protegida a chama |

O proxy sozinho não é barreira suficiente; a segunda camada é a que protege os dados.

## Entrada e saída

```ts
// src/lib/auth/access.ts (regra pura, sem Next.js)
function isAllowedEmail(email: string | null | undefined, emailVerified: boolean, allowedEmail: string | undefined): boolean;
function isPublicPath(pathname: string): boolean;

// src/server/auth/options.ts
const authOptions: NextAuthOptions;

// src/server/auth/session.ts
/** Devolve a sessão ou redireciona para /login. Para páginas. */
function requireSession(): Promise<{ email: string }>;
/** Devolve a sessão ou null. Para rotas de API, que respondem 401. */
function getSession(): Promise<{ email: string } | null>;
```

Arquivos de rota:

| Caminho | Conteúdo |
|---|---|
| `src/app/api/auth/[...nextauth]/route.ts` | rotas do Auth.js |
| `src/app/login/page.tsx` | botão "Entrar com Google" e mensagem de acesso negado |
| `src/app/page.tsx` | página inicial protegida: e-mail da sessão e botão "Sair" |
| `src/proxy.ts` | checagem otimista |

## Regras

- `isAllowedEmail` compara sem diferenciar maiúsculas e ignorando espaços nas pontas. É falso se o e-mail for vazio, se não estiver verificado ou se `AUTH_ALLOWED_EMAIL` não estiver definido.
- Caminhos públicos: `/login`, `/api/auth/*` e arquivos estáticos (`/_next/*`, `/favicon.ico`). Todo o resto exige sessão.
- Usuário já autenticado que abre `/login` é redirecionado para `/`.
- Sessão dura 7 dias; depois disso é preciso entrar de novo.
- A aplicação falha ao iniciar a autenticação se `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ou `AUTH_ALLOWED_EMAIL` estiverem ausentes; nunca libera acesso por falta de configuração.
- Respostas trazem os cabeçalhos `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `X-Robots-Tag: noindex`.
- O e-mail não vai para logs.

## Ambiente e deploy

### Variáveis

| Variável | Local (`.env`) | Vercel (Production) |
|---|---|---|
| `DATABASE_URL` | Postgres do Docker | string **com pool** do Neon |
| `DIRECT_URL` | não definida | string **direta** do Neon, usada só pelas migrações |
| `NEXTAUTH_SECRET` | valor aleatório | outro valor aleatório |
| `NEXTAUTH_URL` | `http://localhost:3000` | não definida (a Vercel informa a URL) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | do aplicativo OAuth | os mesmos |
| `AUTH_ALLOWED_EMAIL` | e-mail do autor | o mesmo |

Os valores são preenchidos pelo autor. `.env.example` lista os nomes, sem valores reais.

### Google

- Aplicativo OAuth do tipo "Web", com tela de consentimento em modo de teste e o autor como único usuário de teste.
- URIs de redirecionamento: `http://localhost:3000/api/auth/callback/google` e `https://<domínio-da-vercel>/api/auth/callback/google`.

### Banco em produção

- `prisma.config.ts` usa `DIRECT_URL` quando existir, senão `DATABASE_URL`. A aplicação em execução usa sempre `DATABASE_URL`.
- Script `vercel-build`: gera o cliente, aplica `prisma migrate deploy` **somente quando `VERCEL_ENV` é `production`** e roda o build.
- As variáveis de banco existem só no ambiente Production da Vercel. Deploys de preview não têm acesso ao banco.

### Vercel

- `vercel.json` fixa a região das funções em `gru1` (São Paulo), a mesma do Neon.
- Domínio padrão `*.vercel.app`.

## Critérios de aceite

Automatizados:

1. `isAllowedEmail` aceita o e-mail permitido com diferença de caixa e espaços; recusa outro e-mail, e-mail não verificado, vazio, e qualquer e-mail quando o permitido não está definido.
2. `isPublicPath` é verdadeiro para `/login`, `/api/auth/session`, `/api/auth/callback/google` e `/_next/static/x.js`; falso para `/`, `/api/imports`, `/loginx` e `/api/authx`.
3. `yarn test`, `yarn typecheck`, `yarn lint` e `yarn build` passam.

Verificados no navegador, localmente:

4. Sem sessão, abrir `/` redireciona para `/login`.
5. Sem sessão, uma rota `/api/*` fora de `/api/auth` responde 401.
6. Entrar com a conta permitida leva a `/` e mostra o e-mail.
7. Entrar com outra conta Google volta para `/login` com a mensagem de acesso negado e sem cookie de sessão.
8. "Sair" encerra a sessão; `/` volta a redirecionar.

Verificados em produção:

9. Os itens 4, 6 e 7 repetidos no domínio da Vercel.
10. As cinco tabelas existem no Neon após o primeiro deploy.

## Casos de borda

| Situação | Resultado |
|---|---|
| Cookie de sessão adulterado ou expirado | tratado como sem sessão |
| `AUTH_ALLOWED_EMAIL` ausente | ninguém entra; erro explícito no servidor |
| Google devolve e-mail sem `email_verified` | acesso negado |
| Requisição a `/api/*` sem sessão | 401 em JSON, sem redirecionar |
| Deploy de preview | sobe sem banco; qualquer tela que precise dele falha com erro claro |

## Fora desta spec

- Cadastro, múltiplos usuários, papéis e recuperação de conta.
- Domínio próprio.
- Limite de tentativas e auditoria de acessos.
- Upload e telas de dados (fase 4).

## Dúvidas em aberto

1. **Versão do Auth.js.** Proposta: `next-auth` 4 estável, em vez da 5 beta.
2. **Duração da sessão.** Proposta: 7 dias.
3. **Migrações no deploy.** Proposta: automáticas no build de produção. A alternativa é você rodar `yarn db:deploy` manualmente, apontando para o Neon, a cada migração.
4. **Previews sem banco.** Proposta: variáveis de banco só em Production, para que um preview nunca toque nos dados reais.
5. **Tela de consentimento em modo de teste.** Proposta: manter em teste, com você como único usuário, o que impede outras contas de sequer chegar ao retorno.
