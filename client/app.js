const API = 'http://localhost:3000';
const params = new URLSearchParams(location.search);
const mesaNumero = Number(params.get('mesa') || 1);
let mesas = [];
let produtos = [];
let ultimoPedido = null;
let acompanharTimer = null;
const carrinho = new Map();

const brl = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
const $ = (selector) => document.querySelector(selector);
const precoEfetivo = (produto) => Number(produto.preco_promocional || 0) > 0 && Number(produto.preco_promocional) < Number(produto.preco)
  ? Number(produto.preco_promocional)
  : Number(produto.preco);
const precoHtml = (produto) => {
  const promo = Number(produto.preco_promocional || 0);
  const preco = Number(produto.preco || 0);
  if (promo > 0 && promo < preco) {
    return `<span class="price-row"><span class="old-price">${brl(preco)}</span><strong class="promo-price">${brl(promo)}</strong><span class="promo-tag">Promoção</span></span>`;
  }
  return `<strong>${brl(preco)}</strong>`;
};

async function api(path, options) {
  const resposta = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  if (!resposta.ok) throw new Error((await resposta.json()).error || 'Erro na API');
  return resposta.json();
}

function renderCarrinho() {
  const itens = Array.from(carrinho.values());
  $('#carrinho').innerHTML = itens.map((item) => `
    <div class="linha">
      <strong>${item.quantidade}x ${item.nome}</strong>
      <span>${brl(item.quantidade * precoEfetivo(item))}</span>
      <textarea data-obs="${item.id}" placeholder="Observação deste item">${item.observacao || ''}</textarea>
    </div>
  `).join('') || '<p>Selecione itens do cardápio.</p>';
  document.querySelectorAll('[data-obs]').forEach((campo) => {
    campo.addEventListener('input', () => {
      const item = carrinho.get(Number(campo.dataset.obs));
      carrinho.set(item.id, { ...item, observacao: campo.value });
    });
  });
  $('#total').textContent = brl(itens.reduce((soma, item) => soma + item.quantidade * precoEfetivo(item), 0));
}

function renderProdutos() {
  $('#produtos').innerHTML = produtos.map((produto) => `
    <article class="produto">
      ${produto.imagem_url ? `<img src="${produto.imagem_url}" alt="${produto.nome}" />` : ''}
      <h3>${produto.nome}</h3>
      <p>${produto.descricao || ''}</p>
      ${precoHtml(produto)}
      <button data-produto="${produto.id}">Adicionar</button>
    </article>
  `).join('');
  document.querySelectorAll('[data-produto]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const produto = produtos.find((item) => Number(item.id) === Number(botao.dataset.produto));
      const atual = carrinho.get(Number(produto.id));
      carrinho.set(Number(produto.id), { ...produto, quantidade: (atual?.quantidade || 0) + 1, observacao: atual?.observacao || '' });
      renderCarrinho();
    });
  });
}

async function enviarPedido() {
  const mesaAtual = mesas.find((item) => Number(item.numero) === mesaNumero) || mesas[0];
  if (!mesaAtual) return $('#mensagem').textContent = 'Mesa não encontrada.';
  if (!$('#clienteNome').value || !$('#clienteTelefone').value) return $('#mensagem').textContent = 'Informe nome completo e celular.';
  const itens = Array.from(carrinho.values()).map((item) => ({
    produto_id: item.id,
    quantidade: item.quantidade,
    observacao: item.observacao
  }));
  if (!itens.length) return $('#mensagem').textContent = 'Adicione itens ao pedido.';

  ultimoPedido = await api('/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      mesa_id: mesaAtual.id,
      cliente_nome: $('#clienteNome').value,
      cliente_telefone: $('#clienteTelefone').value,
      cliente_email: $('#clienteEmail').value,
      cliente_nascimento: $('#clienteNascimento').value || null,
      cupom: $('#cupom').value,
      itens
    })
  });
  carrinho.clear();
  renderCarrinho();
  $('#mensagem').textContent = `Pedido #${ultimoPedido.id} enviado para a cozinha.`;
  $('#acompanhar').hidden = false;
  atualizarAcompanhamento();
  if (acompanharTimer) clearInterval(acompanharTimer);
  acompanharTimer = setInterval(atualizarAcompanhamento, 5000);
}

async function atualizarAcompanhamento() {
  if (!ultimoPedido?.id) return;
  const pedidos = await api('/pedidos');
  ultimoPedido = pedidos.find((pedido) => Number(pedido.id) === Number(ultimoPedido.id)) || ultimoPedido;
  $('#statusPedido').textContent = `Pedido #${ultimoPedido.id}: ${ultimoPedido.status}`;
}

async function criarChamado(tipo, mensagem) {
  const mesaAtual = mesas.find((item) => Number(item.numero) === mesaNumero) || mesas[0];
  await api('/clientes/chamados', {
    method: 'POST',
    body: JSON.stringify({
      pedido_id: ultimoPedido?.id || null,
      mesa_id: mesaAtual?.id || null,
      tipo,
      mensagem
    })
  });
  $('#mensagem').textContent = 'Mensagem enviada para o backoffice.';
}

async function pedirConta() {
  if (!ultimoPedido?.id) return criarChamado('conta', 'Cliente pediu a conta');
  await api(`/clientes/pedidos/${ultimoPedido.id}/pedir-conta`, { method: 'POST', body: JSON.stringify({}) });
  $('#mensagem').textContent = 'Conta solicitada.';
}

async function avaliarPedido() {
  if (!ultimoPedido?.id) return $('#mensagem').textContent = 'Envie um pedido antes de avaliar.';
  await api(`/clientes/pedidos/${ultimoPedido.id}/avaliacao`, {
    method: 'POST',
    body: JSON.stringify({ nota: Number($('#avaliacaoNota').value), comentario: $('#avaliacaoComentario').value })
  });
  $('#mensagem').textContent = 'Obrigado pela avaliação.';
}

async function buscarHistorico() {
  const telefone = $('#clienteTelefone').value;
  if (!telefone) return $('#historico').innerHTML = '<p>Informe o celular.</p>';
  const pedidos = await api(`/clientes/historico?telefone=${encodeURIComponent(telefone)}`);
  $('#historico').innerHTML = pedidos.map((pedido) => `<p>#${pedido.id} · ${pedido.status} · ${brl(pedido.total)}</p>`).join('') || '<p>Nenhum pedido encontrado.</p>';
}

async function iniciar() {
  mesas = await api('/mesas');
  produtos = await api('/produtos');
  const mesa = mesas.find((item) => Number(item.numero) === mesaNumero) || mesas[0];
  $('#mesaLabel').textContent = `Mesa ${mesa?.numero || mesaNumero}`;
  renderProdutos();
  renderCarrinho();
  $('#enviar').addEventListener('click', () => enviarPedido().catch((error) => $('#mensagem').textContent = error.message));
  $('#chamarGarcom').addEventListener('click', () => criarChamado('garcom', 'Cliente chamou o garçom').catch((error) => $('#mensagem').textContent = error.message));
  $('#abrirChamado').addEventListener('click', () => criarChamado($('#motivoChamado').value, $('#mensagemChamado').value).catch((error) => $('#mensagem').textContent = error.message));
  $('#pedirConta').addEventListener('click', () => pedirConta().catch((error) => $('#mensagem').textContent = error.message));
  $('#avaliarPedido').addEventListener('click', () => avaliarPedido().catch((error) => $('#mensagem').textContent = error.message));
  $('#buscarHistorico').addEventListener('click', () => buscarHistorico().catch((error) => $('#historico').innerHTML = `<p>${error.message}</p>`));
}

iniciar().catch((error) => $('#mensagem').textContent = error.message);
