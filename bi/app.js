const API = 'http://localhost:3000';
const brl = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
let sessao = JSON.parse(localStorage.getItem('barDigitalBi') || 'null');

function aplicarSessao() {
  const logado = Boolean(sessao?.token);
  document.querySelector('#loginBox').style.display = logado ? 'none' : 'grid';
  document.querySelector('#dashboard').style.display = logado ? 'grid' : 'none';
}

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

async function login(event) {
  event.preventDefault();
  sessao = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: document.querySelector('#loginEmail').value, senha: document.querySelector('#loginSenha').value })
  });
  localStorage.setItem('barDigitalBi', JSON.stringify(sessao));
  aplicarSessao();
  carregar();
}

async function carregar() {
  if (!sessao?.token) return;
  const params = new URLSearchParams();
  if (document.querySelector('#dataInicio').value) params.set('inicio', document.querySelector('#dataInicio').value);
  if (document.querySelector('#dataFim').value) params.set('fim', document.querySelector('#dataFim').value);
  const dados = await api(`/relatorios${params.toString() ? `?${params}` : ''}`);

  document.querySelector('#faturamento').textContent = brl(dados.faturamento_total);
  document.querySelector('#ticket').textContent = brl(dados.ticket_medio);
  document.querySelector('#tempo').textContent = `${Number(dados.tempo_medio_preparo || 0)} min`;
  document.querySelector('#entrega').textContent = `${Number(dados.tempo_medio_entrega || 0)} min`;

  renderFaturamento(dados.faturamento_por_dia || []);
  renderProdutos(dados.produtos_mais_vendidos || []);
  renderStatus(dados.volume_por_status || []);
}

function renderFaturamento(dias) {
  const max = Math.max(...dias.map((item) => Number(item.faturamento || 0)), 1);
  document.querySelector('#graficoFaturamento').innerHTML = dias.map((item) => {
    const altura = Math.max((Number(item.faturamento || 0) / max) * 100, 3);
    return `
      <div class="bar-item" title="${brl(item.faturamento)}">
        <div class="bar-value" style="height:${altura}%"></div>
        <span>${new Date(item.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
      </div>
    `;
  }).join('') || '<p>Sem pagamentos no período.</p>';
  document.querySelector('#dias').innerHTML = dias.map((item) => `
    <div class="linha"><span>${new Date(item.dia).toLocaleDateString('pt-BR')}</span><strong>${brl(item.faturamento)}</strong></div>
  `).join('');
}

function renderProdutos(produtos) {
  const max = Math.max(...produtos.map((item) => Number(item.quantidade || 0)), 1);
  document.querySelector('#graficoProdutos').innerHTML = produtos.map((item) => {
    const largura = Math.max((Number(item.quantidade || 0) / max) * 100, 4);
    return `
      <div class="rank-item">
        <div class="rank-label"><span>${item.nome}</span><strong>${item.quantidade} un</strong></div>
        <div class="rank-track"><span style="width:${largura}%"></span></div>
      </div>
    `;
  }).join('') || '<p>Sem vendas no período.</p>';
  document.querySelector('#produtos').innerHTML = produtos.map((item) => `
    <div class="linha"><span>${item.nome}</span><strong>${item.quantidade} un · ${brl(item.total)}</strong></div>
  `).join('');
}

function renderStatus(status) {
  const total = status.reduce((soma, item) => soma + Number(item.total || 0), 0) || 1;
  document.querySelector('#graficoStatus').innerHTML = status.map((item) => {
    const largura = Math.max((Number(item.total || 0) / total) * 100, 5);
    return `
      <div class="status-item">
        <span>${item.status}</span>
        <div class="status-track"><strong style="width:${largura}%">${item.total}</strong></div>
      </div>
    `;
  }).join('') || '<p>Sem pedidos no período.</p>';
}

function limparPeriodo() {
  document.querySelector('#dataInicio').value = '';
  document.querySelector('#dataFim').value = '';
  carregar().catch((error) => alert(error.message));
}

document.querySelector('#loginForm').addEventListener('submit', (event) => login(event).catch((error) => alert(error.message)));
document.querySelector('#atualizar').addEventListener('click', () => carregar().catch((error) => alert(error.message)));
document.querySelector('#filtrar').addEventListener('click', () => carregar().catch((error) => alert(error.message)));
document.querySelector('#limparPeriodo').addEventListener('click', limparPeriodo);
aplicarSessao();
carregar().catch((error) => alert(error.message));
