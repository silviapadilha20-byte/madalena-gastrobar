const API = 'http://localhost:3000';
const brl = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

async function carregar() {
  const resposta = await fetch(`${API}/relatorios`);
  const dados = await resposta.json();
  document.querySelector('#faturamento').textContent = brl(dados.faturamento_total);
  document.querySelector('#ticket').textContent = brl(dados.ticket_medio);
  document.querySelector('#tempo').textContent = `${Number(dados.tempo_medio_preparo || 0)} min`;
  document.querySelector('#produtos').innerHTML = (dados.produtos_mais_vendidos || []).map((item) => `
    <div class="linha"><span>${item.nome}</span><strong>${item.quantidade} un · ${brl(item.total)}</strong></div>
  `).join('') || '<p>Sem vendas registradas.</p>';
  document.querySelector('#dias').innerHTML = (dados.faturamento_por_dia || []).map((item) => `
    <div class="linha"><span>${new Date(item.dia).toLocaleDateString('pt-BR')}</span><strong>${brl(item.faturamento)}</strong></div>
  `).join('') || '<p>Sem pagamentos registrados.</p>';
}

document.querySelector('#atualizar').addEventListener('click', carregar);
carregar();
