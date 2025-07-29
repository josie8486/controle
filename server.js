const express = require('express');
const app = express();
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Parser } = require('json2csv');
const session = require('express-session');

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'senha-secreta',
  resave: false,
  saveUninitialized: true
}));

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Middleware de autenticação
function auth(req, res, next) {
  if (req.session && req.session.logado) return next();
  return res.redirect('/login.html');
}

// Rotas de login
app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'admin' && senha === '1234') {
    req.session.logado = true;
    return res.redirect('/');
  }
  return res.redirect('/login.html?erro=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

app.get('/', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/upload', auth, upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/animais', auth, async (req, res) => {
  const { anilha, nome, sexo, nascimento, raca_id, cor, criador, proprietario, pai_id, mae_id, foto, observacoes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO animais (anilha, nome, sexo, nascimento, raca_id, cor, criador, proprietario, pai_id, mae_id, foto, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [anilha, nome, sexo, nascimento, raca_id, cor, criador, proprietario, pai_id, mae_id, foto, observacoes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar animal' });
  }
});

app.get('/animais', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT a.*, r.nome as raca_nome FROM animais a LEFT JOIN racas r ON a.raca_id = r.id ORDER BY a.id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar animais' });
  }
});

app.get('/racas', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM racas ORDER BY nome');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar raças' });
  }
});

app.post('/racas', auth, async (req, res) => {
  const { nome } = req.body;
  try {
    const result = await pool.query('INSERT INTO racas (nome) VALUES ($1) RETURNING *', [nome]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar raça' });
  }
});

app.get('/exportar', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM animais ORDER BY id');
    const json2csv = new Parser();
    const csv = json2csv.parse(result.rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('animais_exportados.csv');
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao exportar dados' });
  }
});

app.get('/animal/:anilha', auth, async (req, res) => {
  const { anilha } = req.params;
  try {
    const result = await pool.query('SELECT * FROM animais WHERE anilha = $1', [anilha]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Animal não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar animal' });
  }
});

async function buscarGenealogia(id, nivel = 0, maxNivel = 3) {
  if (!id || nivel > maxNivel) return null;
  const result = await pool.query('SELECT * FROM animais WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const animal = result.rows[0];
  animal.pai = await buscarGenealogia(animal.pai_id, nivel + 1, maxNivel);
  animal.mae = await buscarGenealogia(animal.mae_id, nivel + 1, maxNivel);
  return animal;
}

app.get('/genealogia/:id', auth, async (req, res) => {
  try {
    const arvore = await buscarGenealogia(parseInt(req.params.id));
    res.json(arvore);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar genealogia' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
