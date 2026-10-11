# Produto

## Visão

Aplicação web pessoal que importa extratos e faturas do Nubank e responde, com clareza, à pergunta: **onde está indo a maior parte do meu dinheiro?**

## Usuário

Uma única pessoa (o autor). Há login porque os dados ficam na nuvem, mas não há cadastro aberto, compartilhamento nem perfis.

## Escopo do MVP

### Importação

- Fatura do cartão de crédito e extrato da conta do Nubank, por upload de arquivo.
- Guardar todos os campos que o arquivo trouxer, mesmo os ainda não usados; descartar é decisão posterior.
- Reimportar o mesmo arquivo, ou períodos sobrepostos, não pode duplicar transações.

### Categorização

- Automática na importação, por regras (por exemplo, descrição contendo "iFood" vira Alimentação).
- O usuário corrige a categoria de qualquer transação.
- Toda correção vira aprendizado: as próximas importações do mesmo estabelecimento já entram na categoria corrigida.

### Relatórios

- Gasto por categoria no período.
- Evolução mês a mês, total e por categoria.
- Maiores estabelecimentos.
- Assinaturas e gastos recorrentes.
- Parcelas futuras já comprometidas.

### Dicas

- Geradas por IA a partir dos gastos do usuário.
- O aplicativo não envia nada a terceiros: prepara um texto com dados agregados (totais por categoria, variações, recorrências, parcelas) que o usuário copia e cola no Claude com a própria conta.
- Nunca entram o arquivo bruto, descrições, nomes de pessoas ou documentos.

## Fora do escopo por enquanto

- Sugestões de investimento. É um objetivo futuro e, quando entrar, terá caráter educativo e geral, não de recomendação personalizada.
- Orçamentos e metas.
- Outros bancos e conexão automática via Open Finance.
- Mais de um usuário.
- PWA, uso offline e app nativo.

## Princípios

- **Privacidade primeiro:** extratos reais nunca entram no git nem em logs; testes usam apenas dados anonimizados em `fixtures/`.
- **Importador extensível:** o código separa "ler o formato do banco" de "gravar transações", para que outro banco seja só um novo leitor.
- **Custo zero:** tudo precisa caber nos planos gratuitos de Vercel e Neon.
