# Deploy e configuração de acesso

Passo a passo para publicar na Vercel com banco no Neon e login pelo Google. Os valores de segredos ficam só no `.env` local e no painel da Vercel; nunca no repositório.

## 1. Segredo da sessão

Gere dois valores, um para uso local e outro para produção:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 2. Google Cloud

1. Em https://console.cloud.google.com, crie um projeto.
2. Em **APIs e serviços > Tela de permissão OAuth**, escolha o tipo **Externo**, preencha nome e e-mail, e mantenha o status **Em teste**.
3. Em **Usuários de teste**, adicione a sua conta Google. Só ela conseguirá concluir o login.
4. Em **Credenciais > Criar credenciais > ID do cliente OAuth**, escolha **Aplicativo da Web** e adicione em **URIs de redirecionamento autorizados**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<seu-projeto>.vercel.app/api/auth/callback/google` (depois do passo 5)
5. Guarde o **ID do cliente** e a **chave secreta**.

## 3. Ambiente local

No arquivo `.env` (copie de `.env.example` se ainda não existir), preencha:

| Variável | Valor |
|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | o valor local do passo 1 |
| `GOOGLE_CLIENT_ID` | do passo 2 |
| `GOOGLE_CLIENT_SECRET` | do passo 2 |
| `AUTH_ALLOWED_EMAIL` | a sua conta Google |

O `compose.yaml` repassa essas variáveis do `.env` para o container. Recrie o container do app para ele ler o `.env`:

```bash
docker compose up -d --force-recreate app
```

Confira em http://localhost:3000: sem sessão cai em `/login`; com a sua conta entra e mostra o e-mail; com outra conta, o acesso é negado.

## 4. Neon

1. Em https://neon.tech, crie um projeto Postgres na região **AWS São Paulo (sa-east-1)**.
2. Em **Connection Details**, copie duas strings:
   - com **Connection pooling** ligado: será a `DATABASE_URL`;
   - com **Connection pooling** desligado: será a `DIRECT_URL`.

## 5. Vercel

1. Em https://vercel.com, entre com o GitHub e importe o repositório (privado).
2. Antes do primeiro deploy, em **Environment Variables**, adicione apenas no ambiente **Production**:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string com pool do Neon |
| `DIRECT_URL` | string direta do Neon |
| `NEXTAUTH_SECRET` | o valor de produção do passo 1 |
| `GOOGLE_CLIENT_ID` | do passo 2 |
| `GOOGLE_CLIENT_SECRET` | do passo 2 |
| `AUTH_ALLOWED_EMAIL` | a sua conta Google |

   Não defina `NEXTAUTH_URL` na Vercel.
3. Faça o deploy. O build roda `yarn vercel-build`, que aplica as migrações no Neon somente em produção.
4. Copie o domínio gerado e volte ao passo 2.4 para adicionar a URI de redirecionamento de produção.

## 6. Conferência em produção

- Abrir o domínio sem sessão redireciona para `/login`.
- Entrar com a sua conta leva à página inicial com o seu e-mail.
- Entrar com outra conta é recusado.
- No painel do Neon, em **Tables**, existem `accounts`, `imports`, `transactions`, `merchants` e `categories`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `redirect_uri_mismatch` no Google | a URI do passo 2.4 não confere exatamente com o domínio |
| Erro 500 em `/api/auth/*` | variável de ambiente ausente; a mensagem nos logs da Vercel cita qual |
| "Esta conta não tem acesso" com a conta certa | `AUTH_ALLOWED_EMAIL` diferente do e-mail da conta |
| Build falha na migração | `DIRECT_URL` ausente ou com a string com pool |
| Build não encontra o Yarn 4 | definir `ENABLE_EXPERIMENTAL_COREPACK=1` nas variáveis da Vercel |
