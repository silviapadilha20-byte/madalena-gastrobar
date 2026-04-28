create table if not exists produtos (
  id bigserial primary key,
  nome text not null unique,
  descricao text,
  preco numeric(10,2) not null check (preco >= 0),
  preco_promocional numeric(10,2) check (preco_promocional is null or preco_promocional >= 0),
  categoria text not null check (categoria in ('cozinha', 'bar', 'sobremesa')),
  imagem_url text,
  disponivel boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table produtos add column if not exists preco_promocional numeric(10,2) check (preco_promocional is null or preco_promocional >= 0);
alter table produtos add column if not exists imagem_url text;

create table if not exists mesas (
  id bigserial primary key,
  numero integer not null unique,
  status text not null default 'livre' check (status in ('livre', 'ocupada')),
  criado_em timestamptz not null default now()
);

create table if not exists pedidos (
  id bigserial primary key,
  mesa_id bigint references mesas(id) on delete set null,
  cliente_nome text,
  status text not null default 'novo' check (status in ('novo', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado')),
  pronto_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists pedido_itens (
  id bigserial primary key,
  pedido_id bigint not null references pedidos(id) on delete cascade,
  produto_id bigint references produtos(id) on delete set null,
  nome text not null,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  observacao text
);

create table if not exists pagamentos (
  id bigserial primary key,
  pedido_id bigint not null references pedidos(id) on delete cascade,
  metodo text not null check (metodo in ('dinheiro', 'cartao', 'pix')),
  valor numeric(10,2) not null check (valor >= 0),
  criado_em timestamptz not null default now()
);

create table if not exists configuracoes_pagamento (
  id integer primary key default 1,
  pix_ativo boolean not null default true,
  cartao_ativo boolean not null default true,
  dinheiro_ativo boolean not null default true,
  chave_pix text,
  gateway_nome text not null default 'manual',
  gateway_ativo boolean not null default false,
  gateway_public_key text,
  gateway_secret_key text,
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_pagamento_singleton check (id = 1)
);

create index if not exists idx_pedidos_status on pedidos(status);
create index if not exists idx_pedidos_mesa on pedidos(mesa_id);
create index if not exists idx_itens_pedido on pedido_itens(pedido_id);
create index if not exists idx_pagamentos_pedido on pagamentos(pedido_id);
