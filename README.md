# Bar Digital - Sistema de Bar/Restaurante com Delivery

Sistema full stack para bar/restaurante com pedidos digitais, KDS, delivery, backoffice, BI, caixa, estoque básico e arquitetura preparada para SaaS multi-filial.

## Modulos entregues

- Garcom mobile web: login, mapa de mesas, abertura de pedidos, observacoes e status.
- Cozinha KDS: pedidos em tempo real, filtros por cozinha/bar/sobremesa, alerta visual de atraso e mudanca de status.
- Cliente QR: cardapio digital, carrinho, pedido local por mesa ou delivery com endereco e acompanhamento.
- Delivery: fila automatica integrada com cozinha, status e gestao visual de entregadores.
- Backoffice + BI: configuracoes de delivery/pedidos online/SLA/auto impressao, KPIs, ranking, alertas e historico.

## Tecnologias

- Backend: Node.js, Express, JWT, WebSocket.
- Banco: PostgreSQL.
- Frontend: HTML/CSS/JS responsivo, mobile-first.
- Tempo real: WebSocket (`ws`).
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

Sem `DATABASE_URL`, o sistema roda em modo demo em memoria para teste rapido. Para producao ou homologacao, configure PostgreSQL.

## Criar banco gratuito

Use uma destas opcoes gratuitas:

- Supabase: https://supabase.com
- Neon: https://neon.tech
- Railway: https://railway.app

Passo a passo recomendado no Supabase:

1. Crie uma conta gratuita.
2. Crie um novo projeto.
3. Abra `Project Settings > Database`.
4. Copie a connection string PostgreSQL.
5. Crie um arquivo `.env` baseado em `.env.example`.
6. Cole a URL em `DATABASE_URL`.
7. No SQL Editor do Supabase, rode `database/schema.sql`.
8. Depois rode `database/seed.sql`.
9. Inicie o sistema com `npm run dev`.

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

## Proximos passos para vender como SaaS

- Separar frontend em React/Next.js quando o produto crescer.
- Adicionar migrations com Prisma/Knex.
- Implementar gateway real de PIX/cartao.
- Integrar impressoras por agente local ou fila cloud.
- Adicionar assinatura, billing e tela de onboarding por filial.
- Criar app PWA para garcom, cliente e cozinha.
