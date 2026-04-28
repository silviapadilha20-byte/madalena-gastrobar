const API = 'http://localhost:3000';
const statuses = ['confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado'];
const brl = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
const $ = (selector) => document.querySelector(selector);

let state = { mesas: [], produtos: [], pedidos: [], pagamento: null };

async function api(path, options) {
  const resposta = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  if (!resposta.ok) throw new Error((await resposta.json()).error || 'Erro na API');
  return resposta.json();
}

function toast(message) {
  alert(message);
}

async function pagar(pedido) {
  const metodo = prompt('Forma de pagamento: dinheiro, cartao ou pix', 'pix');
  if (!metodo) return;
  await api('/pagamentos', {
    method: 'POST',
    body: JSON.stringify({ pedido_id: pedido.id, metodo, valor: pedido.total })
  });
  await api(`/pedidos/${pedido.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'finalizado' }) });
  carregar();
}

async function atualizarStatus(id, status) {
  await api(`/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  carregar();
}

function renderPedidos() {
  $('#pedidos').innerHTML = state.pedidos.map((pedido) => `
    <article class="pedido">
      <h3>Mesa ${pedido.mesa_numero || '-'} · Pedido #${pedido.id}</h3>
      <strong>${pedido.status} · ${brl(pedido.total)}</strong>
      <ul>${pedido.itens.map((item) => `<li>${item.quantidade}x ${item.nome}${item.observacao ? ` - ${item.observacao}` : ''}</li>`).join('')}</ul>
      <div class="status">
        ${statuses.map((status) => `<button data-status="${status}" data-pedido="${pedido.id}">${status}</button>`).join('')}
        <button class="primary" data-pagar="${pedido.id}">Fechar conta</button>
      </div>
    </article>
  `).join('') || '<p>Nenhum pedido encontrado.</p>';
  document.querySelectorAll('[data-status]').forEach((botao) => botao.addEventListener('click', () => atualizarStatus(botao.dataset.pedido, botao.dataset.status)));
  document.querySelectorAll('[data-pagar]').forEach((botao) => botao.addEventListener('click', () => pagar(state.pedidos.find((pedido) => Number(pedido.id) === Number(botao.dataset.pagar)))));
}

function renderPedidoManual() {
  $('#mesa').innerHTML = state.mesas.map((mesa) => `<option value="${mesa.id}">Mesa ${mesa.numero} · ${mesa.status}</option>`).join('');
  $('#produto').innerHTML = state.produtos.filter((produto) => produto.disponivel).map((produto) => `<option value="${produto.id}">${produto.nome} · ${brl(produto.preco)}</option>`).join('');
}

function limparProduto() {
  $('#produtoId').value = '';
  $('#produtoNome').value = '';
  $('#produtoDescricao').value = '';
  $('#produtoPreco').value = '';
  $('#produtoCategoria').value = 'cozinha';
  $('#produtoDisponivel').checked = true;
}

function preencherProduto(id) {
  const produto = state.produtos.find((item) => Number(item.id) === Number(id));
  if (!produto) return;
  $('#produtoId').value = produto.id;
  $('#produtoNome').value = produto.nome || '';
  $('#produtoDescricao').value = produto.descricao || '';
  $('#produtoPreco').value = produto.preco || '';
  $('#produtoCategoria').value = produto.categoria || 'cozinha';
  $('#produtoDisponivel').checked = Boolean(produto.disponivel);
}

function renderProdutos() {
  $('#produtosLista').innerHTML = state.produtos.map((produto) => `
    <article class="row-card">
      <strong>${produto.nome}</strong>
      <p class="muted">${produto.categoria} · ${brl(produto.preco)} · ${produto.disponivel ? 'disponível' : 'indisponível'}</p>
      <p>${produto.descricao || ''}</p>
      <div class="row-actions">
        <button data-editar-produto="${produto.id}">Editar</button>
        <button class="danger" data-remover-produto="${produto.id}">Remover</button>
      </div>
    </article>
  `).join('') || '<p>Nenhum produto cadastrado.</p>';
  document.querySelectorAll('[data-editar-produto]').forEach((botao) => botao.addEventListener('click', () => preencherProduto(botao.dataset.editarProduto)));
  document.querySelectorAll('[data-remover-produto]').forEach((botao) => botao.addEventListener('click', () => removerProduto(botao.dataset.removerProduto)));
}

async function salvarProduto() {
  const id = $('#produtoId').value;
  const payload = {
    nome: $('#produtoNome').value,
    descricao: $('#produtoDescricao').value,
    preco: Number($('#produtoPreco').value),
    categoria: $('#produtoCategoria').value,
    disponivel: $('#produtoDisponivel').checked
  };
  await api(id ? `/produtos/${id}` : '/produtos', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(payload)
  });
  limparProduto();
  carregar();
}

async function removerProduto(id) {
  if (!confirm('Remover este produto?')) return;
  await api(`/produtos/${id}`, { method: 'DELETE' });
  carregar();
}

function renderMesas() {
  $('#mesasLista').innerHTML = state.mesas.map((mesa) => `
    <article class="row-card">
      <strong>Mesa ${mesa.numero}</strong>
      <p class="muted">${mesa.status}</p>
      <div class="row-actions">
        <button data-status-mesa="livre" data-mesa="${mesa.id}">Livre</button>
        <button data-status-mesa="ocupada" data-mesa="${mesa.id}">Ocupada</button>
        <button class="danger" data-remover-mesa="${mesa.id}">Remover</button>
      </div>
    </article>
  `).join('') || '<p>Nenhuma mesa cadastrada.</p>';
  document.querySelectorAll('[data-status-mesa]').forEach((botao) => botao.addEventListener('click', () => atualizarMesa(botao.dataset.mesa, botao.dataset.statusMesa)));
  document.querySelectorAll('[data-remover-mesa]').forEach((botao) => botao.addEventListener('click', () => removerMesa(botao.dataset.removerMesa)));
}

async function criarMesa() {
  if (!$('#mesaNumero').value) return toast('Informe o número da mesa.');
  await api('/mesas', { method: 'POST', body: JSON.stringify({ numero: Number($('#mesaNumero').value) }) });
  $('#mesaNumero').value = '';
  carregar();
}

async function atualizarMesa(id, status) {
  await api(`/mesas/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  carregar();
}

async function removerMesa(id) {
  if (!confirm('Remover esta mesa?')) return;
  await api(`/mesas/${id}`, { method: 'DELETE' });
  carregar();
}

function renderPagamento() {
  const config = state.pagamento || {};
  $('#pixAtivo').checked = config.pix_ativo !== false;
  $('#cartaoAtivo').checked = config.cartao_ativo !== false;
  $('#dinheiroAtivo').checked = config.dinheiro_ativo !== false;
  $('#chavePix').value = config.chave_pix || '';
  $('#gatewayNome').value = config.gateway_nome || 'manual';
  $('#gatewayAtivo').checked = Boolean(config.gateway_ativo);
  $('#gatewayPublicKey').value = config.gateway_public_key || '';
  $('#gatewaySecretKey').value = config.gateway_secret_key || '';
}

async function salvarPagamento() {
  state.pagamento = await api('/configuracoes/pagamento', {
    method: 'PUT',
    body: JSON.stringify({
      pix_ativo: $('#pixAtivo').checked,
      cartao_ativo: $('#cartaoAtivo').checked,
      dinheiro_ativo: $('#dinheiroAtivo').checked,
      chave_pix: $('#chavePix').value,
      gateway_nome: $('#gatewayNome').value,
      gateway_ativo: $('#gatewayAtivo').checked,
      gateway_public_key: $('#gatewayPublicKey').value,
      gateway_secret_key: $('#gatewaySecretKey').value
    })
  });
  toast('Configurações de pagamento salvas.');
}

function renderAll() {
  renderPedidos();
  renderPedidoManual();
  renderProdutos();
  renderMesas();
  renderPagamento();
}

async function carregar() {
  const [mesas, produtos, pedidos, pagamento] = await Promise.all([
    api('/mesas'),
    api('/produtos?todos=1'),
    api('/pedidos'),
    api('/configuracoes/pagamento')
  ]);
  state = { mesas, produtos, pedidos, pagamento };
  renderAll();
}

document.querySelectorAll('[data-tab]').forEach((botao) => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    botao.classList.add('active');
    $(`#tab-${botao.dataset.tab}`).classList.add('active');
  });
});

$('#criar').addEventListener('click', async () => {
  await api('/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      mesa_id: Number($('#mesa').value),
      itens: [{ produto_id: Number($('#produto').value), quantidade: Number($('#quantidade').value), observacao: $('#observacao').value }]
    })
  });
  $('#observacao').value = '';
  carregar();
});
$('#atualizar').addEventListener('click', carregar);
$('#salvarProduto').addEventListener('click', salvarProduto);
$('#novoProduto').addEventListener('click', limparProduto);
$('#salvarMesa').addEventListener('click', criarMesa);
$('#salvarPagamento').addEventListener('click', salvarPagamento);

carregar().catch((error) => alert(error.message));
