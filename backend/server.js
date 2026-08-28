const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_super_securisee';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(path.resolve(__dirname, 'database.sqlite'), (err) => {
  if (!err) {
    console.log('Connecté à SQLite.');
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS posts (
        post_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      )
    `);
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès refusé. Token manquant.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide ou expiré.' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  }

  let userRole = 'user';
  if (role === 'superadmin') {
    userRole = 'superadmin';
  } else if (role === 'admin') {
    userRole = 'admin';
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, userRole],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
          }
          return res.status(500).json({ error: err.message });
        }

        const userId = this.lastID;
        const token = jwt.sign({ userId, email, role: userRole }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, user: { id: userId, name, email, role: userRole } });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'Utilisateur ou mot de passe incorrect.' });

    const validPassword = await bcrypt.compare(password, user.password || '');
    if (!validPassword) return res.status(400).json({ error: 'Utilisateur ou mot de passe incorrect.' });

    const token = jwt.sign({ userId: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.user_id, name: user.name, email: user.email, role: user.role } });
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT user_id AS id, name, email, role FROM users WHERE user_id = ?', [req.user.userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(user);
  });
});

app.get('/api/posts', (req, res) => {
  db.all('SELECT post_id AS id, user_id, title, content FROM posts ORDER BY post_id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/users/:id/posts', (req, res) => {
  const { id } = req.params;
  db.all('SELECT post_id AS id, user_id, title, content FROM posts WHERE user_id = ? ORDER BY post_id ASC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/posts', (req, res) => {
  const { user_id, title, content } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: 'user_id et title sont requis.' });

  db.get('SELECT user_id FROM users WHERE user_id = ?', [user_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'Utilisateur non trouvé.' });

    db.run('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [user_id, title, content || null], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, user_id, title, content: content || null });
    });
  });
});

app.put('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const { user_id, title, content } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: 'user_id et title sont requis.' });

  db.run('UPDATE posts SET user_id = ?, title = ?, content = ? WHERE post_id = ?', [user_id, title, content || null, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Post non trouvé.' });
    res.json({ message: 'Post mis à jour', id: Number(id), user_id, title, content: content || null });
  });
});

app.patch('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const { user_id, title, content } = req.body;

  db.get('SELECT * FROM posts WHERE post_id = ?', [id], (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(404).json({ error: 'Post non trouvé.' });

    const newUserId = user_id !== undefined ? user_id : post.user_id;
    const newTitle = title !== undefined ? title : post.title;
    const newContent = content !== undefined ? content : post.content;

    db.run('UPDATE posts SET user_id = ?, title = ?, content = ? WHERE post_id = ?', [newUserId, newTitle, newContent, id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Post modifié', id: Number(id), user_id: newUserId, title: newTitle, content: newContent });
    });
  });
});

app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM posts WHERE post_id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Post non trouvé.' });
    res.json({ message: `Post ${id} supprimé.` });
  });
});

app.get('/api/users', (req, res) => {
  db.all('SELECT user_id AS id, name, email, role FROM users ORDER BY user_id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Nom et Email requis." });

  db.get('SELECT user_id FROM users WHERE name = ? AND email = ?', [name, email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    const finishWithPost = (userId, created) => {
      const title = `Auto post for user ${userId}`;
      const content = `Created at ${new Date().toISOString()}`;
      db.run('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [userId, title, content], function (errPost) {
        if (errPost) return res.status(500).json({ error: errPost.message });
        res.status(created ? 201 : 200).json({ id: userId, name, email, post_id: this.lastID });
      });
    };

    if (row) return finishWithPost(row.user_id, false);

    db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      finishWithPost(this.lastID, true);
    });
  });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Nom et Email requis." });

  db.run('UPDATE users SET name = ?, email = ? WHERE user_id = ?', [name, email, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Utilisateur non trouvé." });
    res.json({ message: "Utilisateur mis à jour", id: Number(id), name, email });
  });
});

app.patch('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  db.get('SELECT * FROM users WHERE user_id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé." });

    const newName = name || user.name;
    const newEmail = email || user.email;

    db.run('UPDATE users SET name = ?, email = ? WHERE user_id = ?', [newName, newEmail, id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: "Utilisateur modifié", id: Number(id), name: newName, email: newEmail });
    });
  });
});

app.delete('/api/users/by-post/:postId', (req, res) => {
  const { postId } = req.params;
  db.get('SELECT user_id FROM posts WHERE post_id = ?', [postId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Post non trouvé.' });

    const userId = row.user_id;
    db.run('DELETE FROM users WHERE user_id = ?', [userId], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: `Utilisateur ${userId} supprimé via le post ${postId}.`, id: userId });
    });
  });
});


app.delete('/api/users/:id', authenticateToken, (req, res) => {
  const requester = req.user; // { userId, email, role } issu du token JWT
  const targetId = Number(req.params.id);

  db.get('SELECT user_id, role FROM users WHERE user_id = ?', [targetId], (err, targetUser) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!targetUser) return res.status(404).json({ error: "Utilisateur non trouvé." });

    // 1. Interdiction de supprimer son propre compte
    if (requester.userId === targetUser.user_id) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    // 2. Interdiction absolue de supprimer un Super Admin
    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ error: "Action interdite : Impossible de supprimer un Super Admin." });
    }

    // 3. Un Admin Standard ne peut PAS supprimer un autre Admin
    if (targetUser.role === 'admin' && requester.role !== 'superadmin') {
      return res.status(403).json({ error: "Privilèges insuffisants : Seul un Super Admin peut supprimer un Admin." });
    }

    // 4. Exécution de la suppression
    db.run('DELETE FROM users WHERE user_id = ?', [targetId], function (errDelete) {
      if (errDelete) return res.status(500).json({ error: errDelete.message });
      if (this.changes === 0) return res.status(404).json({ error: "Utilisateur non trouvé." });
      res.json({ message: `Utilisateur ${targetId} supprimé avec succès.` });
    });
  });
});

app.listen(PORT, () => console.log(`Backend Express actif sur le port ${PORT}`));