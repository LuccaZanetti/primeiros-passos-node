import test from 'node:test';
import assert from 'node:assert/strict';
import { app, usuarios, produtos } from './server.js';

const startServer = async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.on('listening', resolve));
  return server;
};

const request = async (method, path, body, token) => {
  const server = await startServer();
  const port = server.address().port;
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    ...(payload ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const response = await fetch(`http://localhost:${port}${path}`, {
      method,
      headers,
      body: payload,
    });

    const data = await response.json().catch(() => ({}));
    return { response, data, server };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

test('GET / deve responder com mensagem do servidor', async () => {
  const { response, data } = await request('GET', '/');

  assert.equal(response.status, 200);
  assert.ok(data.mensagem);
  assert.equal(data.disciplina, 'Desenvolvimento de Websites');
});

test('POST /usuarios/register cadastra usuário', async () => {
  const { response, data } = await request('POST', '/usuarios/register', {
    nome: 'João Silva',
    email: 'joao@teste.com',
    senha: '123456',
  });

  assert.equal(response.status, 201);
  assert.equal(data.message, 'Usuário cadastrado com sucesso');
  assert.equal(data.usuario.email, 'joao@teste.com');
  assert.ok(usuarios.length >= 1);
});

test('POST /usuarios/login autentica usuário e retorna token', async () => {
  const { response, data } = await request('POST', '/usuarios/login', {
    email: 'joao@teste.com',
    senha: '123456',
  });

  assert.equal(response.status, 200);
  assert.equal(data.message, 'Login realizado com sucesso');
  assert.ok(data.token);
});

test('GET /produtos exige autenticação', async () => {
  const { response, data } = await request('GET', '/produtos');

  assert.equal(response.status, 401);
  assert.equal(data.message, 'Token de autenticação ausente.');
});

test('POST /produtos cadastra produto autenticado', async () => {
  const login = await request('POST', '/usuarios/login', {
    email: 'joao@teste.com',
    senha: '123456',
  });

  const { response, data } = await request('POST', '/produtos', {
    nome: 'Monitor 24',
    categoria: 'Eletrônicos',
    preco: 899.99,
    estoque: 8,
    descricao: 'Monitor Full HD de 24 polegadas',
  }, login.data.token);

  assert.equal(response.status, 201);
  assert.equal(data.message, 'Produto cadastrado com sucesso');
  assert.equal(data.produto.nome, 'Monitor 24');
  assert.ok(produtos.length >= 1);
});

test('GET /produtos retorna lista de produtos', async () => {
  const login = await request('POST', '/usuarios/login', {
    email: 'joao@teste.com',
    senha: '123456',
  });

  const { response, data } = await request('GET', '/produtos', null, login.data.token);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
});

test('GET /produtos/:id retorna produto específico', async () => {
  const login = await request('POST', '/usuarios/login', {
    email: 'joao@teste.com',
    senha: '123456',
  });

  const { response, data } = await request('GET', '/produtos/1', null, login.data.token);

  assert.equal(response.status, 200);
  assert.equal(data.id, 1);
  assert.ok(data.nome);
});

test('PUT /produtos/:id atualiza o registro', async () => {
  const login = await request('POST', '/usuarios/login', {
    email: 'joao@teste.com',
    senha: '123456',
  });

  const { response, data } = await request('PUT', '/produtos/1', {
    nome: 'Monitor 27',
    categoria: 'Eletrônicos',
    preco: 1099.99,
    estoque: 4,
    descricao: 'Monitor Ultra Wide 27 polegadas',
  }, login.data.token);

  assert.equal(response.status, 200);
  assert.equal(data.message, 'Produto atualizado com sucesso');
  assert.equal(data.produto.nome, 'Monitor 27');
});

test('DELETE /produtos/:id remove o registro', async () => {
  const login = await request('POST', '/usuarios/login', {
    email: 'joao@teste.com',
    senha: '123456',
  });

  const { response, data } = await request('DELETE', '/produtos/1', null, login.data.token);

  assert.equal(response.status, 200);
  assert.equal(data.message, 'Produto excluído com sucesso');
});
