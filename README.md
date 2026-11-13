# World-AI

## Executar com Docker

Pré-requisitos: Docker com o plugin Docker Compose.

1. Copie `backend/.env.example` para `backend/.env` e informe sua chave `GROQ_API_KEY`.
2. Na raiz do projeto, execute:

   ```sh
   docker compose up --build
   ```

3. Acesse o frontend em <http://localhost:5173>. A API fica disponível em <http://localhost:3000>.

O Compose inicia o Vite em modo de desenvolvimento e a API Flask. O banco SQLite é
mantido em `instance/` no host, e o arquivo `backend/.env` é usado apenas para
fornecer variáveis ao container, sem ser incluído na imagem. Para encerrar, use
`docker compose down`.
