const API = 'http://localhost:3000';
const statuses = ['confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado'];
const brl = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
const $ = (selector) => document.querySelector(selector);

async function api(path, options) {
  const resposta = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  if (!resposta.ok) throw new Error((await resposta.json()).error || 'Erro na API');
  return resposta.json();
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

function renderPedidos(pedidos) {
  $('#pedidos').innerHTML = pedidos.map((pedido) => `
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
  document.querySelectorAll('[data-pagar]').forEach((botao) => botao.addEventListener('click', () => pagar(pedidos.find((pedido) => Number(pedido.id) === Number(botao.dataset.pagar)))));
}

async function carregar() {
  const [mesas, produtos, pedidos] = await Promise.all([api('/mesas'), api('/produtos'), api('/pedidos')]);
  $('#mesa').innerHTML = mesas.map((mesa) => `<option value="${mesa.id}">Mesa ${mesa.numero} · ${mesa.status}</option>`).join('');
  $('#produto').innerHTML = produtos.map((produto) => `<option value="${produto.id}">${produto.nome} · ${brl(produto.preco)}</option>`).join('');
  renderPedidos(pedidos);
}

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
carregar().catch((error) => alert(error.message));
