create extension if not exists "uuid-ossp";

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name varchar(140) not null,
  plan varchar(40) not null default 'starter',
  created_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name varchar(140) not null,
  tax_id varchar(40),
  address text,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  name varchar(140) not null,
  email varchar(180) not null unique,
  password_hash text not null,
  role varchar(30) not null check (role in ('admin','manager','waiter','kitchen','delivery','cashier')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table system_settings (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  delivery_enabled boolean not null default true,
  online_orders_enabled boolean not null default true,
  delivery_open_time time not null default '18:00',
  delivery_close_time time not null default '23:30',
  delivery_radius_km numeric(8,2) not null default 7,
  delivery_fee_cents integer not null default 600,
  avg_prep_minutes integer not null default 25,
  prep_sla_minutes integer not null default 18,
  pix_enabled boolean not null default true,
  card_enabled boolean not null default true,
  pix_key varchar(180),
  payment_gateway varchar(60) not null default 'mercadopago',
  payment_gateway_enabled boolean not null default false,
  payment_gateway_public_key text,
  payment_gateway_secret_key text,
  birthday_discount_percent integer not null default 10,
  auto_print_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id)
);

create table dining_tables (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  code varchar(20) not null,
  seats integer not null default 4,
  x integer not null default 0,
  y integer not null default 0,
  status varchar(20) not null default 'free' check (status in ('free','open','waiting','closed')),
  unique (branch_id, code)
);

create table menu_categories (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name varchar(100) not null,
  kitchen_sector varchar(30) not null check (kitchen_sector in ('kitchen','bar','dessert')),
  sort_order integer not null default 0
);

create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  category_id uuid not null references menu_categories(id) on delete restrict,
  name varchar(140) not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  available boolean not null default true,
  promotion_price_cents integer,
  prep_time_minutes integer not null default 12,
  stock_quantity numeric(12,3),
  low_stock_alert numeric(12,3) default 5,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name varchar(140) not null,
  phone varchar(40),
  email varchar(180),
  birthdate date,
  created_at timestamptz not null default now()
);

create table customer_addresses (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  label varchar(80) not null default 'Principal',
  street varchar(180) not null,
  number varchar(30),
  complement varchar(100),
  district varchar(100),
  city varchar(100),
  distance_km numeric(8,2),
  created_at timestamptz not null default now()
);

create table couriers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name varchar(140) not null,
  phone varchar(40),
  active boolean not null default true
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  table_id uuid references dining_tables(id) on delete set null,
  waiter_id uuid references users(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  address_id uuid references customer_addresses(id) on delete set null,
  courier_id uuid references couriers(id) on delete set null,
  order_type varchar(20) not null check (order_type in ('local','delivery')),
  source varchar(20) not null default 'waiter' check (source in ('waiter','qr','delivery','admin')),
  status varchar(30) not null check (status in ('sent','received','preparing','ready','served','out_for_delivery','delivered','cancelled')),
  payment_method varchar(30) check (payment_method in ('pix','card','cash','account')),
  payment_status varchar(20) not null default 'pending' check (payment_status in ('pending','paid','refunded')),
  subtotal_cents integer not null default 0,
  delivery_fee_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  estimated_minutes integer not null default 25,
  prep_sla_minutes integer not null default 18,
  preparing_at timestamptz,
  ready_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  rating integer check (rating between 1 and 5),
  rating_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete restrict,
  name_snapshot varchar(140) not null,
  sector varchar(30) not null check (sector in ('kitchen','bar','dessert')),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  notes text,
  status varchar(30) not null default 'sent' check (status in ('sent','preparing','ready','served','cancelled')),
  print_status varchar(20) not null default 'pending' check (print_status in ('pending','printed','failed')),
  created_at timestamptz not null default now()
);

create table cash_sessions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  opened_by uuid references users(id) on delete set null,
  closed_by uuid references users(id) on delete set null,
  opening_amount_cents integer not null default 0,
  closing_amount_cents integer,
  status varchar(20) not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table cash_movements (
  id uuid primary key default uuid_generate_v4(),
  cash_session_id uuid not null references cash_sessions(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  type varchar(20) not null check (type in ('sale','withdrawal','supply','adjustment')),
  payment_method varchar(30),
  amount_cents integer not null,
  description text,
  created_at timestamptz not null default now()
);

create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  type varchar(20) not null check (type in ('in','out','adjustment')),
  quantity numeric(12,3) not null,
  reason text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  channel varchar(30) not null default 'local',
  title varchar(140) not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  reason varchar(120) not null,
  status varchar(20) not null default 'open' check (status in ('open','waiting_customer','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  author varchar(30) not null check (author in ('customer','backoffice')),
  author_name varchar(140) not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index idx_orders_branch_status_created on orders(branch_id, status, created_at desc);
create index idx_orders_type_created on orders(order_type, created_at desc);
create index idx_order_items_sector_status on order_items(sector, status);
create index idx_menu_items_available on menu_items(branch_id, available);
create index idx_chat_conversations_status on chat_conversations(branch_id, status, updated_at desc);
