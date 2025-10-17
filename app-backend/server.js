
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const {
  DB_HOST = 'localhost',
  DB_USER = 'et_user',
  DB_PASSWORD = 'et_pass',
  DB_NAME = 'expensetracker',
  JWT_SECRET = 'supersecretkey'
} = process.env;

async function getConnection() {
  return await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  });
}

async function migrate() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await conn.end();
  const c = await getConnection();
  await c.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await c.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      incurred_at DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await c.end();
  console.log('Migrations applied');
}

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const conn = await getConnection();
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await conn.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);
    await conn.end();
    res.json({ id: result.insertId, username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute('SELECT id, username, password FROM users WHERE username = ?', [username]);
    await conn.end();
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid authorization' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.get('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute('SELECT * FROM expenses WHERE user_id = ? ORDER BY incurred_at DESC', [req.user.sub]);
    await conn.end();
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/expenses', authMiddleware, async (req, res) => {
  const { title, amount, category, incurred_at } = req.body;
  if (!title || !amount) return res.status(400).json({ error: 'title and amount required' });
  try {
    const conn = await getConnection();
    const [result] = await conn.execute('INSERT INTO expenses (user_id, title, amount, category, incurred_at) VALUES (?, ?, ?, ?, ?)', [req.user.sub, title, amount, category || null, incurred_at || null]);
    await conn.end();
    res.json({ id: result.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/expenses/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const { title, amount, category, incurred_at } = req.body;
  try {
    const conn = await getConnection();
    await conn.execute('UPDATE expenses SET title=?, amount=?, category=?, incurred_at=? WHERE id=? AND user_id=?', [title, amount, category || null, incurred_at || null, id, req.user.sub]);
    await conn.end();
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    const conn = await getConnection();
    await conn.execute('DELETE FROM expenses WHERE id=? AND user_id=?', [id, req.user.sub]);
    await conn.end();
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
migrate().then(() => {
  app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
}).catch(err => {
  console.error('Migration error', err);
  process.exit(1);
});
