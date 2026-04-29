const API = 'http://localhost:3000';
const setores = ['cozinha', 'bar', 'sobremesa'];
let sessao = JSON.parse(localStorage.getItem('barDigitalKds') || 'null');

async function api(path, options = {}) {
  const resposta = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessao?.token ? { Authorization: `Bearer ${sessao.token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!resposta.ok) throw new Error((await resposta.json()).error || 'Erro na API');
  return resposta.json();
}

function minutos(data) {
  return Math.floor((Date.now() - new Date(data).getTime()) / 60000);
}

function aplicarSessao() {
  const logado = Boolean(sessao?.token);
  document.querySelector('#loginBox').style.display = logado ? 'none' : 'grid';
  document.querySelector('#board').style.display = logado ? 'grid' : 'none';
  document.querySelector('#usuarioKds').textContent = logado ? `${sessao.usuario.nome} · Atualiza a cada 5s` : 'Faça login';
}

async function login(event) {
  event.preventDefault();
  sessao = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: document.querySelector('#loginEmail').value, senha: document.querySelector('#loginSenha').value })
  });
  localStorage.setItem('barDigitalKds', JSON.stringify(sessao));
  aplicarSessao();
  carregar();
}

async function status(id, novoStatus) {
  await api(`/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify({ status: novoStatus }) });
  carregar();
}

function card(pedido, setor) {
  const itens = pedido.itens.filter((item) => item.categoria === setor);
  const idade = minutos(pedido.criado_em);
  const atrasado = idade >= 20 && !['pronto', 'entregue', 'finalizado'].includes(pedido.status);
  return `
    <article class="pedido ${pedido.status} ${atrasado ? 'atrasado' : ''}">
      <h3>#${pedido.id} · Mesa ${pedido.mesa_numero || '-'}</h3>
      <strong>${pedido.status} · ${idade} min${atrasado ? ' · ATRASADO' : ''}</strong>
      <ul>${itens.map((item) => `<li>${item.quantidade}x ${item.nome}${item.observacao ? ` - ${item.observacao}` : ''}</li>`).join('')}</ul>
      <button data-status="confirmado" data-pedido="${pedido.id}">Confirmar</button>
      <button data-status="em_preparo" data-pedido="${pedido.id}">Em preparo</button>
      <button data-status="pronto" data-pedido="${pedido.id}">Pronto</button>
    </article>
  `;
}

async function carregar() {
  if (!sessao?.token) return;
  const pedidos = (await api('/pedidos')).filter((pedido) => !['entregue', 'finalizado', 'cancelado'].includes(pedido.status));
  document.querySelector('#board').innerHTML = setores.map((setor) => {
    const pedidosSetor = pedidos.filter((pedido) => pedido.itens.some((item) => item.categoria === setor));
    return `<section class="coluna"><h2>${setor}</h2>${pedidosSetor.map((pedido) => card(pedido, setor)).join('') || '<p>Sem pedidos.</p>'}</section>`;
  }).join('');
  document.querySelectorAll('[data-status]').forEach((botao) => botao.addEventListener('click', () => status(botao.dataset.pedido, botao.dataset.status)));
}

document.querySelector('#loginForm').addEventListener('submit', (event) => login(event).catch((error) => alert(error.message)));
aplicarSessao();
carregar().catch((error) => alert(error.message));
setInterval(carregar, 5000);
