# Backend Reserve.me

API REST em Node.js, Express e MySQL para gerenciar as salas da escola.

## Executar localmente

Na raiz do repositório, inicie o MySQL:

```powershell
docker compose -f database/docker/docker-compose.yml up -d
```

O arquivo `database/schema.sql` é executado automaticamente quando o volume do MySQL é criado pela primeira vez. Se o volume já existir, aplique o schema manualmente:

```powershell
docker compose -f database/docker/docker-compose.yml exec -T mysql mysql -u reserve_me_user -preserve_me_password reserve_me < database/schema.sql
```

Na pasta `backend`, instale as dependências, configure as variáveis de ambiente e inicie a API:

```powershell
Copy-Item .env.example .env
npm install
npm run migrate:retention
npm start
```

A migração é segura para bancos existentes: preserva salas e reservas, adiciona os indicadores de atividade, amplia as situações permitidas e desativa reservas já canceladas. Pode ser executada novamente sem duplicar colunas. A API fica disponível em `http://localhost:3000`. As configurações do banco podem ser alteradas no arquivo `.env`.

## Login e recuperação de senha

Configure no `.env`:

- `JWT_SECRET`: segredo aleatório de pelo menos 32 caracteres. Gere com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- `FRONTEND_URL`: origem do front-end, incluindo protocolo e porta, por exemplo `http://localhost:5500`. O backend também permite `localhost`, `127.0.0.1` e `::1` nessa mesma origem/porta para facilitar o Live Server local.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`: credenciais do provedor de e-mail. São opcionais para testar login; sem SMTP, recuperação responde `503`.
- `SEED_USER_NAME`, `SEED_USER_EMAIL` e `SEED_USER_PASSWORD`: dados da primeira conta de gerente; senha com pelo menos 12 caracteres e até 72 bytes.

Crie a primeira conta após configurar o `.env`:

```powershell
npm run seed:user
```

O seed não altera a senha se o e-mail já existir. Nunca versione o `.env` nem use credenciais de exemplo em produção.

Para popular o banco com três salas, cinco reservas futuras e essa conta de teste, configure os campos `SEED_USER_*` no `.env` e execute:

```powershell
npm run seed:demo
```

O seed é repetível e não altera senhas existentes nem duplica as reservas de demonstração. Ao criar a conta, ele mostra a senha definida no `.env`; use-a na tela de login. Com a configuração padrão, o e-mail é `demo@escola.local`. Altere a senha de demonstração antes de expor a API a qualquer rede.

### Endpoints públicos

| Método | Rota | Resultado |
|---|---|---|
| `POST` | `/api/auth/login` | Valida e-mail e senha e retorna JWT com validade de 15 minutos |
| `POST` | `/api/auth/forgot-password` | Solicita por e-mail um link de uso único, válido por 30 minutos |
| `POST` | `/api/auth/reset-password` | Define uma nova senha usando o token recebido por e-mail |

Exemplo de login:

```json
{ "email": "gerente@example.com", "password": "senha-configurada-no-seed" }
```

A resposta contém `accessToken`, `expiresIn` e informações públicas do usuário. Para usar as rotas de salas e reservas, envie o JWT no cabeçalho `Authorization` usando o esquema Bearer. Sem token válido, essas rotas retornam `401`.

A tela de login envia os dados para a API e mantém o token somente na sessão atual do navegador. Sirva o front-end via HTTP (por exemplo, VS Code Live Server na porta 5500); abrir o HTML diretamente como `file://` não permite a chamada CORS ao backend.

Para redefinir a senha, envie `POST /api/auth/reset-password` com `{ "token": "<token do link>", "password": "<nova senha>" }`. O endpoint não revela se um e-mail existe; tokens são armazenados somente como hash, expiram e só podem ser usados uma vez. O front-end precisa implementar a página `redefinir-senha.html` para capturar o token do link enviado e chamar esse endpoint.

Os endpoints públicos têm limitação de tentativas por endereço IP. A limitação padrão usa memória local, adequada a uma instância de desenvolvimento; implantação com múltiplas instâncias deve configurar armazenamento compartilhado.

No momento, todas as contas autenticadas têm acesso às mesmas operações de salas e reservas. Papéis e permissões diferentes (por exemplo, gerente aprovar solicitações) não fazem parte deste escopo. JWTs já emitidos podem continuar válidos por até 15 minutos após uma redefinição de senha.

## Modelo de sala

```json
{
  "nome": "Sala de reuniões",
  "andar": 2,
  "capacidade": 12,
  "recursos": ["Projetor", "Quadro branco"]
}
```

- `nome`: texto obrigatório com até 120 caracteres.
- `andar`: número inteiro; valores negativos podem representar subsolos e zero, o térreo.
- `capacidade`: número inteiro positivo.
- `recursos`: lista de textos não vazios; pode ser uma lista vazia.

## Endpoints

| Método | Rota | Resultado |
|---|---|---|
| `GET` | `/api/salas` | Lista salas ativas |
| `GET` | `/api/salas?includeInactive=true` | Inclui salas desativadas para consultas históricas |
| `GET` | `/api/salas/:id` | Busca uma sala |
| `POST` | `/api/salas` | Cria uma sala; retorna `201` |
| `PUT` | `/api/salas/:id` | Atualiza todos os campos da sala |
| `DELETE` | `/api/salas/:id` | Desativa a sala sem removê-la do banco; retorna `204` |

IDs inválidos retornam `400`, salas inexistentes retornam `404` e dados inválidos retornam `400` com a lista de erros.
O `DELETE` de sala é idempotente. Salas desativadas permanecem no banco e podem ser consultadas com `includeInactive=true`, mas não aparecem nas listas comuns nem podem ser selecionadas em novas reservas.

## Reservas

Uma reserva referencia uma sala pelo seu identificador:

```json
{
  "sala": 1,
  "data": "2026-12-10",
  "inicio": "09:00",
  "fim": "10:30",
  "responsavel": "Ana Silva",
  "finalidade": "Reunião de equipe",
  "situacao": "Pendente"
}
```

- `sala`: ID inteiro de uma sala existente.
- `data`: data válida no formato `AAAA-MM-DD`.
- `inicio` e `fim`: horários no formato `HH:mm`; o horário final deve ser posterior ao inicial.
- `responsavel`: texto obrigatório com até 120 caracteres.
- `finalidade`: texto obrigatório com até 500 caracteres.
- `situacao`: `Pendente`, `Aprovada`, `Cancelada` ou `Finalizada`. Se omitida na criação, começa como `Pendente`. Reservas pendentes e aprovadas bloqueiam horários; canceladas e finalizadas não.
- `ativo`: indicador de disponibilidade do registro. Reservas Canceladas e Finalizadas ficam desativadas automaticamente; também podem ser desativadas pelo endpoint de exclusão lógica.

| Método | Rota | Resultado |
|---|---|---|
| `GET` | `/api/reservas` | Lista reservas ativas por data e horário |
| `GET` | `/api/reservas?includeInactive=true` | Inclui reservas canceladas, finalizadas e desativadas para consultas históricas |
| `GET` | `/api/reservas/:id` | Busca uma reserva |
| `POST` | `/api/reservas` | Cria uma reserva; retorna `201` ou `409` em conflito de horário |
| `PUT` | `/api/reservas/:id` | Atualiza todos os campos; retorna `409` se gerar conflito |
| `DELETE` | `/api/reservas/:id` | Desativa a reserva sem apagar seu histórico; retorna `204` |

O `DELETE` de reserva é idempotente. Reservas canceladas e finalizadas têm `ativo: false` e podem ser consultadas com `includeInactive=true`. Nenhuma sala ou reserva é removida fisicamente por esses endpoints.

A função `existeConflito(novaReserva, reservas)` detecta sobreposição quando sala e data coincidem. Dois horários que apenas encostam (por exemplo, uma reserva termina às 10:00 e a seguinte começa às 10:00) não conflitam. Reservas canceladas, finalizadas, desativadas e a própria reserva durante atualização são ignoradas. A API responde `409` ao criar ou atualizar uma reserva que conflite.

A função `cabeNaSala(quantidadeAlunos, salaId, salas)` retorna `true` quando a sala existe e sua capacidade é maior ou igual à quantidade de alunos. Para quantidade acima da capacidade, identificador inválido ou sala inexistente, retorna `false`.

## Testes automatizados

Execute na pasta `backend`:

```powershell
npm test
```

Os testes exercitam os endpoints HTTP com repositórios em memória e cobrem a conversão e persistência de dados dos repositórios MySQL mockados; não exigem que o banco esteja iniciado.

## Documentação JSDoc

As funções, parâmetros, retornos e fluxos de autenticação estão documentados com JSDoc. Gere a documentação HTML executando:

```powershell
npm run docs
```

Os arquivos gerados ficam em `backend/docs/api/`; a referência principal é [backend/docs/api/index.html](./docs/api/index.html).
