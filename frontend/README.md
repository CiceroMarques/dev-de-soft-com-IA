# Frontend

Estrutura do frontend do sistema Reserve.me.

- pages/: páginas HTML de login, painel, salas, reservas e termos
- styles/: estilos globais e componentes do painel
- scripts/: validação, autenticação e integração com a API

Após entrar, o usuário é direcionado ao painel, que oferece navegação para o
cadastro de salas e o registro de reservas. As páginas do painel exigem uma
sessão JWT e enviam os dados para a API autenticada do backend.
Salas desativadas e reservas canceladas/finalizadas permanecem no histórico;
apenas salas ativas aparecem como opção para novas reservas.
