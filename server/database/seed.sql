insert into produtos (nome, descricao, preco, categoria, disponivel) values
('Burger da Casa', 'Blend artesanal, queijo, salada e molho especial.', 34.90, 'cozinha', true),
('Porção de Batata', 'Batata crocante com cheddar e bacon.', 28.90, 'cozinha', true),
('Chopp Pilsen', 'Caneca gelada 500ml.', 12.90, 'bar', true),
('Caipirinha', 'Limão, cachaça e gelo.', 18.90, 'bar', true),
('Brownie com Sorvete', 'Brownie quente com sorvete de creme.', 22.90, 'sobremesa', true)
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
