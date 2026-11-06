# dev-de-soft-com-IA

## Arquitetura do projeto

Este sistema foi organizado para seguir a arquitetura indicada no guia do projeto:

- Front-end em HTML, CSS e JavaScript moderno.
- Back-end em Node.js com JavaScript.
- Banco de dados em MySQL, executado localmente com Docker.
- Separação clara entre camadas: front-end e back-end são independentes e se comunicam por API.
- Desenvolvimento com foco em TDD (Test-Driven Development).

## Estrutura

```text
/
├── frontend/
│   ├── assets/
│   ├── pages/
│   ├── styles/
│   └── scripts/
├── backend/
│   ├── src/
│   ├── tests/
│   ├── config/
│   ├── package.json
│   └── README.md
├── database/
│   ├── docker/
│   └── schema.sql
├── README.md
└── .github/
    └── copilot-instructions.md
```

O backend disponibiliza login JWT, recuperação de senha por e-mail SMTP e CRUD autenticado de salas e reservas. Os modelos, endpoints, configuração e instruções de execução estão em [backend/README.md](./backend/README.md).

Para executar os testes automatizados e gerar a documentação JSDoc, acesse `backend/` e rode `npm install`, `npm test` ou `npm run docs`. A API requer o MySQL e SMTP configurados no `.env`.

## Padrões visuais

- Paleta de cores:
  - #05060E
  - #12163A
  - #2E1A63
  - #5B2A86
  - #B14AED
- Tipografia principal: Creepster.
- Botões com bordas chanfradas.
- Campos obrigatórios com borda vermelha de 5px e texto de obrigatoriedade acima do botão.
- Links com mudança de cor ao hover.
- Acessibilidade conforme WCAG 2.2.

## Processo de desenvolvimento

- Utilizar commits semânticos.
- Criar features com base em requisitos claros.
- Quando uma regra não estiver definida, questionar antes de assumir.
- Manter a interface consistente com os padrões visuais e acessibilidade definidos no projeto.
