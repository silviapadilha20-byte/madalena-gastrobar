insert into produtos (nome, descricao, preco, preco_promocional, categoria, imagem_url, disponivel) values
('Burger da Casa', 'Blend artesanal, queijo, salada e molho especial.', 34.90, 29.90, 'cozinha', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', true),
('Porção de Batata', 'Batata crocante com cheddar e bacon.', 28.90, null, 'cozinha', 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=900&q=80', true),
('Chopp Pilsen', 'Caneca gelada 500ml.', 12.90, null, 'bar', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80', true),
('Caipirinha', 'Limão, cachaça e gelo.', 18.90, null, 'bar', 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=900&q=80', true),
('Brownie com Sorvete', 'Brownie quente com sorvete de creme.', 22.90, 19.90, 'sobremesa', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80', true)
on conflict (nome) do nothing;

insert into mesas (numero, status) values
(1, 'livre'),
(2, 'livre'),
(3, 'livre'),
(4, 'livre'),
(5, 'livre'),
(6, 'livre')
on conflict (numero) do nothing;

insert into configuracoes_pagamento (id, pix_ativo, cartao_ativo, dinheiro_ativo, gateway_nome)
values (1, true, true, true, 'manual')
on conflict (id) do nothing;
