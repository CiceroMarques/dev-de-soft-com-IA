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
npm start
```

A API fica disponível em `http://localhost:3000`. As configurações do banco podem ser alteradas no arquivo `.env`.

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
| `GET` | `/api/salas` | Lista as salas |
| `GET` | `/api/salas/:id` | Busca uma sala |
| `POST` | `/api/salas` | Cria uma sala; retorna `201` |
| `PUT` | `/api/salas/:id` | Atualiza todos os campos da sala |
| `DELETE` | `/api/salas/:id` | Remove a sala; retorna `204` |

IDs inválidos retornam `400`, salas inexistentes retornam `404` e dados inválidos retornam `400` com a lista de erros.

## Testes automatizados

Execute na pasta `backend`:

```powershell
npm test
```

Os testes exercitam os endpoints HTTP com um repositório em memória e cobrem também a conversão e persistência de dados do repositório MySQL mockado; não exigem que o banco esteja iniciado.
