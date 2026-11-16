# HelpDesk

Helpdesk com duas telas. O cliente abre um chamado e acompanha a resposta. O atendente trabalha numa mesa com fila, base de artigos e rascunho da IA.

O backend é NestJS na porta 4000. O frontend é Next.js na porta 3000. O banco é MySQL, acessado pelo Prisma 7.

## Como rodar

É preciso ter Node.js, npm e um MySQL local.

Na pasta `backend`, crie o arquivo `.env`. Ele não entra no git.

```env
DATABASE_URL="mysql://USUARIO:SENHA@localhost:3306/helpdesk"
JWT_SECRET="uma frase longa, sem espaços"
OPENAI_API_KEY="chave da OpenAI"
PORT=4000
```

`JWT_SECRET` assina o token de login. `OPENAI_API_KEY` só é usada quando a IA redige uma resposta. Sem ela, o chamado ainda é salvo e cai na fila.

Crie o banco `helpdesk` no MySQL e instale as dependências:

```bash
cd backend
npm install
npx prisma migrate dev --config prisma7.config.ts
npx prisma db seed --config prisma7.config.ts
npm run dev
```

O `--config prisma7.config.ts` é obrigatório. O arquivo de configuração do Prisma neste projeto não usa o nome padrão `prisma.config.ts`.

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas

O seed cria o atendente de demonstração:

| Email | Senha | Papel |
| --- | --- | --- |
| atendente@helpdesk.local | atendente123 | ATENDENTE |

O cadastro público cria apenas cliente. Na tela de login, "Não tem conta? Cadastre-se" grava um `CLIENTE` e já entra na página `/cliente`.

Rodar o seed de novo não duplica o atendente. Se a conta já existe, o seed devolve o nome, a senha e o papel conhecidos.

## As telas

`/login` guarda no navegador o token e o papel. Atendente vai para `/`. Cliente vai para `/cliente`.

`/` é a mesa. A coluna da esquerda é a fila, com filtros Abertos, Novos, Resolvidos e Todos, e três contagens. O centro é o chamado. A direita é a base de artigos. No celular as três viram abas.

`/cliente` lista os chamados da pessoa logada, abre um novo e deixa escrever de novo enquanto o chamado não está encerrado.

Sair apaga a sessão e volta ao login.

## Como um chamado anda

Cada chamado tem um status. A passagem de um para o outro é regra do backend, não só da tela.

| Status | Significado |
| --- | --- |
| NOVO | Aberto, ainda sem triagem. O criar atual não permanece aqui. |
| COM_IA | Estado curto, gravado no instante em que o chamado nasce, enquanto a IA redige. |
| NA_FILA | A IA não soube responder com a base publicada. Espera um atendente. |
| EM_ATENDIMENTO | Um atendente assumiu, ou o cliente respondeu depois de uma resposta já enviada. |
| AGUARDANDO_CLIENTE | A resposta, da IA ou de uma pessoa, já foi enviada. |
| RESOLVIDO | Encerrado. O histórico continua na tela. |

O fluxo normal:

1. O cliente envia assunto e mensagem. O chamado nasce `COM_IA`, com a mensagem marcada como `cliente`.
2. A IA lê só os artigos publicados. Se escrever uma resposta, ela é salva como `ia` e o status vai para `AGUARDANDO_CLIENTE`.
3. Se a IA responder exatamente "Não sei responder com a base publicada.", ou se a chamada falhar, nenhuma mensagem da IA é salva e o status vai para `NA_FILA`. O chamado já estava no banco, então essa falha não devolve erro 500.
4. O atendente assume a partir de `NOVO` ou `NA_FILA`. O status vai para `EM_ATENDIMENTO`. Com token de atendente, o `assigneeId` guarda quem assumiu. Cliente logado recebe 403.
5. Em `EM_ATENDIMENTO` ou `AGUARDANDO_CLIENTE` o atendente pode mandar quantas mensagens quiser. Cada uma fica como `atendente` e o status vai para `AGUARDANDO_CLIENTE`. "Sugerir" só preenche a caixa. Não grava nada.
6. O cliente também escreve nesses dois status, e ainda em `NA_FILA`, por `POST /tickets/:id/messages`. Se o status era `AGUARDANDO_CLIENTE`, volta para `EM_ATENDIMENTO`. Chamado resolvido não aceita mensagem nova.
7. Resolver só sai de `EM_ATENDIMENTO` ou `AGUARDANDO_CLIENTE`.

As três contagens da mesa:

- Abertos: tudo que não está `RESOLVIDO`.
- Respondidos pela IA: tem mensagem `ia` e nenhuma mensagem `atendente`.
- Atendidos por uma pessoa: tem ao menos uma mensagem `atendente`.

Os dois últimos grupos não se misturam. Um chamado resolvido sai de Abertos e continua contando no grupo em que foi atendido.

## Decisões

**Dois processos.** A API e a tela sobem separadas. O frontend fala com `http://localhost:4000`. O Nest libera CORS para o navegador local.

**Prisma 7 com MySQL.** O client é gerado em `backend/src/generated/prisma`. A conexão usa o adapter MariaDB, que também fala com MySQL. Por isso o `PrismaClient` recebe `new PrismaMariaDb(DATABASE_URL)` tanto no `PrismaService` quanto no seed. Os comandos do Prisma passam por `prisma7.config.ts`.

**Autor da mensagem é um texto.** Cada mensagem guarda `cliente`, `atendente` ou `ia`. Não há usuário ligado à mensagem. Isso deixa a IA e o histórico antigos simples: a tela sabe quem falou sem precisar de uma conta para a IA.

**Quem abriu e quem assumiu são opcionais.** `openerId` e `assigneeId` podem ficar vazios. O chamado existia antes do login, e as colunas foram adicionadas sem obrigar os registros antigos. Com token, criar grava o `openerId` e assumir grava o `assigneeId`.

**Papel não se escolhe no cadastro.** `POST /auth/register` ignora qualquer papel enviado e grava `CLIENTE`. O único atendente de demonstração nasce no seed. A senha é hash bcrypt com custo 10. A resposta de usuário nunca inclui `passwordHash`.

**Login devolve um JWT de 7 dias.** O corpo do token é o id (`sub`) e o papel. O segredo é lido do `.env` na hora de assinar e na hora de verificar, não fica gravado na configuração do módulo. Sem `JWT_SECRET`, login e leitura do token falham com uma mensagem clara.

**A base publicada é a fonte da resposta automática.** `GET /articles` devolve só o que está publicado. A mesa pede `GET /articles?all=1` para também mostrar os despublicados. Ao abrir um chamado, a IA usa a lista publicada. O modelo é `gpt-4o-mini`. O prompt pede um parágrafo curto em português e, quando nenhum artigo responde ou a base está vazia, a frase exata que manda o chamado para a fila. "Sugerir" devolve o texto para a caixa e não grava. Com artigos publicados, usa a mesma base. Com a base vazia, redige a partir do assunto e da conversa.

**Validação na borda.** Um `ValidationPipe` global descarta campo desconhecido e transforma o corpo. Os DTOs de cadastro, login, chamado e artigo declaram o que cada rota aceita. Email é aparado e passado para minúsculas. Senha tem no mínimo 6 caracteres e não é aparada, para não mudar o que a pessoa digitou.

**A sessão fica no navegador.** O token e o usuário ficam no `localStorage`. Toda chamada do frontend manda `Authorization: Bearer ...` quando existe sessão. A mesa e a página do cliente recusam a rota errada: atendente não permanece em `/cliente`, cliente não permanece na mesa.

## Rotas

Autenticação:

- `POST /auth/register` cria um cliente.
- `POST /auth/login` devolve `{ token, user }`.

Chamados:

- `POST /tickets` exige login e grava quem abriu. Sem token, responde 401.
- `GET /tickets` exige login. Cliente recebe os próprios chamados. Atendente recebe todos, do mais novo para o mais antigo.
- `GET /tickets/metrics` devolve `{ open, answeredByAi, handledByPerson }`. Esta rota fica declarada antes de `GET /tickets/:id`, senão a palavra `metrics` seria lida como id.
- `GET /tickets/:id` devolve um chamado.
- `POST /tickets/:id/assume` assume. Cliente logado recebe 403.
- `POST /tickets/:id/reply` envia a resposta do atendente.
- `POST /tickets/:id/suggest` devolve `{ draft }` e não salva.
- `POST /tickets/:id/messages` acrescenta a mensagem do cliente.
- `POST /tickets/:id/resolve` encerra.

Artigos:

- `GET /articles` lista os publicados.
- `GET /articles?all=1` lista todos.
- `POST /articles` cria, publicado por padrão.
- `POST /articles/:id/publish` e `POST /articles/:id/unpublish` mudam a visibilidade para a IA.
- `PATCH /articles/:id` e `DELETE /articles/:id` editam e apagam.

## Quem pode chamar o quê

Sem token, a resposta é 401. Com token do papel errado, a resposta é 403.

Cliente lista e abre só os chamados com o próprio `openerId`, e só ele escreve em `POST /tickets/:id/messages`. Atendente lista tudo, vê as métricas, assume, responde, sugere, resolve e mexe na base, inclusive em `GET /articles?all=1`.

`GET /articles` sem `all` continua aberto. Essa é a lista publicada que a IA lê. Abrir chamado exige login, então todo chamado novo fica com dono.
