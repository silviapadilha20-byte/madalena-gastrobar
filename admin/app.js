const API = 'http://localhost:3000';
const statuses = ['confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado'];
const brl = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
const $ = (selector) => document.querySelector(selector);
const precoEfetivo = (produto) => Number(produto.preco_promocional || 0) > 0 && Number(produto.preco_promocional) < Number(produto.preco)
  ? Number(produto.preco_promocional)
  : Number(produto.preco);

let state = { mesas: [], produtos: [], pedidos: [], pagamento: null, caixa: null, impressoes: [], chamados: [] };
let sessao = JSON.parse(localStorage.getItem('barDigitalAdmin') || 'null');

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

function toast(message) {
  alert(message);
}

function aplicarSessao() {
  const logado = Boolean(sessao?.token);
  $('#loginBox').style.display = logado ? 'none' : 'grid';
  document.querySelectorAll('.app-shell').forEach((el) => { el.style.display = logado ? '' : 'none'; });
  $('#usuarioLogado').textContent = logado ? `${sessao.usuario.nome} · ${sessao.usuario.perfil}` : 'Faça login';
}

async function login(event) {
  event.preventDefault();
  sessao = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: $('#loginEmail').value, senha: $('#loginSenha').value })
  });
  localStorage.setItem('barDigitalAdmin', JSON.stringify(sessao));
  aplicarSessao();
  carregar();
}

function sair() {
  localStorage.removeItem('barDigitalAdmin');
  sessao = null;
  aplicarSessao();
}

async function pagar(pedido) {
  const metodo = prompt('Forma de pagamento: dinheiro, cartao ou pix', 'pix');
  if (!metodo) return;
  const pagamento = await api('/pagamentos', {
    method: 'POST',
    body: JSON.stringify({ pedido_id: pedido.id, metodo, valor: pedido.total })
  });
  if (pagamento.pix_copia_cola) toast(`PIX copia e cola:\n${pagamento.pix_copia_cola}`);
  await api(`/pedidos/${pedido.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'finalizado' }) });
  carregar();
}

async function atualizarStatus(id, status) {
  let motivo = null;
  if (status === 'cancelado') motivo = prompt('Motivo do cancelamento', 'Cliente solicitou cancelamento');
  await api(`/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify({ status, motivo }) });
  carregar();
}

async function reimprimir(id, tipo = 'reimpressao', setor = 'comanda') {
  await api(`/impressoes/pedidos/${id}`, { method: 'POST', body: JSON.stringify({ tipo, setor }) });
  carregar();
}

function renderPedidos() {
  $('#pedidos').innerHTML = state.pedidos.map((pedido) => `
    <article class="pedido ${pedido.conta_solicitada_em ? 'attention' : ''}">
      <h3>Mesa ${pedido.mesa_numero || '-'} · Pedido #${pedido.id}</h3>
      <strong>${pedido.status} · ${brl(pedido.total)}</strong>
      <p class="muted">${pedido.cliente_nome || 'Cliente não informado'}${pedido.cliente_telefone ? ` · ${pedido.cliente_telefone}` : ''}</p>
      ${Number(pedido.desconto || 0) > 0 ? `<p class="promo-price">Desconto aplicado: ${brl(pedido.desconto)}</p>` : ''}
      <ul>${pedido.itens.map((item) => `<li>${item.quantidade}x ${item.nome}${item.observacao ? ` - ${item.observacao}` : ''}</li>`).join('')}</ul>
      <details>
        <summary>Histórico</summary>
        <div>${(pedido.historico || []).map((h) => `<p>${h.status_anterior || '-'} → ${h.status_novo} · ${h.usuario_nome || 'Sistema'}${h.motivo ? ` · ${h.motivo}` : ''}</p>`).join('') || '<p>Sem histórico.</p>'}</div>
      </details>
      <div class="status">
        ${statuses.map((status) => `<button data-status="${status}" data-pedido="${pedido.id}">${status}</button>`).join('')}
        <button class="danger" data-status="cancelado" data-pedido="${pedido.id}">Cancelar</button>
        <button data-reimprimir="${pedido.id}">Reimprimir comanda</button>
        <button class="primary" data-pagar="${pedido.id}">Fechar conta</button>
      </div>
    </article>
  `).join('') || '<p>Nenhum pedido encontrado.</p>';
  document.querySelectorAll('[data-status]').forEach((botao) => botao.addEventListener('click', () => atualizarStatus(botao.dataset.pedido, botao.dataset.status)));
  document.querySelectorAll('[data-pagar]').forEach((botao) => botao.addEventListener('click', () => pagar(state.pedidos.find((pedido) => Number(pedido.id) === Number(botao.dataset.pagar)))));
  document.querySelectorAll('[data-reimprimir]').forEach((botao) => botao.addEventListener('click', () => reimprimir(botao.dataset.reimprimir)));
}

function renderPedidoManual() {
  $('#mesa').innerHTML = state.mesas.map((mesa) => `<option value="${mesa.id}">Mesa ${mesa.numero} · ${mesa.status}</option>`).join('');
  $('#produto').innerHTML = state.produtos.filter((produto) => produto.disponivel).map((produto) => `<option value="${produto.id}">${produto.nome} · ${brl(precoEfetivo(produto))}</option>`).join('');
}

function limparProduto() {
  $('#produtoId').value = '';
  $('#produtoNome').value = '';
  $('#produtoDescricao').value = '';
  $('#produtoPreco').value = '';
  $('#produtoPrecoPromocional').value = '';
  $('#produtoCategoria').value = 'cozinha';
  $('#produtoImagemUrl').value = '';
  $('#produtoImagemArquivo').value = '';
  $('#produtoImagemPreview').innerHTML = '';
  $('#produtoDisponivel').checked = true;
}

function preencherProduto(id) {
  const produto = state.produtos.find((item) => Number(item.id) === Number(id));
  if (!produto) return;
  $('#produtoId').value = produto.id;
  $('#produtoNome').value = produto.nome || '';
  $('#produtoDescricao').value = produto.descricao || '';
  $('#produtoPreco').value = produto.preco || '';
  $('#produtoPrecoPromocional').value = produto.preco_promocional || '';
  $('#produtoCategoria').value = produto.categoria || 'cozinha';
  $('#produtoImagemUrl').value = produto.imagem_url || '';
  $('#produtoImagemPreview').innerHTML = produto.imagem_url ? `<img src="${produto.imagem_url}" alt="${produto.nome}" />` : '';
  $('#produtoDisponivel').checked = Boolean(produto.disponivel);
}

function precoHtml(produto) {
  const promo = Number(produto.preco_promocional || 0);
  const preco = Number(produto.preco || 0);
  if (promo > 0 && promo < preco) {
    return `<span class="old-price">${brl(preco)}</span> <strong class="promo-price">${brl(promo)}</strong>`;
  }
  return brl(preco);
}

function renderProdutos() {
  $('#produtosLista').innerHTML = state.produtos.map((produto) => `
    <article class="row-card">
      ${produto.imagem_url ? `<img class="admin-product-image" src="${produto.imagem_url}" alt="${produto.nome}" />` : '<div class="admin-product-image empty">Sem imagem</div>'}
      <strong>${produto.nome}</strong>
      <p class="muted">${produto.categoria} · ${precoHtml(produto)} · ${produto.disponivel ? 'disponível' : 'indisponível'}</p>
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
    preco_promocional: $('#produtoPrecoPromocional').value ? Number($('#produtoPrecoPromocional').value) : null,
    categoria: $('#produtoCategoria').value,
    imagem_url: $('#produtoImagemUrl').value,
    disponivel: $('#produtoDisponivel').checked
  };
  await api(id ? `/produtos/${id}` : '/produtos', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(payload)
  });
  limparProduto();
  carregar();
}

function carregarImagemProduto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    toast('Use uma imagem PNG ou JPG.');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    $('#produtoImagemUrl').value = reader.result;
    $('#produtoImagemPreview').innerHTML = `<img src="${reader.result}" alt="Prévia do produto" />`;
  });
  reader.readAsDataURL(file);
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
        <p class="muted">${mesa.status} · ${mesa.lugares || 4} pessoa(s)</p>
        <div class="row-actions">
          <input class="seats-input" type="number" min="1" value="${mesa.lugares || 4}" data-lugares-mesa="${mesa.id}" />
          <button data-salvar-lugares="${mesa.id}">Salvar pessoas</button>
          <button data-status-mesa="livre" data-mesa="${mesa.id}">Livre</button>
          <button data-status-mesa="ocupada" data-mesa="${mesa.id}">Ocupada</button>
          <button class="danger" data-remover-mesa="${mesa.id}">Remover</button>
      </div>
    </article>
  `).join('') || '<p>Nenhuma mesa cadastrada.</p>';
  document.querySelectorAll('[data-status-mesa]').forEach((botao) => botao.addEventListener('click', () => atualizarMesa(botao.dataset.mesa, botao.dataset.statusMesa)));
  document.querySelectorAll('[data-salvar-lugares]').forEach((botao) => botao.addEventListener('click', () => salvarLugaresMesa(botao.dataset.salvarLugares)));
  document.querySelectorAll('[data-remover-mesa]').forEach((botao) => botao.addEventListener('click', () => removerMesa(botao.dataset.removerMesa)));
}

async function criarMesa() {
  if (!$('#mesaNumero').value) return toast('Informe o número da mesa.');
  await api('/mesas', { method: 'POST', body: JSON.stringify({ numero: Number($('#mesaNumero').value), lugares: Number($('#mesaLugares').value || 4) }) });
  $('#mesaNumero').value = '';
  $('#mesaLugares').value = 4;
  carregar();
}

async function atualizarMesa(id, status) {
  await api(`/mesas/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  carregar();
}

async function salvarLugaresMesa(id) {
  const input = document.querySelector(`[data-lugares-mesa="${id}"]`);
  await api(`/mesas/${id}`, { method: 'PATCH', body: JSON.stringify({ lugares: Number(input.value || 4) }) });
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

function renderCaixa() {
  const caixa = state.caixa?.caixa;
  const resumo = state.caixa?.resumo || [];
  const movimentos = state.caixa?.movimentos || [];
  $('#caixaResumo').innerHTML = caixa ? `
    <article class="row-card">
      <strong>Caixa #${caixa.id} · ${caixa.status}</strong>
      <p class="muted">Aberto por ${caixa.usuario_nome || 'Sistema'} · Saldo inicial ${brl(caixa.saldo_inicial)}</p>
      <p>${resumo.map((item) => `${item.metodo}: ${brl(item.total)}`).join(' · ') || 'Sem vendas registradas.'}</p>
    </article>
    ${movimentos.map((mov) => `<article class="row-card"><strong>${mov.tipo}</strong><p>${mov.metodo || '-'} · ${brl(mov.valor)} · ${mov.descricao || ''}</p></article>`).join('')}
  ` : '<p>Nenhum caixa aberto.</p>';
}

function renderImpressoes() {
  $('#impressoesLista').innerHTML = state.impressoes.map((item) => `
    <article class="row-card">
      <strong>${item.setor} · ${item.tipo} · Pedido #${item.pedido_id}</strong>
      <p class="muted">Mesa ${item.mesa_numero || '-'} · ${item.status}</p>
      <pre>${item.conteudo}</pre>
      <div class="row-actions">
        <button data-impressao="${item.id}" data-impressao-status="impresso">Marcar impresso</button>
        <button class="danger" data-impressao="${item.id}" data-impressao-status="erro">Erro</button>
      </div>
    </article>
  `).join('') || '<p>Sem itens na fila de impressão.</p>';
  document.querySelectorAll('[data-impressao]').forEach((botao) => botao.addEventListener('click', () => atualizarImpressao(botao.dataset.impressao, botao.dataset.impressaoStatus)));
}

function renderChamados() {
  $('#chamadosLista').innerHTML = state.chamados.map((chamado) => `
    <article class="row-card">
      <strong>${chamado.tipo} · Mesa ${chamado.mesa_numero || '-'}</strong>
      <p>${chamado.mensagem || 'Sem mensagem.'}</p>
      <p class="muted">${chamado.status}</p>
      <div class="row-actions">
        <button data-chamado="${chamado.id}" data-chamado-status="em_atendimento">Atender</button>
        <button data-chamado="${chamado.id}" data-chamado-status="resolvido">Resolver</button>
      </div>
    </article>
  `).join('') || '<p>Sem chamados de cliente.</p>';
  document.querySelectorAll('[data-chamado]').forEach((botao) => botao.addEventListener('click', () => atualizarChamado(botao.dataset.chamado, botao.dataset.chamadoStatus)));
}

async function abrirCaixa() {
  await api('/caixa/abrir', { method: 'POST', body: JSON.stringify({ saldo_inicial: Number($('#saldoInicial').value || 0) }) });
  carregar();
}

async function lancarMovimento() {
  await api('/caixa/movimentos', {
    method: 'POST',
    body: JSON.stringify({
      tipo: $('#movimentoTipo').value,
      valor: Number($('#movimentoValor').value || 0),
      descricao: $('#movimentoDescricao').value
    })
  });
  carregar();
}

async function fecharCaixa() {
  if (!confirm('Fechar o caixa de hoje?')) return;
  await api('/caixa/fechar', { method: 'POST', body: JSON.stringify({ saldo_informado: Number($('#saldoFechamento').value || 0) }) });
  carregar();
}

async function atualizarImpressao(id, status) {
  await api(`/impressoes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  carregar();
}

async function atualizarChamado(id, status) {
  await api(`/clientes/chamados/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  carregar();
}

function renderAll() {
  renderPedidos();
  renderPedidoManual();
  renderProdutos();
  renderMesas();
  renderPagamento();
  renderCaixa();
  renderImpressoes();
  renderChamados();
}

async function carregar() {
  if (!sessao?.token) return;
  const [mesas, produtos, pedidos, pagamento, caixa, impressoes, chamados] = await Promise.all([
    api('/mesas'),
    api('/produtos?todos=1'),
    api('/pedidos'),
    api('/configuracoes/pagamento'),
    api('/caixa/atual'),
    api('/impressoes'),
    api('/clientes/chamados')
  ]);
  state = { mesas, produtos, pedidos, pagamento, caixa, impressoes, chamados };
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

$('#loginForm').addEventListener('submit', (event) => login(event).catch((error) => toast(error.message)));
$('#sair').addEventListener('click', sair);
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
$('#atualizar').addEventListener('click', () => carregar().catch((error) => toast(error.message)));
$('#salvarProduto').addEventListener('click', () => salvarProduto().catch((error) => toast(error.message)));
$('#novoProduto').addEventListener('click', limparProduto);
$('#produtoImagemArquivo').addEventListener('change', carregarImagemProduto);
$('#salvarMesa').addEventListener('click', () => criarMesa().catch((error) => toast(error.message)));
$('#salvarPagamento').addEventListener('click', () => salvarPagamento().catch((error) => toast(error.message)));
$('#abrirCaixa').addEventListener('click', () => abrirCaixa().catch((error) => toast(error.message)));
$('#lancarMovimento').addEventListener('click', () => lancarMovimento().catch((error) => toast(error.message)));
$('#fecharCaixa').addEventListener('click', () => fecharCaixa().catch((error) => toast(error.message)));

aplicarSessao();
carregar().catch((error) => toast(error.message));
