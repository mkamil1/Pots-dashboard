const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jwt-simple');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = 'votre_secret_jwt';
const db = new sqlite3.Database('./database.db');

db.serialize(() => {

  db.run(`DROP TABLE IF EXISTS posts`);
  db.run(`DROP TABLE IF EXISTS users`);


  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  )`);

  db.run(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

 
  const superAdminEmail = 'test@k.k';
  bcrypt.hash('test', 10).then((hashedPassword) => {
    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Super Admin', superAdminEmail, hashedPassword, 'superadmin'],
      () => console.log('Base réinitialisée : Seul le SuperAdmin (superadmin@admin.com) est présent.')
    );
  });
});


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const decoded = jwt.decode(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token invalide ou expiré' });
  }
};


app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "user")',
      [name, email, hashedPassword],
      function (err) {
        if (err) return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        
        const user = { id: this.lastID, name, email, role: 'user' };
        const token = jwt.encode(user, SECRET_KEY);
        res.status(201).json({ token, user });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Utilisateur non trouvé' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Mot de passe incorrect' });

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.encode(payload, SECRET_KEY);
    res.json({ token, user: payload });
  });
});

app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/users/:id/role', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Action autorisée uniquement pour le SuperAdmin' });
  }

  const { role } = req.body;
  const userId = req.params.id;

  db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Rôle mis à jour en '${role}' avec succès` });
  });
});


app.delete('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Utilisateur supprimé' });
  });
});


app.get('/api/posts', (req, res) => {
  db.all('SELECT * FROM posts', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/posts', authenticateToken, (req, res) => {
  const { title, content } = req.body;
  db.run(
    'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
    [req.user.id, title, content],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title, content, user_id: req.user.id });
    }
  );
});

app.get('/api/users/:id/posts', (req, res) => {
  db.all('SELECT * FROM posts WHERE user_id = ?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


app.listen(5002, '0.0.0.0', () => console.log('Serveur Backend démarré sur le port 5002'));