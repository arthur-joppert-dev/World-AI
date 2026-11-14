# World-AI

## Executar com Docker

Pré-requisitos: Docker com o plugin Docker Compose.

1. Copie `backend/.env.example` para `backend/.env` e informe sua chave `GROQ_API_KEY` e uma chave secreta em `ADMIN_API_KEY`.
2. Na raiz do projeto, execute:

   ```sh
   docker compose up --build
   ```

3. Acesse o frontend em <http://localhost:5173>. A API fica disponível em <http://localhost:3000>.

O Compose inicia o Vite em modo de desenvolvimento e a API Flask. O banco SQLite é
mantido em `instance/` no host, e o arquivo `backend/.env` é usado apenas para
fornecer variáveis ao container, sem ser incluído na imagem. Para encerrar, use
`docker compose down`.

## Publicar em um VPS Hostinger

O instalador de produção requer um VPS com Ubuntu ou Debian; hospedagem
compartilhada não executa estes containers Docker.

1. Aponte o registro DNS `A` do seu domínio para o IP do VPS. Libere as portas
   `80` e `443` no firewall da Hostinger e no firewall do servidor.
2. Conecte-se ao VPS por SSH, clone este repositório e entre na pasta do projeto.
3. Execute `chmod +x install.sh` e depois `sudo ./install.sh`.
4. Se a chave Groq ainda não estiver configurada, informe-a quando solicitado.
   O instalador gera a chave administrativa e o segredo de sessão, solicita o
   domínio e salva as configurações localmente sem exibir os segredos.
5. Acesse `https://seu-dominio`. O Caddy solicita e renova o certificado HTTPS
   automaticamente quando o DNS e as portas estiverem configurados.

O instalador usa `compose.hostinger.yaml`: o frontend é servido como arquivos
estáticos, a API roda com Gunicorn e o SQLite permanece em `instance/`. Para
atualizar uma versão depois de baixar as alterações do repositório, rode
`sudo docker compose --env-file .env.hostinger -f compose.hostinger.yaml up -d --build`.
Faça backup regular de `instance/main.db` e mantenha `backend/.env` e
`.env.hostinger` privados.

## Criar turmas

1. No site, abra **Conteúdo** e informe a chave configurada como
   `ADMIN_API_KEY`.
2. Clique em **Criar turma**, escolha o idioma, o dia da semana e o horário.
3. Clique em **Criar turma** para salvar. A turma ficará disponível para criar
   lições e vincular contas de alunos.

## Criar lições e exercícios

1. Inicie o site e clique em **Conteúdo** no topo da página.
2. Informe a chave definida em `ADMIN_API_KEY`.
3. Escolha uma turma, um nível (A1 a C2) e o idioma da lição.
4. Escreva o nome da lição e adicione exercícios de múltipla escolha ou tradução.
   Na múltipla escolha, marque o círculo ao lado da resposta correta.
5. Clique em **Criar lição**. As lições salvas aparecem ao lado do formulário
   para edição ou exclusão.

Os exercícios e as respostas corretas são guardados no banco SQLite; a área
administrativa é protegida pela chave `ADMIN_API_KEY`.

## Criar contas e praticar

1. Abra **Conteúdo**, informe a chave administrativa e selecione a turma na aba
   **Alunos**.
2. Crie uma conta com nome de usuário, e-mail e senha de pelo menos 8 caracteres.
   A conta fica vinculada à turma selecionada.
3. O aluno acessa **Área do aluno** no topo da página e entra com o nome de
   usuário ou e-mail e a senha cadastrada.
4. As lições da turma aparecem na trilha por nível. Ao responder, o aluno recebe
   feedback e ganha 10 XP por exercício concluído; o progresso é salvo no banco.

Para exercícios de tradução, o administrador pode cadastrar respostas aceitas
alternativas, uma por linha (por exemplo, formas em romaji e em japonês). A
IA avalia se a resposta escrita tem o sentido correto, mesmo quando não é
idêntica à resposta-modelo, e dá um feedback breve ao aluno. Se a IA estiver
indisponível, a resposta não é registrada e o aluno pode tentar novamente.
