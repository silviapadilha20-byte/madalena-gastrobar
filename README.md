# Bar Digital - Sistema de Bar/Restaurante com Retirada

Sistema full stack para bar/restaurante com pedidos digitais, KDS, retirada no local, backoffice, BI, caixa, estoque básico e arquitetura preparada para SaaS multi-filial.

## Módulos entregues

- Garçom mobile web: login, mapa de mesas, abertura de pedidos, observações por item e status.
- Cozinha KDS: pedidos em tempo real, filas de aguardando/em preparo/prontos, filtros por cozinha/bar/sobremesa e alerta visual de atraso.
- Cliente QR: cardápio digital, cadastro do cliente, carrinho, pedido local por mesa ou retirada no Gastrobar e acompanhamento.
- Retirada: fila automática integrada com cozinha e status de retirada.
- Backoffice + BI: configurações de retirada/pedidos online/SLA/auto impressão, KPIs, ranking, alertas, histórico e chat.

## Tecnologias

- Backend: Node.js, JWT, WebSocket e PostgreSQL opcional.
- Banco: PostgreSQL.
- Frontend: HTML/CSS/JS responsivo, mobile-first.
- Tempo real: WebSocket nativo implementado no servidor.
- SaaS: tabelas com `tenant_id` e `branch_id` para multi-filial.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

Login demo:

```text
admin@demo.com
123456
```

Sem `DATABASE_URL`, o sistema roda em modo demo em memória para teste rápido. Para produção ou homologação, configure PostgreSQL.

## Criar banco gratuito

Use uma destas opcoes gratuitas:

- Supabase: https://supabase.com
- Neon: https://neon.tech
- Railway: https://railway.app

Passo a passo recomendado no Supabase:

1. Crie uma conta gratuita.
2. Crie um novo projeto.
3. Abra `Project Settings > Database`.
4. Copie a connection string PostgreSQL. Se aparecer “Not IPv4 compatible”, use a string do **Session Pooler**.
5. Crie um arquivo `.env` baseado em `.env.example`.
6. Cole a URL em `DATABASE_URL`.
7. No SQL Editor do Supabase, rode `database/schema.sql`.
8. Depois rode `database/seed.sql`.
9. Inicie o sistema com `npm run dev`.

O arquivo `.env` fica fora do GitHub por segurança.

## Estrutura

```text
database/
  schema.sql  # tabelas, constraints e indices
  seed.sql    # dados iniciais
public/
  index.html  # app responsivo
  styles.css  # UX/UI
  app.js      # cliente REST + WebSocket
src/
  server.js   # API, auth, WebSocket e PostgreSQL
```

## Endpoints principais

- `POST /api/auth/login`
- `GET /api/bootstrap`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id/status`
- `PATCH /api/orders/:id/rating`
- `PUT /api/settings`
- `GET /api/dashboard`

## Próximos passos para vender como SaaS

- Separar frontend em React/Next.js quando o produto crescer.
- Adicionar migrations com Prisma/Knex.
- Implementar gateway real de PIX/cartão.
- Integrar impressoras por agente local ou fila cloud.
- Adicionar assinatura, billing e tela de onboarding por filial.
- Criar app PWA para garçom, cliente e cozinha.
