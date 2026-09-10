import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "segredo-av1-av2";
const uploadsDir = path.join(__dirname, "uploads");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));

const produtos = [
  {
    id: 1,
    nome: "Teclado Mecânico",
    categoria: "Periféricos",
    preco: 299.9,
    estoque: 15,
    descricao: "Teclado RGB com switches mecânicos",
    imagem: null
  },
  {
    id: 2,
    nome: "Mouse Gamer",
    categoria: "Periféricos",
    preco: 189.9,
    estoque: 22,
    descricao: "Mouse com 7 botões programáveis",
    imagem: null
  }
];

const usuarios = [];

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API de Produtos",
      version: "1.0.0",
      description: "API REST para cadastro de produtos, autenticação de usuários, upload de imagens e documentação via Swagger."
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        Usuario: {
          type: "object",
          required: ["id", "nome", "email"],
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            email: { type: "string" },
            senha: { type: "string", description: "A senha fica armazenada em hash" }
          }
        },
        Produto: {
          type: "object",
          required: ["id", "nome", "categoria", "preco", "estoque"],
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            categoria: { type: "string" },
            preco: { type: "number" },
            estoque: { type: "integer" },
            descricao: { type: "string" },
            imagem: { type: ["string", "null"] }
          }
        }
      }
    }
  },
  apis: ["./server.js"]
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const gerarId = (lista) => {
  if (!lista.length) return 1;
  return Math.max(...lista.map((item) => item.id)) + 1;
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token de autenticação ausente." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    const extensao = path.extname(file.originalname);
    const nomeArquivo = `${Date.now()}-${Math.random().toString(16).slice(2)}${extensao}`;
    callback(null, nomeArquivo);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Apenas arquivos de imagem são permitidos."));
  }
});

app.get("/", (req, res) => {
  res.json({
    mensagem: "Servidor Express funcionando!",
    disciplina: "Desenvolvimento de Websites",
    bimestre: "3º bimestre",
    tema: "Catálogo de produtos"
  });
});

/**
 * @openapi
 * /usuarios/register:
 *   post:
 *     summary: Cadastro de usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha]
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário cadastrado com sucesso
 */
app.post("/usuarios/register", (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ message: "Nome, email e senha são obrigatórios." });
  }

  const usuarioExistente = usuarios.find(
    (usuario) => usuario.email.toLowerCase() === String(email).toLowerCase()
  );

  if (usuarioExistente) {
    return res.status(409).json({ message: "Email já cadastrado." });
  }

  const senhaHash = bcrypt.hashSync(senha, 10);
  const novoUsuario = {
    id: gerarId(usuarios),
    nome,
    email,
    senha: senhaHash
  };

  usuarios.push(novoUsuario);

  const { senha: _senha, ...usuarioSemSenha } = novoUsuario;
  res.status(201).json({
    message: "Usuário cadastrado com sucesso",
    usuario: usuarioSemSenha
  });
});

/**
 * @openapi
 * /usuarios/login:
 *   post:
 *     summary: Login do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 */
app.post("/usuarios/login", (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: "Email e senha são obrigatórios." });
  }

  const usuario = usuarios.find(
    (item) => item.email.toLowerCase() === String(email).toLowerCase()
  );

  if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  const { senha: _senha, ...usuarioSemSenha } = usuario;
  res.json({
    message: "Login realizado com sucesso",
    token,
    usuario: usuarioSemSenha
  });
});

app.get("/usuarios/perfil", authMiddleware, (req, res) => {
  const usuario = usuarios.find((item) => item.id === req.usuario.id);

  if (!usuario) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const { senha: _senha, ...usuarioSemSenha } = usuario;
  res.json({ usuario: usuarioSemSenha });
});

/**
 * @openapi
 * /produtos:
 *   get:
 *     summary: Lista todos os produtos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de produtos
 *   post:
 *     summary: Cadastra um novo produto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Produto'
 *     responses:
 *       201:
 *         description: Produto cadastrado com sucesso
 */
app.get("/produtos", authMiddleware, (req, res) => {
  res.json(produtos);
});

app.post("/produtos", authMiddleware, (req, res) => {
  const { nome, categoria, preco, estoque, descricao } = req.body;

  if (!nome || !categoria || preco === undefined || estoque === undefined) {
    return res.status(400).json({
      message: "Nome, categoria, preço e estoque são obrigatórios."
    });
  }

  const novoProduto = {
    id: gerarId(produtos),
    nome,
    categoria,
    preco: Number(preco),
    estoque: Number(estoque),
    descricao: descricao || "",
    imagem: null
  };

  produtos.push(novoProduto);

  res.status(201).json({
    message: "Produto cadastrado com sucesso",
    produto: novoProduto
  });
});

app.get("/produtos/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const produto = produtos.find((item) => item.id === id);

  if (!produto) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }

  res.json(produto);
});

app.put("/produtos/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const index = produtos.findIndex((produto) => produto.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }

  const produtoAtual = produtos[index];
  const produtoAtualizado = {
    ...produtoAtual,
    ...req.body,
    id: produtoAtual.id,
    preco: req.body.preco !== undefined ? Number(req.body.preco) : produtoAtual.preco,
    estoque: req.body.estoque !== undefined ? Number(req.body.estoque) : produtoAtual.estoque
  };

  produtos[index] = produtoAtualizado;

  res.json({
    message: "Produto atualizado com sucesso",
    produto: produtoAtualizado
  });
});

app.delete("/produtos/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const index = produtos.findIndex((produto) => produto.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }

  const [produtoRemovido] = produtos.splice(index, 1);

  res.json({
    message: "Produto excluído com sucesso",
    produto: produtoRemovido
  });
});

app.post("/produtos/:id/upload", authMiddleware, upload.single("imagem"), (req, res) => {
  const id = Number(req.params.id);
  const index = produtos.findIndex((produto) => produto.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Nenhuma imagem foi enviada." });
  }

  produtos[index].imagem = `/uploads/${req.file.filename}`;

  res.json({
    message: "Imagem enviada com sucesso",
    produto: produtos[index]
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Arquivo muito grande. O máximo é 5MB." });
    }
  }

  if (error.message === "Apenas arquivos de imagem são permitidos.") {
    return res.status(400).json({ message: error.message });
  }

  return res.status(500).json({ message: "Erro interno do servidor." });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

export { app, produtos, usuarios };
export default app;
