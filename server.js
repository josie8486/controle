
// Sistema de controle genealógico de animais de raça (completo para Render)
// Node.js + Express + PostgreSQL + Frontend básico

const express = require('express');
const app = express();
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/animais', async (req, res) => {
  const { anilha, nome, sexo, nascimento, raca, cor, criador, proprietario, pai_id, mae_id, foto, observacoes } = req.body;
  try {
    const result = await pool.query(
      \`INSERT INTO animais (anilha, nome, sexo, nascimento, raca, cor, criador, proprietario, pai_id, mae_id, foto, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *\`,
      [anilha, nome, sexo, nascimento, raca, cor, criador, proprietario, pai_id, mae_id, foto, observacoes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar animal' });
  }
});

app.get('/animais', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM animais ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar animais' });
  }
});

app.get('/animal/:anilha', async (req, res) => {
  const { anilha } = req.params;
  try {
    const result = await pool.query('SELECT * FROM animais WHERE anilha = $1', [anilha]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Animal não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar animal' });
  }
});

app.listen(PORT, () => {
  console.log(\`Servidor rodando na porta \${PORT}\`);
});
