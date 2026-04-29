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
  const dados = await api('/relatorios');
  document.querySelector('#faturamento').textContent = brl(dados.faturamento_total);
  document.querySelector('#ticket').textContent = brl(dados.ticket_medio);
  document.querySelector('#tempo').textContent = `${Number(dados.tempo_medio_preparo || 0)} min`;
  document.querySelector('#entrega').textContent = `${Number(dados.tempo_medio_entrega || 0)} min`;
  document.querySelector('#produtos').innerHTML = (dados.produtos_mais_vendidos || []).map((item) => `
    <div class="linha"><span>${item.nome}</span><strong>${item.quantidade} un · ${brl(item.total)}</strong></div>
  `).join('') || '<p>Sem vendas registradas.</p>';
  document.querySelector('#dias').innerHTML = (dados.faturamento_por_dia || []).map((item) => `
    <div class="linha"><span>${new Date(item.dia).toLocaleDateString('pt-BR')}</span><strong>${brl(item.faturamento)}</strong></div>
  `).join('') || '<p>Sem pagamentos registrados.</p>';
}

document.querySelector('#loginForm').addEventListener('submit', (event) => login(event).catch((error) => alert(error.message)));
document.querySelector('#atualizar').addEventListener('click', () => carregar().catch((error) => alert(error.message)));
aplicarSessao();
carregar().catch((error) => alert(error.message));
