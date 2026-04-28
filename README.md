# Bar Digital

Sistema profissional para bar/restaurante com aplicações separadas e backend centralizado em PostgreSQL.

## Arquitetura

Cada aplicação roda em processo e porta próprios:

| Aplicação | Pasta | URL |
| --- | --- | --- |
| Backend API | `server` | `http://localhost:3000` |
| Cliente QR | `client` | `http://localhost:3001?mesa=1` |
| Backoffice/Garçom | `admin` | `http://localhost:3002` |
| Cozinha KDS | `kds` | `http://localhost:3003` |
| BI/Dashboard | `bi` | `http://localhost:3004` |

Os frontends não compartilham estado entre si. Toda comunicação passa pela API HTTP.

## Banco

O backend usa PostgreSQL via `DATABASE_URL`.

```bash
cd server
copy .env.example .env
npm install
npm run db:setup
npm run dev
```

O arquivo `server/.env` não sobe para o GitHub.

## Rodar as aplicações

Abra um terminal para cada aplicação:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

```bash
cd admin
npm run dev
```

```bash
cd kds
npm run dev
```

```bash
cd bi
npm run dev
```

## Endpoints principais

- `GET /produtos`
- `GET /mesas`
- `POST /pedidos`
- `GET /pedidos`
- `GET /pedidos?status=novo`
- `PATCH /pedidos/:id`
- `POST /pagamentos`
- `GET /relatorios`

## Fluxo

1. Cliente cria pedido pelo QR.
2. API salva o pedido com status `novo`.
3. KDS busca pedidos ativos por polling.
4. Cozinha atualiza para `em_preparo` e `pronto`.
5. Admin/Garçom entrega e finaliza.
6. Admin registra pagamento em dinheiro, cartão ou PIX.

## Tabelas

- `produtos`
- `mesas`
- `pedidos`
- `pedido_itens`
- `pagamentos`
