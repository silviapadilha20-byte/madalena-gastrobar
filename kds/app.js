const API = 'http://localhost:3000';
const setores = ['cozinha', 'bar', 'sobremesa'];

async function api(path, options) {
  const resposta = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  if (!resposta.ok) throw new Error((await resposta.json()).error || 'Erro na API');
  return resposta.json();
}

function minutos(data) {
  return Math.floor((Date.now() - new Date(data).getTime()) / 60000);
}

async function status(id, novoStatus) {
  await api(`/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify({ status: novoStatus }) });
  carregar();
}

function card(pedido, setor) {
  const itens = pedido.itens.filter((item) => item.categoria === setor);
  return `
    <article class="pedido ${pedido.status}">
      <h3>#${pedido.id} · Mesa ${pedido.mesa_numero || '-'}</h3>
      <strong>${pedido.status} · ${minutos(pedido.criado_em)} min</strong>
      <ul>${itens.map((item) => `<li>${item.quantidade}x ${item.nome}${item.observacao ? ` - ${item.observacao}` : ''}</li>`).join('')}</ul>
      <button data-status="em_preparo" data-pedido="${pedido.id}">Em preparo</button>
      <button data-status="pronto" data-pedido="${pedido.id}">Pronto</button>
    </article>
  `;
}

async function carregar() {
  const pedidos = (await api('/pedidos')).filter((pedido) => !['entregue', 'finalizado'].includes(pedido.status));
  document.querySelector('#board').innerHTML = setores.map((setor) => {
    const pedidosSetor = pedidos.filter((pedido) => pedido.itens.some((item) => item.categoria === setor));
    return `<section class="coluna"><h2>${setor}</h2>${pedidosSetor.map((pedido) => card(pedido, setor)).join('') || '<p>Sem pedidos.</p>'}</section>`;
  }).join('');
  document.querySelectorAll('[data-status]').forEach((botao) => botao.addEventListener('click', () => status(botao.dataset.pedido, botao.dataset.status)));
}

carregar();
setInterval(carregar, 5000);
