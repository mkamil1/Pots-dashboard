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

// Réinitialisation de la base de données à chaque démarrage (Conservant uniquement le SuperAdmin)
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
      () => console.log('Base réinitialisée : Seul le SuperAdmin est présent par défaut.')
    );
  });
});

// Middleware d'authentification JWT
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

// --- ROUTES AUTHENTIFICATION ---

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

// --- ROUTES UTILISATEURS ---

app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Promouvoir/Rétrograder un rôle (SuperAdmin uniquement)
app.put('/api/users/:id/role', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Action réservée au SuperAdmin' });
  }

  const { role } = req.body;
  db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Rôle mis à jour en '${role}'` });
  });
});

// Suppression d'un utilisateur (Contrôle strict des rôles)
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  const currentUserRole = req.user.role;
  const targetUserId = req.params.id;

  if (currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  // Vérification du rôle de l'utilisateur qu'on cherche à supprimer
  db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, targetUser) => {
    if (err || !targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Un Admin classique NE PEUT PAS supprimer un autre Admin ni un SuperAdmin
    if (currentUserRole === 'admin' && targetUser.role !== 'user') {
      return res.status(403).json({ 
        error: 'Un Admin ne peut supprimer que des utilisateurs au rôle "user"' 
      });
    }

    // Suppression validée (SuperAdmin supprime n'importe qui / Admin supprime uniquement un user)
    db.run('DELETE FROM users WHERE id = ?', [targetUserId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Utilisateur supprimé avec succès' });
    });
  });
});

// --- ROUTES POSTS ---

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

// Suppression d'un post (Auteur, SuperAdmin, ou Admin contrôlant un 'user')
app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;

  // Récupérer les informations sur le créateur du post
  db.get(
    'SELECT posts.id, posts.user_id, users.role AS author_role FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = ?', 
    [postId], 
    (err, post) => {
      if (err || !post) {
        return res.status(404).json({ error: 'Post introuvable' });
      }

      const isAuthor = post.user_id === currentUserId;
      const isSuperAdmin = currentUserRole === 'superadmin';
      const isAdminManagingUser = currentUserRole === 'admin' && post.author_role === 'user';

      if (!isAuthor && !isSuperAdmin && !isAdminManagingUser) {
        return res.status(403).json({ 
          error: 'Un Admin ne peut supprimer que les posts rédigés par des utilisateurs simples ("user")' 
        });
      }

      db.run('DELETE FROM posts WHERE id = ?', [postId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Post supprimé avec succès' });
      });
    }
  );
});

app.listen(5002, '0.0.0.0', () => console.log('Serveur Backend démarré sur le port 5002'));