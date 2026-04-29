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
  lugares integer not null default 4 check (lugares > 0),
  status text not null default 'livre' check (status in ('livre', 'ocupada')),
  criado_em timestamptz not null default now()
);

alter table mesas add column if not exists lugares integer not null default 4 check (lugares > 0);

create table if not exists pedidos (
  id bigserial primary key,
  mesa_id bigint references mesas(id) on delete set null,
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  cliente_nascimento date,
  desconto numeric(10,2) not null default 0 check (desconto >= 0),
  cupom text,
  status text not null default 'novo' check (status in ('novo', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado', 'cancelado')),
  pronto_em timestamptz,
  entregue_em timestamptz,
  finalizado_em timestamptz,
  cancelado_em timestamptz,
  cancelado_motivo text,
  conta_solicitada_em timestamptz,
  avaliacao_nota integer check (avaliacao_nota is null or avaliacao_nota between 1 and 5),
  avaliacao_comentario text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table pedidos add column if not exists cliente_telefone text;
alter table pedidos add column if not exists cliente_email text;
alter table pedidos add column if not exists cliente_nascimento date;
alter table pedidos add column if not exists desconto numeric(10,2) not null default 0 check (desconto >= 0);
alter table pedidos add column if not exists cupom text;
alter table pedidos add column if not exists entregue_em timestamptz;
alter table pedidos add column if not exists finalizado_em timestamptz;
alter table pedidos add column if not exists cancelado_em timestamptz;
alter table pedidos add column if not exists cancelado_motivo text;
alter table pedidos add column if not exists conta_solicitada_em timestamptz;
alter table pedidos add column if not exists avaliacao_nota integer check (avaliacao_nota is null or avaliacao_nota between 1 and 5);
alter table pedidos add column if not exists avaliacao_comentario text;
alter table pedidos drop constraint if exists pedidos_status_check;
alter table pedidos add constraint pedidos_status_check check (status in ('novo', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado', 'cancelado'));

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
  status text not null default 'aprovado' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  pix_copia_cola text,
  qr_code_url text,
  gateway_nome text,
  gateway_referencia text,
  criado_em timestamptz not null default now()
);

alter table pagamentos add column if not exists status text not null default 'aprovado' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado'));
alter table pagamentos add column if not exists pix_copia_cola text;
alter table pagamentos add column if not exists qr_code_url text;
alter table pagamentos add column if not exists gateway_nome text;
alter table pagamentos add column if not exists gateway_referencia text;

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

create table if not exists usuarios (
  id bigserial primary key,
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  perfil text not null check (perfil in ('admin', 'garcom', 'cozinha', 'caixa', 'gerente')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists pedido_historico (
  id bigserial primary key,
  pedido_id bigint not null references pedidos(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  usuario_id bigint references usuarios(id) on delete set null,
  usuario_nome text,
  motivo text,
  criado_em timestamptz not null default now()
);

create table if not exists caixas (
  id bigserial primary key,
  usuario_id bigint references usuarios(id) on delete set null,
  usuario_nome text,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  saldo_inicial numeric(10,2) not null default 0 check (saldo_inicial >= 0),
  saldo_informado numeric(10,2),
  saldo_calculado numeric(10,2),
  divergencia numeric(10,2),
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz
);

create table if not exists caixa_movimentos (
  id bigserial primary key,
  caixa_id bigint not null references caixas(id) on delete cascade,
  tipo text not null check (tipo in ('abertura', 'suprimento', 'sangria', 'venda', 'fechamento')),
  metodo text check (metodo in ('dinheiro', 'cartao', 'pix')),
  valor numeric(10,2) not null check (valor >= 0),
  descricao text,
  pedido_id bigint references pedidos(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists impressoes (
  id bigserial primary key,
  pedido_id bigint not null references pedidos(id) on delete cascade,
  setor text not null check (setor in ('cozinha', 'bar', 'sobremesa', 'conta', 'comanda')),
  tipo text not null default 'pedido' check (tipo in ('pedido', 'reimpressao', 'fechamento')),
  status text not null default 'pendente' check (status in ('pendente', 'impresso', 'erro')),
  conteudo text not null,
  erro text,
  criado_em timestamptz not null default now(),
  impresso_em timestamptz
);

create table if not exists chamados_cliente (
  id bigserial primary key,
  pedido_id bigint references pedidos(id) on delete set null,
  mesa_id bigint references mesas(id) on delete set null,
  tipo text not null check (tipo in ('garcom', 'conta', 'atraso', 'nao_chegou', 'outro')),
  mensagem text,
  status text not null default 'aberto' check (status in ('aberto', 'em_atendimento', 'resolvido')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create index if not exists idx_pedidos_status on pedidos(status);
create index if not exists idx_pedidos_mesa on pedidos(mesa_id);
create index if not exists idx_itens_pedido on pedido_itens(pedido_id);
create index if not exists idx_pagamentos_pedido on pagamentos(pedido_id);
create index if not exists idx_pedidos_cliente_telefone on pedidos(cliente_telefone);
create index if not exists idx_pedido_historico_pedido on pedido_historico(pedido_id);
create index if not exists idx_caixa_movimentos_caixa on caixa_movimentos(caixa_id);
create index if not exists idx_impressoes_pedido on impressoes(pedido_id);
create index if not exists idx_chamados_status on chamados_cliente(status);

insert into usuarios (nome, email, senha_hash, perfil)
values
  ('Administrador', 'admin@demo.com', 'scrypt$admin-demo$174a37cd82a2df096ac78becb07fe9cac92df3a79ac56fe21c3cc5e585d36fbd6752b2bb4e2f67a3df43066f3f24293a15231b553e061ff1119a1a528e3aabaa', 'admin'),
  ('Garçom Demo', 'garcom@demo.com', 'scrypt$garcom-demo$e42180da30d631c80c9b2bb295ff86115c4a7016103472b5bdcfb24eb9d645f63dcc7f2f6efecc7824e53cffd31f65d7338be168a7d7b3780a01412aad77d15b', 'garcom'),
  ('Cozinha Demo', 'cozinha@demo.com', 'scrypt$cozinha-demo$4b6cf028c51460d5343c4c1f892b375143509957392dbcae170ca5f560928c3ad4cbdbf8ccf839d8f9d20829948eda81b32389dadce93a123bbc43c1134a1dd7', 'cozinha'),
  ('Caixa Demo', 'caixa@demo.com', 'scrypt$caixa-demo$2d730bea67f049b39e05069603b51c6195aa1009e5f627fdbe5334f79a5e5dd5450846804795dc2c90eb8266f5b979f699baf4389bd40fd605ba4a0bfac65d0c', 'caixa'),
  ('Gerente Demo', 'gerente@demo.com', 'scrypt$gerente-demo$7625a1e02a0815fab8fe2038d1b5cb1f999b1ba60e2a3716e2f6e14abb9778a982ca8e313d04feb5e1cde5ed6187939b739d5ba6e2b30950ae8ea7d09b51f799', 'gerente')
on conflict (email) do nothing;
