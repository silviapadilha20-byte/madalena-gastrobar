const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000101';

let Pool = null;
try {
  Pool = require('pg').Pool;
} catch {
  Pool = null;
}

const pool = process.env.DATABASE_URL && Pool
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
    })
  : null;

const demo = {
  users: [
    { id: 'u-admin', name: 'Admin', email: 'admin@demo.com', password: '123456', role: 'admin' },
    { id: 'u-ana', name: 'Ana Garçom', email: 'ana@demo.com', password: '123456', role: 'waiter' },
    { id: 'u-kds', name: 'KDS Cozinha', email: 'cozinha@demo.com', password: '123456', role: 'kitchen' }
  ],
  settings: {
    delivery_enabled: true,
    online_orders_enabled: true,
    delivery_open_time: '18:00',
    delivery_close_time: '23:30',
    delivery_radius_km: 7,
    delivery_fee_cents: 0,
    avg_prep_minutes: 25,
    prep_sla_minutes: 18,
    pix_enabled: true,
    card_enabled: true,
    pix_key: 'financeiro@bardigital.com',
    payment_gateway: 'mercadopago',
    payment_gateway_enabled: false,
    payment_gateway_public_key: '',
    payment_gateway_secret_key: '',
    birthday_discount_percent: 10,
    auto_print_enabled: true
  },
  tables: [
    { id: 't-01', code: '01', seats: 4, x: 1, y: 1, status: 'free' },
    { id: 't-02', code: '02', seats: 4, x: 2, y: 1, status: 'free' },
    { id: 't-03', code: '03', seats: 6, x: 3, y: 1, status: 'waiting' },
    { id: 't-04', code: '04', seats: 2, x: 1, y: 2, status: 'free' },
    { id: 't-05', code: '05', seats: 4, x: 2, y: 2, status: 'open' },
    { id: 't-06', code: '06', seats: 8, x: 3, y: 2, status: 'free' }
  ],
  categories: [
    { id: 'c-pratos', name: 'Comidas', kitchen_sector: 'kitchen', sort_order: 1 },
    { id: 'c-bebidas', name: 'Bebidas', kitchen_sector: 'bar', sort_order: 2 },
    { id: 'c-sobremesas', name: 'Sobremesas', kitchen_sector: 'dessert', sort_order: 3 }
  ],
  menuItems: [
    { id: 'm-burger', category_id: 'c-pratos', category_name: 'Comidas', sector: 'kitchen', name: 'Burger da Casa', description: 'Blend artesanal, queijo, salada e molho especial.', price_cents: 3490, promotion_price_cents: 2990, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', available: true, prep_time_minutes: 16, stock_quantity: 40, low_stock_alert: 5 },
    { id: 'm-batata', category_id: 'c-pratos', category_name: 'Comidas', sector: 'kitchen', name: 'Porcao de Batata', description: 'Batata crocante com cheddar e bacon.', price_cents: 2890, image_url: 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=900&q=80', available: true, prep_time_minutes: 12, stock_quantity: 25, low_stock_alert: 5 },
    { id: 'm-chopp', category_id: 'c-bebidas', category_name: 'Bebidas', sector: 'bar', name: 'Chopp Pilsen', description: 'Caneca gelada 500ml.', price_cents: 1290, image_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80', available: true, prep_time_minutes: 3, stock_quantity: 80, low_stock_alert: 10 },
    { id: 'm-caipirinha', category_id: 'c-bebidas', category_name: 'Bebidas', sector: 'bar', name: 'Caipirinha', description: 'Limao, cachaca e gelo.', price_cents: 1890, image_url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=900&q=80', available: true, prep_time_minutes: 5, stock_quantity: 50, low_stock_alert: 8 },
    { id: 'm-brownie', category_id: 'c-sobremesas', category_name: 'Sobremesas', sector: 'dessert', name: 'Brownie com Sorvete', description: 'Brownie quente e sorvete de creme.', price_cents: 2290, image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80', available: true, prep_time_minutes: 9, stock_quantity: 16, low_stock_alert: 4 }
  ],
  orders: [],
  chats: []
};

const sockets = new Set();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const money = (value) => Number(value || 0);
const json = (res, status, data) => send(res, status, 'application/json', JSON.stringify(data));

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(user) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: user.id,
    name: user.name,
    role: user.role,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12
  }));
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyJwt(token) {
  if (!token) return null;
  const [header, payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  if (signature !== expected) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return data.exp > Math.floor(Date.now() / 1000) ? data : null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  res.end(body);
}

function wsFrame(message) {
  const payload = Buffer.from(message);
  const length = payload.length;
  if (length < 126) return Buffer.concat([Buffer.from([0x81, length]), payload]);
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function broadcast(type, payload) {
  const frame = wsFrame(JSON.stringify({ type, payload, at: new Date().toISOString() }));
  for (const socket of sockets) {
    if (!socket.destroyed) socket.write(frame);
  }
}

async function dbQuery(sql, params = []) {
  if (!pool) return null;
  const result = await pool.query(sql, params);
  return result.rows;
}

function normalizeOrder(row, items = []) {
  return {
    ...row,
    subtotal_cents: money(row.subtotal_cents),
    delivery_fee_cents: money(row.delivery_fee_cents),
    total_cents: money(row.total_cents),
    items
  };
}

function isBirthdayToday(dateValue) {
  if (!dateValue) return false;
  const [, month, day] = String(dateValue).split('-').map(Number);
  const today = new Date();
  return month === today.getMonth() + 1 && day === today.getDate();
}

function calculateTotals(items, orderType, customerBirthdate) {
  const subtotal = items.reduce((sum, item) => sum + money(item.unit_price_cents || item.price_cents) * Number(item.quantity || 1), 0);
  const deliveryFee = 0;
  const discount = isBirthdayToday(customerBirthdate) ? Math.round(subtotal * Number(demo.settings.birthday_discount_percent || 10) / 100) : 0;
  return { subtotal, deliveryFee, discount, total: subtotal - discount + deliveryFee };
}

async function listOrders() {
  if (!pool) return demo.orders;
  const orders = await dbQuery(
    `select o.*, dt.code as table_code, u.name as waiter_name, c.name as customer_name
       from orders o
       left join dining_tables dt on dt.id = o.table_id
       left join users u on u.id = o.waiter_id
       left join customers c on c.id = o.customer_id
      where o.branch_id = $1
      order by o.created_at desc
      limit 200`,
    [BRANCH_ID]
  );
  const items = await dbQuery(
    `select oi.* from order_items oi join orders o on o.id = oi.order_id where o.branch_id = $1 order by oi.created_at asc`,
    [BRANCH_ID]
  );
  return orders.map((order) => normalizeOrder(order, items.filter((item) => item.order_id === order.id)));
}

async function bootstrap() {
  if (!pool) return { ...demo, mode: 'demo-memory' };
  const [settings] = await dbQuery('select * from system_settings where branch_id = $1 limit 1', [BRANCH_ID]);
  const tables = await dbQuery('select * from dining_tables where branch_id = $1 order by code', [BRANCH_ID]);
  const categories = await dbQuery('select * from menu_categories where branch_id = $1 order by sort_order, name', [BRANCH_ID]);
  const menuItems = await dbQuery(
    `select mi.*, mc.name as category_name, mc.kitchen_sector as sector
       from menu_items mi join menu_categories mc on mc.id = mi.category_id
      where mi.branch_id = $1 order by mc.sort_order, mi.name`,
    [BRANCH_ID]
  );
  return { settings, tables, categories, menuItems, orders: await listOrders(), mode: 'postgres' };
}

function listChats() {
  return demo.chats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

function createChat(payload) {
  const order = demo.orders.find((entry) => entry.id === payload.order_id);
  const now = new Date().toISOString();
  const chat = {
    id: uid(),
    order_id: payload.order_id || null,
    order_label: order ? `#${String(order.id).slice(-6)} ${order.order_type === 'delivery' ? 'Delivery' : `Mesa ${order.table_code || '--'}`}` : 'Sem pedido',
    customer_name: payload.customer_name || order?.customer_name || 'Cliente',
    customer_phone: payload.customer_phone || order?.customer_phone || '',
    customer_email: payload.customer_email || order?.customer_email || '',
    reason: payload.reason || 'Pedido atrasado',
    status: 'open',
    created_at: now,
    updated_at: now,
    messages: [
      {
        id: uid(),
        author: 'customer',
        author_name: payload.customer_name || order?.customer_name || 'Cliente',
        text: payload.message || payload.reason || 'Preciso de ajuda com meu pedido.',
        created_at: now
      }
    ]
  };
  demo.chats.unshift(chat);
  broadcast('chat:updated', chat);
  return chat;
}

function addChatMessage(id, payload) {
  const chat = demo.chats.find((entry) => entry.id === id);
  if (!chat) return null;
  const now = new Date().toISOString();
  chat.messages.push({
    id: uid(),
    author: payload.author || 'backoffice',
    author_name: payload.author_name || (payload.author === 'customer' ? chat.customer_name : 'Backoffice'),
    text: payload.message || '',
    created_at: now
  });
  chat.status = payload.status || chat.status || 'open';
  chat.updated_at = now;
  broadcast('chat:updated', chat);
  return chat;
}

async function login(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '').trim();
  if (pool) {
    const rows = await dbQuery('select id, name, email, role, password_hash from users where lower(email) = $1 and active = true limit 1', [email]);
    const user = rows[0];
    if (!user || user.password_hash !== password) return { status: 401, data: { error: 'Login inválido' } };
    return { status: 200, data: { token: signJwt(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } } };
  }
  const user = demo.users.find((item) => item.email.toLowerCase() === email && item.password === password);
  if (!user) return { status: 401, data: { error: 'Login inválido' } };
  return { status: 200, data: { token: signJwt(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } } };
}

async function createOrder(payload, user) {
  const orderType = payload.order_type || 'local';
  const source = payload.source || 'waiter';
  const items = (payload.items || []).map((item) => {
    const menu = demo.menuItems.find((entry) => entry.id === item.menu_item_id) || item;
    return {
      id: uid(),
      menu_item_id: item.menu_item_id || menu.id,
      name_snapshot: menu.name,
      sector: menu.sector || item.sector || 'kitchen',
      quantity: Number(item.quantity || 1),
      unit_price_cents: money((menu.promotion_price_cents > 0 && menu.promotion_price_cents < menu.price_cents) ? menu.promotion_price_cents : (menu.price_cents || item.unit_price_cents)),
      notes: item.notes || '',
      status: 'sent',
      print_status: demo.settings.auto_print_enabled ? 'printed' : 'pending',
      created_at: new Date().toISOString()
    };
  });
  const totals = calculateTotals(items, orderType, payload.customer_birthdate);
  const estimated = Math.max(...items.map((item) => demo.menuItems.find((entry) => entry.id === item.menu_item_id)?.prep_time_minutes || 12), demo.settings.avg_prep_minutes);

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      let customerId = null;
      let addressId = null;
      if (payload.customer_name || payload.customer_phone || payload.customer_email) {
        const customer = await client.query(
          'insert into customers (tenant_id, name, phone, email, birthdate) values ($1, $2, $3, $4, $5) returning id',
          [TENANT_ID, payload.customer_name || 'Cliente', payload.customer_phone || null, payload.customer_email || null, payload.customer_birthdate || null]
        );
        customerId = customer.rows[0].id;
      }
      if (orderType === 'delivery' && !customerId) {
        if (!customerId) {
          const customer = await client.query(
            'insert into customers (tenant_id, name, phone, email) values ($1, $2, $3, $4) returning id',
            [TENANT_ID, 'Cliente Retirada', null, null]
          );
          customerId = customer.rows[0].id;
        }
      }
      const order = await client.query(
        `insert into orders
        (tenant_id, branch_id, table_id, waiter_id, customer_id, address_id, order_type, source, status, payment_method, subtotal_cents, delivery_fee_cents, discount_cents, total_cents, estimated_minutes, prep_sla_minutes)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`,
        [TENANT_ID, BRANCH_ID, payload.table_id || null, user?.sub || null, customerId, addressId, orderType, source, orderType === 'delivery' ? 'received' : 'sent', payload.payment_method || 'pix', totals.subtotal, totals.deliveryFee, totals.discount, totals.total, estimated, demo.settings.prep_sla_minutes]
      );
      for (const item of items) {
        await client.query(
          `insert into order_items (order_id, menu_item_id, name_snapshot, sector, quantity, unit_price_cents, notes, status, print_status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [order.rows[0].id, item.menu_item_id, item.name_snapshot, item.sector, item.quantity, item.unit_price_cents, item.notes, item.status, item.print_status]
        );
      }
      await client.query('commit');
      const created = (await listOrders()).find((entry) => entry.id === order.rows[0].id);
      broadcast('order:created', created);
      return created;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const order = normalizeOrder({
    id: uid(),
    order_type: orderType,
    source,
    status: orderType === 'delivery' ? 'received' : 'sent',
    table_id: payload.table_id || null,
    table_code: demo.tables.find((table) => table.id === payload.table_id)?.code || payload.table_code || null,
    waiter_name: user?.name || 'Ana Garçom',
    customer_name: payload.customer_name || (orderType === 'delivery' ? 'Cliente Retirada' : null),
    customer_phone: payload.customer_phone || null,
    customer_email: payload.customer_email || null,
    customer_birthdate: payload.customer_birthdate || null,
    address: null,
    payment_method: payload.payment_method || 'pix',
    payment_status: 'pending',
    subtotal_cents: totals.subtotal,
    delivery_fee_cents: totals.deliveryFee,
    discount_cents: totals.discount,
    total_cents: totals.total,
    estimated_minutes: estimated,
    prep_sla_minutes: demo.settings.prep_sla_minutes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, items);
  demo.orders.unshift(order);
  const table = demo.tables.find((entry) => entry.id === order.table_id);
  if (table) table.status = 'open';
  broadcast('order:created', order);
  return order;
}

async function updateStatus(id, status) {
  if (pool) {
    const preparingAt = status === 'preparing' ? ', preparing_at = coalesce(preparing_at, now())' : '';
    const readyAt = status === 'ready' ? ', ready_at = now()' : '';
    const outForDeliveryAt = status === 'out_for_delivery' ? ', out_for_delivery_at = now()' : '';
    const deliveredAt = ['delivered', 'served'].includes(status) ? ', delivered_at = now()' : '';
    await dbQuery(`update orders set status = $1, updated_at = now() ${preparingAt} ${readyAt} ${outForDeliveryAt} ${deliveredAt} where id = $2`, [status, id]);
    if (['preparing', 'ready'].includes(status)) {
      await dbQuery('update order_items set status = $1 where order_id = $2 and status <> $3', [status, id, 'cancelled']);
    }
    const order = (await listOrders()).find((entry) => entry.id === id);
    broadcast('order:status', order);
    return order;
  }
  const order = demo.orders.find((entry) => entry.id === id);
  if (!order) return null;
  order.status = status;
  order.updated_at = new Date().toISOString();
  if (status === 'preparing' && !order.preparing_at) order.preparing_at = new Date().toISOString();
  if (status === 'ready') order.ready_at = new Date().toISOString();
  if (status === 'out_for_delivery') order.out_for_delivery_at = new Date().toISOString();
  if (['served', 'delivered'].includes(status)) order.delivered_at = new Date().toISOString();
  order.items = order.items.map((item) => ({ ...item, status: ['preparing', 'ready'].includes(status) ? status : item.status }));
  broadcast('order:status', order);
  return order;
}

async function dashboard() {
  const orders = (await listOrders()).filter((order) => order.status !== 'cancelled');
  const revenue = orders.reduce((sum, order) => sum + money(order.total_cents), 0);
  const now = new Date().toISOString();
  const diffMinutes = (from, to) => {
    if (!from || !to) return null;
    return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  };
  const avg = (values) => {
    const valid = values.filter((value) => Number.isFinite(value));
    return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
  };
  const itemMap = new Map();
  orders.flatMap((order) => order.items || []).forEach((item) => {
    const previous = itemMap.get(item.name_snapshot) || { name: item.name_snapshot, quantity: 0, revenue_cents: 0 };
    previous.quantity += Number(item.quantity);
    previous.revenue_cents += Number(item.quantity) * money(item.unit_price_cents);
    itemMap.set(item.name_snapshot, previous);
  });
  const ranking = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);
  const overdue = orders.filter((order) => {
    const minutes = (Date.now() - new Date(order.created_at).getTime()) / 60000;
    return !['ready', 'served', 'delivered'].includes(order.status) && minutes > money(order.prep_sla_minutes);
  }).length;
  return {
    revenue_cents: revenue,
    average_ticket_cents: orders.length ? Math.round(revenue / orders.length) : 0,
    orders_count: orders.length,
    local_count: orders.filter((order) => order.order_type === 'local').length,
    delivery_count: orders.filter((order) => order.order_type === 'delivery').length,
    overdue_count: overdue,
    avg_requested_minutes: avg(orders.map((order) => diffMinutes(order.created_at, order.preparing_at || order.ready_at || now))),
    avg_prep_minutes: avg(orders.map((order) => diffMinutes(order.preparing_at || order.created_at, order.ready_at || (order.status === 'preparing' ? now : null)))),
    avg_delivery_minutes: avg(orders.filter((order) => order.order_type === 'delivery').map((order) => diffMinutes(order.out_for_delivery_at || order.ready_at, order.delivered_at || (['ready', 'out_for_delivery'].includes(order.status) ? now : null)))),
    top_products: ranking.slice(0, 5),
    low_products: ranking.slice(-5).reverse(),
    alerts: [
      overdue ? `${overdue} pedido(s) acima do SLA` : 'SLA de preparo dentro do previsto',
      ranking[0] ? `Sugestao: destaque ${ranking[0].name} nas promocoes` : 'Ainda sem vendas para sugestoes',
      demo.menuItems.some((item) => Number(item.stock_quantity) <= Number(item.low_stock_alert)) ? 'Existem itens com estoque baixo' : 'Estoque sem alertas criticos'
    ]
  };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '');
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = verifyJwt(token);

  try {
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const result = await login(await parseBody(req));
      return json(res, result.status, result.data);
    }
    if (req.method === 'GET' && url.pathname === '/api/bootstrap') return json(res, 200, await bootstrap());
    if (req.method === 'GET' && url.pathname === '/api/orders') return json(res, 200, await listOrders());
    if (req.method === 'POST' && url.pathname === '/api/orders') return json(res, 201, await createOrder(await parseBody(req), user));
    if (req.method === 'GET' && url.pathname === '/api/chats') return json(res, 200, listChats());
    if (req.method === 'POST' && url.pathname === '/api/chats') return json(res, 201, createChat(await parseBody(req)));
    if (req.method === 'POST' && /^\/api\/chats\/[^/]+\/messages$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const chat = addChatMessage(id, await parseBody(req));
      return chat ? json(res, 200, chat) : json(res, 404, { error: 'Conversa não encontrada' });
    }
    if (req.method === 'PATCH' && /^\/api\/orders\/[^/]+\/status$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const order = await updateStatus(id, (await parseBody(req)).status);
      return order ? json(res, 200, order) : json(res, 404, { error: 'Pedido não encontrado' });
    }
    if (req.method === 'PATCH' && /^\/api\/orders\/[^/]+\/rating$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const order = demo.orders.find((entry) => entry.id === id);
      if (!order) return json(res, 404, { error: 'Pedido não encontrado' });
      Object.assign(order, await parseBody(req));
      return json(res, 200, order);
    }
    if (req.method === 'PUT' && url.pathname === '/api/settings') {
      Object.assign(demo.settings, await parseBody(req));
      if (pool) {
        await dbQuery(
          `update system_settings set delivery_enabled=$1, online_orders_enabled=$2, delivery_open_time=$3, delivery_close_time=$4,
           delivery_radius_km=$5, delivery_fee_cents=$6, avg_prep_minutes=$7, prep_sla_minutes=$8, auto_print_enabled=$9,
           pix_enabled=$10, card_enabled=$11, pix_key=$12, payment_gateway=$13, payment_gateway_enabled=$14,
           payment_gateway_public_key=$15, payment_gateway_secret_key=$16, updated_at=now()
           where branch_id=$17`,
          [
            demo.settings.delivery_enabled,
            demo.settings.online_orders_enabled,
            demo.settings.delivery_open_time,
            demo.settings.delivery_close_time,
            demo.settings.delivery_radius_km,
            demo.settings.delivery_fee_cents,
            demo.settings.avg_prep_minutes,
            demo.settings.prep_sla_minutes,
            demo.settings.auto_print_enabled,
            demo.settings.pix_enabled,
            demo.settings.card_enabled,
            demo.settings.pix_key,
            demo.settings.payment_gateway,
            demo.settings.payment_gateway_enabled,
            demo.settings.payment_gateway_public_key,
            demo.settings.payment_gateway_secret_key,
            BRANCH_ID
          ]
        );
      }
      broadcast('settings:updated', demo.settings);
      return json(res, 200, demo.settings);
    }
    if (req.method === 'POST' && url.pathname === '/api/menu-items') {
      const body = await parseBody(req);
      const category = demo.categories.find((item) => item.id === body.category_id) || demo.categories[0];
      const item = {
        id: uid(),
        category_id: category.id,
        category_name: category.name,
        sector: category.kitchen_sector,
        name: body.name || 'Novo item',
        description: body.description || '',
        price_cents: money(body.price_cents),
        promotion_price_cents: money(body.promotion_price_cents),
        image_url: body.image_url || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
        available: body.available !== false,
        prep_time_minutes: Number(body.prep_time_minutes || 12),
        stock_quantity: Number(body.stock_quantity || 0),
        low_stock_alert: Number(body.low_stock_alert || 5)
      };
      demo.menuItems.push(item);
      broadcast('menu:updated', item);
      return json(res, 201, item);
    }
    if (req.method === 'PUT' && /^\/api\/menu-items\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const body = await parseBody(req);
      const item = demo.menuItems.find((entry) => entry.id === id);
      if (!item) return json(res, 404, { error: 'Item não encontrado' });
      const category = demo.categories.find((entry) => entry.id === body.category_id) || demo.categories.find((entry) => entry.id === item.category_id);
      Object.assign(item, {
        category_id: category.id,
        category_name: category.name,
        sector: category.kitchen_sector,
        name: body.name || item.name,
        description: body.description || '',
        price_cents: money(body.price_cents),
        promotion_price_cents: money(body.promotion_price_cents),
        image_url: body.image_url || item.image_url,
        available: body.available !== false,
        prep_time_minutes: Number(body.prep_time_minutes || item.prep_time_minutes),
        stock_quantity: Number(body.stock_quantity || 0)
      });
      broadcast('menu:updated', item);
      return json(res, 200, item);
    }
    if (req.method === 'DELETE' && /^\/api\/menu-items\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      demo.menuItems = demo.menuItems.filter((item) => item.id !== id);
      broadcast('menu:updated', { id });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/tables') {
      const body = await parseBody(req);
      const table = {
        id: uid(),
        code: String(body.code || '').padStart(2, '0'),
        seats: Number(body.seats || 4),
        x: Number(body.x || 1),
        y: Number(body.y || 1),
        status: 'free'
      };
      demo.tables.push(table);
      broadcast('tables:updated', table);
      return json(res, 201, table);
    }
    if (req.method === 'PUT' && /^\/api\/tables\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const body = await parseBody(req);
      const table = demo.tables.find((entry) => entry.id === id);
      if (!table) return json(res, 404, { error: 'Mesa não encontrada' });
      Object.assign(table, {
        code: String(body.code || table.code).padStart(2, '0'),
        seats: Number(body.seats || table.seats),
        x: Number(body.x || table.x),
        y: Number(body.y || table.y)
      });
      broadcast('tables:updated', table);
      return json(res, 200, table);
    }
    if (req.method === 'DELETE' && /^\/api\/tables\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const hasOpenOrder = demo.orders.some((order) => order.table_id === id && !['served', 'delivered', 'cancelled'].includes(order.status));
      if (hasOpenOrder) return json(res, 409, { error: 'Mesa com pedido aberto nao pode ser removida' });
      demo.tables = demo.tables.filter((table) => table.id !== id);
      broadcast('tables:updated', { id });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') return json(res, 200, await dashboard());
    return serveStatic(url.pathname, res);
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Acesso negado' });
  const target = fs.existsSync(filePath) ? filePath : path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(target);
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  send(res, 200, types[ext] || 'application/octet-stream', fs.readFileSync(target));
}

const server = http.createServer(route);

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade !== 'websocket') return socket.destroy();
  const accept = crypto
    .createHash('sha1')
    .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));
  sockets.add(socket);
  socket.write(wsFrame(JSON.stringify({ type: 'connected', payload: { message: 'Tempo real ativo' }, at: new Date().toISOString() })));
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => sockets.delete(socket));
});

server.listen(PORT, () => {
  console.log(`Madalena Gastrobar | Bar Digital rodando em http://localhost:${PORT}`);
  console.log(pool ? 'Banco: PostgreSQL' : 'Banco: modo demo em memória. Configure DATABASE_URL para PostgreSQL gratuito.');
});
