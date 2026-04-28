const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  selectedTable: null,
  waiterCart: new Map(),
  customerCart: new Map(),
  orderType: 'local',
  paymentMethod: 'pix',
  sector: 'all',
  search: '',
  lastCustomerOrder: JSON.parse(localStorage.getItem('lastCustomerOrder') || 'null'),
  activeChatId: localStorage.getItem('activeChatId') || '',
  selectedChatId: '',
  data: { settings: {}, tables: [], categories: [], menuItems: [], orders: [], chats: [] }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const brl = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
const minLabel = (minutes) => `${Number(minutes || 0)} min`;
const minutesSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / 60000);
const effectivePrice = (item) => {
  const promo = Number(item.promotion_price_cents || 0);
  const price = Number(item.price_cents || 0);
  return promo > 0 && promo < price ? promo : price;
};
const isBirthdayToday = (dateValue) => {
  if (!dateValue) return false;
  const [, month, day] = String(dateValue).split('-').map(Number);
  const today = new Date();
  return month === today.getMonth() + 1 && day === today.getDate();
};
const birthdayDiscountPercent = () => Number(state.data.settings.birthday_discount_percent || 10);
const priceHtml = (item) => {
  const promo = Number(item.promotion_price_cents || 0);
  const price = Number(item.price_cents || 0);
  if (promo > 0 && promo < price) {
    return `<span class="price-row"><span class="old-price">${brl(price)}</span><span class="promo-price">${brl(promo)}</span></span><span class="promo-tag">Promoção</span>`;
  }
  return `<span class="price">${brl(price)}</span>`;
};

const statusLabels = {
  sent: 'Enviado',
  received: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  served: 'Entregue',
  out_for_delivery: 'Disponível para retirada',
  delivered: 'Entregue',
  cancelled: 'Cancelado'
};

const paymentLabels = {
  pix: 'PIX',
  card: 'Cartão',
  cash: 'Dinheiro',
  account: 'Conta'
};

function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error((await response.json()).error || 'Erro na requisição');
  return response.json();
}

async function login(email, password) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '').trim();
  const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  state.token = result.token;
  state.user = result.user;
  localStorage.setItem('token', state.token);
  localStorage.setItem('user', JSON.stringify(state.user));
  renderAuth();
  toast(`Login ativo: ${state.user.name}`);
  await load();
}

function renderAuth() {
  const logged = Boolean(state.token && state.user);
  $('#loginForm').classList.toggle('hidden', logged);
  $('#sessionBox').classList.toggle('hidden', !logged);
  if (logged) $('#sessionUser').textContent = `${state.user.name} · ${state.user.role}`;
}

async function load() {
  state.data = await api('/api/bootstrap');
  state.data.chats = await api('/api/chats').catch(() => []);
  $('#modeBadge').textContent = state.data.mode || 'demo';
  renderAll();
  loadDashboard();
}

async function loadDashboard() {
  const dashboard = await api('/api/dashboard');
  $('#kpiRevenue').textContent = brl(dashboard.revenue_cents);
  $('#kpiTicket').textContent = brl(dashboard.average_ticket_cents);
  $('#kpiOrders').textContent = dashboard.orders_count;
  $('#kpiOverdue').textContent = dashboard.overdue_count;
  $('#kpiRequestedTime').textContent = minLabel(dashboard.avg_requested_minutes);
  $('#kpiPrepTime').textContent = minLabel(dashboard.avg_prep_minutes);
  $('#kpiDeliveryTime').textContent = minLabel(dashboard.avg_delivery_minutes);
  $('#alerts').innerHTML = dashboard.alerts.map((item) => `<div class="alert">${item}</div>`).join('');
  $('#ranking').innerHTML = (dashboard.top_products || []).map((item, index) => `
    <div class="ranking-row"><span>${index + 1}. ${item.name}</span><strong>${item.quantity} un · ${brl(item.revenue_cents)}</strong></div>
  `).join('') || '<p class="hint">Sem vendas registradas.</p>';
}

function renderAll() {
  renderTables();
  renderMenus();
  renderOrders();
  renderSettings();
  renderRetiradaInfo();
  renderAdminEditors();
  renderChats();
  renderCustomerChat();
  applyOperationalSettings();
}

function renderTables() {
  $('#tableMap').innerHTML = state.data.tables.map((table) => `
    <button class="table-card ${table.status} ${state.selectedTable?.id === table.id ? 'selected' : ''}" data-table="${table.id}">
      <strong>Mesa ${table.code}</strong>
      <span>${table.seats} lugares · ${table.status}</span>
    </button>
  `).join('');
  $('#customerTable').innerHTML = state.data.tables.map((table) => `<option value="${table.id}">Mesa ${table.code}</option>`).join('');
  $$('.table-card').forEach((button) => button.addEventListener('click', () => {
    state.selectedTable = state.data.tables.find((table) => table.id === button.dataset.table);
    $('#selectedTable').textContent = `mesa ${state.selectedTable.code}`;
    renderTables();
  }));
}

function applyOperationalSettings() {
  const enabled = state.data.settings?.delivery_enabled !== false;
  $$('[data-order-type="delivery"]').forEach((button) => button.classList.toggle('hidden', !enabled));
  $$('[data-view="delivery"]').forEach((button) => button.classList.toggle('hidden', !enabled));
  if (!enabled && $('#delivery')?.classList.contains('active')) activateView('customer');
  if (!enabled && state.orderType === 'delivery') {
    state.orderType = 'local';
    $$('[data-order-type]').forEach((item) => item.classList.toggle('active', item.dataset.orderType === 'local'));
    $('#addressFields').classList.add('hidden');
    $('#tableSelectWrap').classList.remove('hidden');
    renderCart();
  }
}

function menuButton(item, area) {
  const selected = (area === 'waiter' ? state.waiterCart : state.customerCart).has(item.id);
  return `
    <button class="menu-item ${selected ? 'selected' : ''}" data-area="${area}" data-item="${item.id}">
      <img src="${item.image_url}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        <p>${item.description || item.category_name}</p>
        ${priceHtml(item)}
      </div>
    </button>
  `;
}

function renderMenus() {
  const categoryBlocks = (area, compact = false) => state.data.categories.map((category) => {
    const items = state.data.menuItems.filter((item) => item.category_id === category.id);
    if (!items.length) return '';
    return `
    <div class="category-block">
      <h3>${category.name}</h3>
      <div class="menu-grid ${compact ? 'compact' : ''}">${items.map((item) => menuButton(item, area)).join('')}</div>
    </div>
  `;
  }).join('');
  $('#waiterMenu').innerHTML = categoryBlocks('waiter', true);
  $('#customerMenu').innerHTML = categoryBlocks('customer');
  $$('[data-item]').forEach((button) => button.addEventListener('click', () => {
    const cart = button.dataset.area === 'waiter' ? state.waiterCart : state.customerCart;
    const item = state.data.menuItems.find((entry) => entry.id === button.dataset.item);
    if (cart.has(item.id)) {
      const current = cart.get(item.id);
      cart.set(item.id, { ...current, quantity: current.quantity + 1 });
    } else {
      cart.set(item.id, { ...item, quantity: 1, notes: '' });
    }
    renderMenus();
    renderWaiterCart();
    renderCart();
  }));
  renderCart();
  renderWaiterCart();
}

function renderWaiterCart() {
  const lines = Array.from(state.waiterCart.values());
  $('#waiterCartItems').innerHTML = lines.map((item) => `
    <div class="item-note">
      <strong>${item.quantity}x ${item.name}</strong>
      <input data-waiter-note="${item.id}" placeholder="Observação deste item" value="${item.notes || ''}" />
    </div>
  `).join('') || '<p class="hint">Selecione itens e informe observações por item.</p>';
  $$('[data-waiter-note]').forEach((input) => input.addEventListener('input', () => {
    const item = state.waiterCart.get(input.dataset.waiterNote);
    if (item) state.waiterCart.set(item.id, { ...item, notes: input.value });
  }));
}

function renderCart() {
  const lines = Array.from(state.customerCart.values());
  $('#cartItems').innerHTML = lines.map((item) => `
    <div class="cart-line with-note">
      <span>${item.quantity}x ${item.name}</span>
      <strong>${brl(item.quantity * effectivePrice(item))}</strong>
      <input data-customer-note="${item.id}" placeholder="Observação deste item" value="${item.notes || ''}" />
    </div>
  `).join('') || '<p class="hint">Seu carrinho está vazio.</p>';
  $$('[data-customer-note]').forEach((input) => input.addEventListener('input', () => {
    const item = state.customerCart.get(input.dataset.customerNote);
    if (item) state.customerCart.set(item.id, { ...item, notes: input.value });
  }));
  const subtotal = lines.reduce((sum, item) => sum + item.quantity * effectivePrice(item), 0);
  const birthdayDiscount = isBirthdayToday($('#customerBirthdate')?.value) ? Math.round(subtotal * birthdayDiscountPercent() / 100) : 0;
  $('#birthdayDiscount').classList.toggle('hidden', birthdayDiscount <= 0);
  $('#birthdayDiscount').textContent = birthdayDiscount > 0 ? `Desconto de aniversariante: -${brl(birthdayDiscount)} (${birthdayDiscountPercent()}%)` : '';
  const total = subtotal - birthdayDiscount;
  $('#cartTotal').textContent = brl(total);
}

function statusClass(order) {
  const late = !['ready', 'served', 'delivered'].includes(order.status) && minutesSince(order.created_at) > Number(order.prep_sla_minutes || 18);
  return late ? 'late' : order.status;
}

function orderCard(order, context = 'default') {
  const cls = statusClass(order);
  const items = (order.items || []).map((item) => `<li>${item.quantity}x ${item.name_snapshot}${item.notes ? ` - ${item.notes}` : ''}</li>`).join('');
  const actions = context === 'kitchen'
    ? `<button data-status="preparing" data-order="${order.id}">Em preparo</button><button data-status="ready" data-order="${order.id}">Pronto</button>`
    : context === 'delivery'
      ? `<button data-status="preparing" data-order="${order.id}">Em preparo</button><button data-status="out_for_delivery" data-order="${order.id}">Pronto para retirada</button><button data-status="delivered" data-order="${order.id}">Retirado</button><button data-route="${order.id}">Ver pedido</button><button class="danger" data-status="cancelled" data-order="${order.id}">Cancelar</button>`
      : `<button data-status="served" data-order="${order.id}">Entregue</button><button class="danger" data-status="cancelled" data-order="${order.id}">Cancelar</button>`;
  return `
    <article class="order-card ${cls}">
      <div class="order-head">
        <strong>#${String(order.id).slice(-6)} - ${order.order_type === 'delivery' ? 'Retirada' : `Mesa ${order.table_code || '--'}`}</strong>
        <span class="status-pill ${cls}">${statusLabels[order.status] || order.status}</span>
      </div>
      <div class="order-meta">${minutesSince(order.created_at)} min - ${brl(order.total_cents)} - ${paymentLabels[order.payment_method] || 'Pagamento'} - ${order.waiter_name || order.customer_name || 'Cliente'}</div>
      <ul class="items">${items}</ul>
      <div class="action-row">${actions}</div>
    </article>
  `;
}

function renderOrders() {
  const orders = state.data.orders || [];
  $('#waiterOrders').innerHTML = orders.filter((order) => order.order_type === 'local').map((order) => orderCard(order, 'waiter')).join('') || '<p class="hint">Sem pedidos locais.</p>';
  const kdsOrders = orders
    .filter((order) => !['served', 'delivered', 'cancelled'].includes(order.status))
    .filter((order) => state.sector === 'all' || (order.items || []).some((item) => item.sector === state.sector));
  const waiting = kdsOrders.filter((order) => ['sent', 'received'].includes(order.status) && statusClass(order) !== 'late');
  const preparing = kdsOrders.filter((order) => order.status === 'preparing' || statusClass(order) === 'late');
  const ready = kdsOrders.filter((order) => ['ready', 'out_for_delivery'].includes(order.status));
  $('#kdsBoard').innerHTML = `
    <div class="kds-columns">
      <section class="kds-column"><h2>Aguardando</h2>${waiting.map((order) => orderCard(order, 'kitchen')).join('') || '<p class="hint">Sem pedidos aguardando.</p>'}</section>
      <section class="kds-column"><h2>Em preparo</h2>${preparing.map((order) => orderCard(order, 'kitchen')).join('') || '<p class="hint">Sem pedidos em preparo.</p>'}</section>
      <section class="kds-column"><h2>Prontos</h2>${ready.map((order) => orderCard(order, 'kitchen')).join('') || '<p class="hint">Sem pedidos prontos.</p>'}</section>
    </div>
  `;
  $('#deliveryOrders').innerHTML = orders.filter((order) => order.order_type === 'delivery').map((order) => orderCard(order, 'delivery')).join('') || '<p class="hint">Sem pedidos para retirada no momento.</p>';
  const selectedDate = $('#orderDateFilter')?.value;
  const filtered = orders
    .filter((order) => !selectedDate || String(order.created_at).slice(0, 10) === selectedDate)
    .filter((order) => JSON.stringify(order).toLowerCase().includes(state.search.toLowerCase()));
  $('#historyOrders').innerHTML = filtered.map((order) => orderCard(order, 'history')).join('') || '<p class="hint">Nenhum pedido encontrado.</p>';
  $$('[data-status]').forEach((button) => button.addEventListener('click', async () => updateStatus(button.dataset.order, button.dataset.status)));
  $$('[data-route]').forEach((button) => button.addEventListener('click', () => openRoute(button.dataset.route)));
}

function routeAddress(order) {
  return order ? 'Madalena Gastrobar' : '';
}

function openRoute(orderId) {
  const order = (state.data.orders || []).find((entry) => entry.id === orderId);
  if (!order || order.order_type !== 'delivery') return toast('Selecione um pedido de retirada.');
  $('#routeInfo').innerHTML = `Pedido <strong>#${String(order.id).slice(-6)}</strong> para retirada no Madalena Gastrobar.<br>Cliente: ${order.customer_name || 'cliente'} - ${statusLabels[order.status] || order.status}`;
}

function latestRetiradaOrder() {
  return (state.data.orders || []).find((order) => order.order_type === 'delivery' && !['delivered', 'cancelled'].includes(order.status));
}

function renderSettings() {
  const s = state.data.settings || {};
  $('#deliveryEnabled').checked = Boolean(s.delivery_enabled);
  $('#onlineEnabled').checked = Boolean(s.online_orders_enabled);
  $('#openTime').value = String(s.delivery_open_time || '18:00').slice(0, 5);
  $('#closeTime').value = String(s.delivery_close_time || '23:30').slice(0, 5);
  $('#radius').value = s.delivery_radius_km || 7;
  $('#fee').value = s.delivery_fee_cents || 0;
  $('#sla').value = s.prep_sla_minutes || 18;
  $('#autoPrint').checked = Boolean(s.auto_print_enabled);
  $('#pixEnabled').checked = s.pix_enabled !== false;
  $('#cardEnabled').checked = s.card_enabled !== false;
  $('#pixKey').value = s.pix_key || '';
  $('#paymentGateway').value = s.payment_gateway || 'mercadopago';
  $('#gatewayEnabled').checked = Boolean(s.payment_gateway_enabled);
  $('#gatewayPublicKey').value = s.payment_gateway_public_key || '';
  $('#gatewaySecretKey').value = s.payment_gateway_secret_key || '';
}

function renderAdminEditors() {
  $('#menuCategory').innerHTML = state.data.categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('');
  $('#menuAdminList').innerHTML = state.data.categories.map((category) => {
    const items = state.data.menuItems.filter((item) => item.category_id === category.id);
    if (!items.length) return '';
    return `
      <div class="admin-category">
        <h3>${category.name}</h3>
        <div class="admin-list">
          ${items.map((item) => `
    <div class="admin-row">
      <div>
        <strong>${item.name}</strong>
        <p>${item.category_name} · ${brl(item.price_cents)}${item.promotion_price_cents ? ` por ${brl(item.promotion_price_cents)}` : ''} · ${item.prep_time_minutes} min · ${item.available ? 'disponível' : 'indisponível'}</p>
      </div>
      <div class="admin-row-actions">
        <button data-edit-menu="${item.id}">Editar</button>
        <button class="danger" data-delete-menu="${item.id}">Remover</button>
      </div>
    </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('') || '<p class="hint">Nenhum item cadastrado.</p>';
  $('#tablesAdminList').innerHTML = state.data.tables.map((table) => `
    <div class="admin-row">
      <div>
        <strong>Mesa ${table.code}</strong>
        <p>${table.seats} lugares · posição ${table.x}/${table.y} · ${table.status}</p>
      </div>
      <div class="admin-row-actions">
        <button data-edit-table="${table.id}">Editar</button>
        <button class="danger" data-delete-table="${table.id}">Remover</button>
      </div>
    </div>
  `).join('') || '<p class="hint">Nenhuma mesa cadastrada.</p>';
  $$('[data-edit-menu]').forEach((button) => button.addEventListener('click', () => fillMenuForm(button.dataset.editMenu)));
  $$('[data-delete-menu]').forEach((button) => button.addEventListener('click', () => deleteMenuItem(button.dataset.deleteMenu)));
  $$('[data-edit-table]').forEach((button) => button.addEventListener('click', () => fillTableForm(button.dataset.editTable)));
  $$('[data-delete-table]').forEach((button) => button.addEventListener('click', () => deleteTable(button.dataset.deleteTable)));
}

function renderRetiradaInfo() {
  $('#deliveryFee').textContent = 'Sem taxa';
  $('#deliveryAvg').textContent = `${state.data.settings.avg_prep_minutes || 25} min`;
}

function renderTracking(order) {
  if (!order) return;
  const steps = order.order_type === 'delivery'
    ? ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered']
    : ['sent', 'preparing', 'ready', 'served'];
  const current = steps.indexOf(order.status);
  $('#tracking').innerHTML = steps.map((step, index) => `
    <div class="track-step ${index <= current ? 'done' : ''}"><span class="dot"></span>${statusLabels[step]}</div>
  `).join('');
}

function chatMessagesHtml(chat) {
  if (!chat) return '';
  return (chat.messages || []).map((message) => `
    <div class="chat-message ${message.author}">
      <small>${message.author_name || message.author} · ${new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
      ${message.text}
    </div>
  `).join('');
}

function renderCustomerChat() {
  const chat = (state.data.chats || []).find((entry) => entry.id === state.activeChatId);
  $('#customerChatThread').innerHTML = chat ? chatMessagesHtml(chat) : '<p class="hint">Abra um chat caso precise falar com o atendimento.</p>';
}

function renderChats() {
  const chats = state.data.chats || [];
  const openCount = chats.filter((chat) => chat.status !== 'resolved').length;
  $('#chatCount').textContent = `${openCount} abertas`;
  $('#chatList').innerHTML = chats.map((chat) => `
    <div class="admin-row ${chat.id === state.selectedChatId ? 'chat-row-active' : ''}">
      <div>
        <strong>${chat.customer_name} · ${chat.reason}</strong>
        <p>${chat.order_label} · ${chat.status} · ${chat.messages?.length || 0} mensagem(ns)</p>
      </div>
      <div class="admin-row-actions">
        <button data-select-chat="${chat.id}">Abrir</button>
      </div>
    </div>
  `).join('') || '<p class="hint">Nenhuma conversa aberta.</p>';
  $$('[data-select-chat]').forEach((button) => button.addEventListener('click', () => selectChat(button.dataset.selectChat)));
  const selected = chats.find((chat) => chat.id === state.selectedChatId);
  $('#chatSelected').innerHTML = selected ? `<strong>${selected.customer_name}</strong><br>${selected.order_label} · ${selected.reason}` : 'Selecione uma conversa para responder.';
  $('#backofficeChatThread').innerHTML = selected ? chatMessagesHtml(selected) : '';
}

async function createOrder(source) {
  const cart = source === 'waiter' ? state.waiterCart : state.customerCart;
  if (!cart.size) return toast('Adicione itens ao pedido.');
  if (source === 'waiter' && !state.selectedTable) return toast('Selecione uma mesa.');
  if (source !== 'waiter') {
    const name = $('#customerName').value.trim();
    const phone = $('#customerPhone').value.trim();
    const email = $('#customerEmail').value.trim();
    if (name.split(/\s+/).filter(Boolean).length < 2) return toast('Informe o nome completo do cliente.');
    if (phone.replace(/\D/g, '').length < 10) return toast('Informe um celular válido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Informe um e-mail válido.');
    if (!state.paymentMethod) return toast('Escolha PIX ou cartão.');
  }
  const payload = {
    source,
    order_type: source === 'waiter' ? 'local' : state.orderType,
    table_id: source === 'waiter' ? state.selectedTable.id : $('#customerTable').value,
    customer_name: $('#customerName').value,
    customer_phone: $('#customerPhone').value,
    customer_email: $('#customerEmail').value,
    customer_birthdate: $('#customerBirthdate').value,
    payment_method: source === 'waiter' ? 'account' : state.paymentMethod,
    address: state.orderType === 'delivery' ? null : { street: $('#street').value, number: $('#number').value },
    items: Array.from(cart.values()).map((item) => ({
      menu_item_id: item.id,
      quantity: item.quantity,
      notes: source === 'waiter' ? [item.notes, $('#waiterNotes').value.trim()].filter(Boolean).join(' | ') : item.notes
    }))
  };
  const order = await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
  cart.clear();
  renderWaiterCart();
  renderCart();
  $('#waiterNotes').value = '';
  if (source !== 'waiter') {
    state.lastCustomerOrder = order;
    localStorage.setItem('lastCustomerOrder', JSON.stringify(order));
  }
  toast('Pedido enviado em tempo real.');
  await load();
  renderTracking(order);
}

async function sendSupportMessage() {
  const order = state.lastCustomerOrder;
  if (!order) return toast('Finalize um pedido antes de abrir o chat.');
  const message = $('#supportMessage').value.trim();
  if (!message) return toast('Digite uma mensagem para o atendimento.');
  const existing = (state.data.chats || []).find((chat) => chat.id === state.activeChatId);
  const chat = existing
    ? await api(`/api/chats/${existing.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          author: 'customer',
          author_name: existing.customer_name || 'Cliente',
          message,
          status: 'open'
        })
      })
    : await api('/api/chats', {
        method: 'POST',
        body: JSON.stringify({
          order_id: order.id,
          customer_name: order.customer_name || $('#customerName').value,
          customer_phone: order.customer_phone || $('#customerPhone').value,
          customer_email: order.customer_email || $('#customerEmail').value,
          reason: $('#supportReason').value,
          message
        })
      });
  state.activeChatId = chat.id;
  localStorage.setItem('activeChatId', chat.id);
  $('#supportMessage').value = '';
  toast('Chat aberto com o atendimento.');
  await load();
}

function selectChat(id) {
  state.selectedChatId = id;
  renderChats();
}

async function sendBackofficeReply(status) {
  const chatId = state.selectedChatId;
  if (!chatId) return toast('Selecione uma conversa.');
  const message = $('#backofficeReply').value.trim();
  if (!message && status !== 'resolved') return toast('Digite uma resposta.');
  const chat = await api(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      author: 'backoffice',
      author_name: 'Backoffice',
      message: message || 'Atendimento encerrado. Obrigado pelo contato.',
      status: status || 'open'
    })
  });
  state.selectedChatId = chat.id;
  $('#backofficeReply').value = '';
  toast(status === 'resolved' ? 'Conversa marcada como resolvida.' : 'Resposta enviada ao cliente.');
  await load();
}

async function updateStatus(id, status) {
  const order = await api(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  toast(status === 'ready' ? 'Pedido pronto: garçom/retirada notificado.' : `Status: ${statusLabels[status]}`);
  await load();
  renderTracking(order);
}

async function saveSettings() {
  await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({
      delivery_enabled: $('#deliveryEnabled').checked,
      online_orders_enabled: $('#onlineEnabled').checked,
      delivery_open_time: $('#openTime').value,
      delivery_close_time: $('#closeTime').value,
      delivery_radius_km: Number($('#radius').value),
      delivery_fee_cents: Number($('#fee').value),
      avg_prep_minutes: Number($('#sla').value) + 7,
      prep_sla_minutes: Number($('#sla').value),
      auto_print_enabled: $('#autoPrint').checked,
      pix_enabled: $('#pixEnabled').checked,
      card_enabled: $('#cardEnabled').checked,
      pix_key: $('#pixKey').value,
      payment_gateway: $('#paymentGateway').value,
      payment_gateway_enabled: $('#gatewayEnabled').checked,
      payment_gateway_public_key: $('#gatewayPublicKey').value,
      payment_gateway_secret_key: $('#gatewaySecretKey').value
    })
  });
  toast('Configurações salvas.');
  await load();
}

function clearMenuForm() {
  $('#editingMenuId').value = '';
  $('#menuName').value = '';
  $('#menuPrice').value = '';
  $('#menuPromoPrice').value = '';
  $('#menuPrep').value = '';
  $('#menuImage').value = '';
  $('#menuStock').value = '';
  $('#menuDescription').value = '';
  $('#menuAvailable').checked = true;
}

function fillMenuForm(id) {
  const item = state.data.menuItems.find((entry) => entry.id === id);
  if (!item) return;
  $('#editingMenuId').value = item.id;
  $('#menuName').value = item.name || '';
  $('#menuCategory').value = item.category_id;
  $('#menuPrice').value = item.price_cents || 0;
  $('#menuPromoPrice').value = item.promotion_price_cents || '';
  $('#menuPrep').value = item.prep_time_minutes || 12;
  $('#menuImage').value = item.image_url || '';
  $('#menuStock').value = item.stock_quantity || 0;
  $('#menuDescription').value = item.description || '';
  $('#menuAvailable').checked = Boolean(item.available);
}

async function saveMenuItem() {
  const id = $('#editingMenuId').value;
  const payload = {
    name: $('#menuName').value,
    category_id: $('#menuCategory').value,
    price_cents: Number($('#menuPrice').value),
    promotion_price_cents: Number($('#menuPromoPrice').value || 0),
    prep_time_minutes: Number($('#menuPrep').value || 12),
    image_url: $('#menuImage').value,
    stock_quantity: Number($('#menuStock').value || 0),
    description: $('#menuDescription').value,
    available: $('#menuAvailable').checked
  };
  await api(id ? `/api/menu-items/${id}` : '/api/menu-items', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });
  clearMenuForm();
  toast('Cardápio atualizado.');
  await load();
}

async function deleteMenuItem(id) {
  await api(`/api/menu-items/${id}`, { method: 'DELETE' });
  toast('Item removido do cardápio.');
  await load();
}

function clearTableForm() {
  $('#editingTableId').value = '';
  $('#tableCode').value = '';
  $('#tableSeats').value = 4;
  $('#tableX').value = 1;
  $('#tableY').value = 1;
}

function fillTableForm(id) {
  const table = state.data.tables.find((entry) => entry.id === id);
  if (!table) return;
  $('#editingTableId').value = table.id;
  $('#tableCode').value = table.code;
  $('#tableSeats').value = table.seats;
  $('#tableX').value = table.x;
  $('#tableY').value = table.y;
}

async function saveTable() {
  const id = $('#editingTableId').value;
  const payload = {
    code: $('#tableCode').value,
    seats: Number($('#tableSeats').value || 4),
    x: Number($('#tableX').value || 1),
    y: Number($('#tableY').value || 1)
  };
  await api(id ? `/api/tables/${id}` : '/api/tables', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });
  clearTableForm();
  toast('Mapa de mesas atualizado.');
  await load();
}

async function deleteTable(id) {
  try {
    await api(`/api/tables/${id}`, { method: 'DELETE' });
    toast('Mesa removida.');
    await load();
  } catch (error) {
    toast(error.message);
  }
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function loadMenuImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    toast('Use uma imagem PNG ou JPG.');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    $('#menuImage').value = reader.result;
    toast('Imagem carregada no item do cardápio.');
  });
  reader.readAsDataURL(file);
}

function activateView(viewName) {
  const target = $(`#${viewName}`);
  const button = $(`.nav button[data-view="${viewName}"]`);
  if (!target || !button || button.classList.contains('hidden')) return;
  $$('.nav button').forEach((item) => item.classList.remove('active'));
  $$('.view').forEach((view) => view.classList.remove('active'));
  button.classList.add('active');
  target.classList.add('active');
  $('#viewTitle').textContent = button.textContent;
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await login($('#email').value, $('#password').value);
    } catch (error) {
      toast('Login inválido. Use admin@demo.com e senha 123456.');
    }
  });
  $('#refreshBtn').addEventListener('click', load);
  $('#logoutBtn').addEventListener('click', () => {
    state.token = '';
    state.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    renderAuth();
    toast('Sessão encerrada.');
  });
  $('#sendWaiterOrder').addEventListener('click', () => createOrder('waiter'));
  $('#sendCustomerOrder').addEventListener('click', () => createOrder('qr'));
  $('#customerBirthdate').addEventListener('change', renderCart);
  $('#customerPhone').addEventListener('input', (event) => {
    event.target.value = formatPhone(event.target.value);
  });
  $('#menuImageFile').addEventListener('change', loadMenuImageFile);
  $('#sendSupportMessage').addEventListener('click', sendSupportMessage);
  $('#sendBackofficeReply').addEventListener('click', () => sendBackofficeReply('open'));
  $('#resolveChat').addEventListener('click', () => sendBackofficeReply('resolved'));
  $('#saveSettings').addEventListener('click', saveSettings);
  $('#saveMenuItem').addEventListener('click', saveMenuItem);
  $('#clearMenuForm').addEventListener('click', clearMenuForm);
  $('#saveTable').addEventListener('click', saveTable);
  $('#clearTableForm').addEventListener('click', clearTableForm);
  $('[data-latest-route]').addEventListener('click', () => {
    const order = latestRetiradaOrder();
    if (!order) return toast('Não há pedido de retirada aberto.');
    openRoute(order.id);
  });
  $('[data-assign-latest]').addEventListener('click', () => {
    const order = latestRetiradaOrder();
    if (!order) return toast('Não há pedido de retirada para atribuir.');
    toast(`Pedido #${String(order.id).slice(-6)} atribuído ao responsável pela retirada.`);
  });
  $('#searchOrders').addEventListener('input', (event) => {
    state.search = event.target.value;
    renderOrders();
  });
  $('#orderDateFilter').addEventListener('change', renderOrders);
  $$('.nav button').forEach((button) => button.addEventListener('click', () => {
    activateView(button.dataset.view);
    history.replaceState(null, '', `#${button.dataset.view}`);
  }));
  $$('[data-admin-tab]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-admin-tab]').forEach((item) => item.classList.remove('active'));
    $$('.admin-tab').forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
    $(`#admin-${button.dataset.adminTab}`).classList.add('active');
  }));
  $$('.filter').forEach((button) => button.addEventListener('click', () => {
    $$('.filter').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.sector = button.dataset.sector;
    renderOrders();
  }));
  $$('[data-order-type]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-order-type]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.orderType = button.dataset.orderType;
    $('#addressFields').classList.toggle('hidden', state.orderType !== 'delivery');
    $('#tableSelectWrap').classList.toggle('hidden', state.orderType === 'delivery');
    renderCart();
  }));
  $$('[data-payment]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-payment]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.paymentMethod = button.dataset.payment;
  }));
}

function connectRealtime() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${location.host}`);
  socket.addEventListener('open', () => { $('#connection').textContent = 'tempo real ativo'; });
  socket.addEventListener('close', () => {
    $('#connection').textContent = 'reconectando...';
    setTimeout(connectRealtime, 1500);
  });
  socket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'connected') return;
    if (message.type.includes('order') || message.type.includes('settings') || message.type.includes('menu') || message.type.includes('tables') || message.type.includes('chat')) {
      await load();
      if (message.type === 'order:created') toast('Novo pedido recebido na cozinha.');
      if (message.type === 'order:status' && message.payload?.status === 'ready') toast('Pedido pronto para retirada.');
      if (message.type === 'chat:updated') toast('Nova mensagem no atendimento.');
    }
  });
}

const pathViews = {
  '/bar': 'waiter',
  '/garcom': 'waiter',
  '/cliente': 'customer',
  '/cozinha': 'kitchen',
  '/retirada': 'delivery',
  '/backoffice': 'backoffice'
};

bindEvents();
renderAuth();
activateView(new URLSearchParams(location.search).get('view') || location.hash.replace('#', '') || pathViews[location.pathname] || 'waiter');
connectRealtime();
login('admin@demo.com', '123456').catch(() => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = '';
  state.user = null;
  renderAuth();
  load();
});


