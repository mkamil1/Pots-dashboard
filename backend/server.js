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
    role TEXT DEFAULT 'user',
    deleted_at DATETIME DEFAULT NULL
  )`);

  db.run(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    deleted_at DATETIME DEFAULT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  const superAdminEmail = 'test@k.k';
  bcrypt.hash('test', 10).then((hashedPassword) => {
    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Super Admin', superAdminEmail, hashedPassword, 'superadmin'],
      () => console.log('Base réinitialisée avec Soft Delete. SuperAdmin actif.')
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
  
  db.get('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Utilisateur non trouvé ou compte désactivé' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Mot de passe incorrect' });

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.encode(payload, SECRET_KEY);
    res.json({ token, user: payload });
  });
});


app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role FROM users WHERE deleted_at IS NULL', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


app.get('/api/users/deleted', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès réservé au SuperAdmin' });
  }

  db.all('SELECT id, name, email, role, deleted_at FROM users WHERE deleted_at IS NOT NULL', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


app.put('/api/users/:id/restore', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès réservé au SuperAdmin' });
  }

  db.run('UPDATE users SET deleted_at = NULL WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Utilisateur restauré avec succès' });
  });
});


app.put('/api/users/:id/role', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Action réservée au SuperAdmin' });
  }

  const { role } = req.body;
  db.run('UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL', [role, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Rôle mis à jour en '${role}'` });
  });
});


app.delete('/api/users/:id', authenticateToken, (req, res) => {
  const currentUserRole = req.user.role;
  const targetUserId = req.params.id;

  if (currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  db.get('SELECT role FROM users WHERE id = ? AND deleted_at IS NULL', [targetUserId], (err, targetUser) => {
    if (err || !targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable ou déjà supprimé' });
    }

    if (currentUserRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ 
        error: 'Un Admin ne peut supprimer que des utilisateurs au rôle "user"' 
      });
    }

    
    db.run(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [targetUserId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Utilisateur supprimé (soft delete) avec succès' });
      }
    );
  });
});

app.get('/api/posts', (req, res) => {
  const query = `
    SELECT posts.id, posts.title, posts.content, posts.user_id 
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    WHERE posts.deleted_at IS NULL AND users.deleted_at IS NULL
  `;
  db.all(query, [], (err, rows) => {
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


app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;

  const query = `
    SELECT posts.id, posts.user_id, users.role AS author_role 
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    WHERE posts.id = ? AND posts.deleted_at IS NULL
  `;

  db.get(query, [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ error: 'Post introuvable ou déjà supprimé' });
    }

    const isAuthor = post.user_id === currentUserId;
    const isSuperAdmin = currentUserRole === 'superadmin';
    const isAdminManagingUser = currentUserRole === 'admin' && post.author_role === 'user';

    if (!isAuthor && !isSuperAdmin && !isAdminManagingUser) {
      return res.status(403).json({ 
        error: 'Un Admin ne peut supprimer que les posts de rôle "user"' 
      });
    }

    db.run(
      'UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [postId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Post supprimé (soft delete) avec succès' });
      }
    );
  });
});

app.listen(5002, '0.0.0.0', () => console.log('Serveur Backend démarré sur le port 5002'));