const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jwt-simple');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const SECRET_KEY = 'votre_secret_jwt';
const fs = require('fs');
const DB_PATH = process.env.DB_PATH || './database.db';

// If RESET_DB is enabled, remove the database file before opening it so SQLite starts fresh
const reset = process.env.RESET_DB === '1' || process.env.RESET_DB === 'true';
if (reset) {
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log('Existing database file removed to ensure clean reset:', DB_PATH);
    }
  } catch (err) {
    console.error('Error removing existing database file during RESET_DB:', err && err.message ? err.message : err);
  }
}

const db = new sqlite3.Database(DB_PATH);

// In-memory map of userId => Set of socket ids (supports multiple client devices per user)
const userSockets = {};

io.on('connection', (socket) => {
  console.log('[ws] socket connected:', socket.id);

  // client should emit 'authenticate' with their JWT token after connecting
  socket.on('authenticate', (token) => {
    try {
      const payload = jwt.decode(token, SECRET_KEY);
      const uid = payload && payload.id;
      if (!uid) return;
      socket.userId = uid;
      if (!userSockets[uid]) userSockets[uid] = new Set();
      userSockets[uid].add(socket.id);
      console.log(`[ws] socket ${socket.id} authenticated as user ${uid}`);
    } catch (err) {
      console.error('[ws] authenticate error:', err && err.message ? err.message : err);
    }
  });

  socket.on('disconnect', () => {
    const uid = socket.userId;
    if (uid && userSockets[uid]) {
      userSockets[uid].delete(socket.id);
      if (userSockets[uid].size === 0) delete userSockets[uid];
    }
    console.log('[ws] socket disconnected:', socket.id);
  });
});


db.serialize(() => {
  const superAdminEmail = 'test@k.k';

  if (reset) {
    console.log('RESET_DB enabled: reinitializing database (tables dropped)');
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

    bcrypt.hash('test', 10).then((hashedPassword) => {
      db.run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Super Admin', superAdminEmail, hashedPassword, 'superadmin'],
        () => console.log('SuperAdmin créé (database reset).')
      );
    });
  } else {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      deleted_at DATETIME DEFAULT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      deleted_at DATETIME DEFAULT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // insert superadmin only if not exists
    db.get('SELECT id FROM users WHERE email = ?', [superAdminEmail], (err, row) => {
      if (err) return console.error('Error checking superadmin:', err.message);
      if (!row) {
        bcrypt.hash('test', 10).then((hashedPassword) => {
          db.run(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            ['Super Admin', superAdminEmail, hashedPassword, 'superadmin'],
            () => console.log('SuperAdmin créé.')
          );
        });
      } else {
        console.log('SuperAdmin already present.');
      }
    });
  }

  // Aggressive cleanup (last-resort): remove all posts and all users except the superadmin
  // This guarantees that after startup the DB contains only the superadmin user and no posts.
  try {
    db.run('DELETE FROM posts', (err) => {
      if (err) console.error('Aggressive cleanup: error deleting posts:', err.message);
      else console.log('Aggressive cleanup: all posts removed.');
    });

    db.run('DELETE FROM users WHERE email != ?', [superAdminEmail], function (err) {
      if (err) {
        console.error('Aggressive cleanup: error deleting users:', err.message);
        return;
      }
      console.log(`Aggressive cleanup: removed users (kept superadmin ${superAdminEmail}).`);

      // Ensure superadmin exists; if not, create it
      db.get('SELECT id FROM users WHERE email = ?', [superAdminEmail], (err, row) => {
        if (err) return console.error('Error checking superadmin after cleanup:', err.message);
        if (!row) {
          bcrypt.hash('test', 10).then((hashedPassword) => {
            db.run(
              'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
              ['Super Admin', superAdminEmail, hashedPassword, 'superadmin'],
              () => console.log('SuperAdmin created by aggressive cleanup.')
            );
          }).catch((e) => console.error('Error hashing superadmin password:', e));
        } else {
          console.log('SuperAdmin present after aggressive cleanup.');
        }
      });
    });
  } catch (e) {
    console.error('Aggressive cleanup failed:', e && e.message ? e.message : e);
  }
});


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('[auth] Authorization header:', authHeader);
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const decoded = jwt.decode(token, SECRET_KEY);
    console.log('[auth] Decoded token payload:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[auth] Token decode error:', err && err.message ? err.message : err);
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
  console.log('[role:update] requester=', req.user, 'params=', req.params, 'body=', req.body);
  if (req.user.role !== 'superadmin') {
    console.log('[role:update] denied: requester not superadmin');
    return res.status(403).json({ error: 'Action réservée au SuperAdmin' });
  }

  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }
  db.run('UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL', [role, req.params.id], function (err) {
    if (err) {
      console.error('[role:update] db error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable ou déjà supprimé' });
    }
    console.log(`[role:update] updated id=${req.params.id} to role=${role}`);
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
    SELECT posts.id, posts.title, posts.content, posts.user_id, users.role AS author_role, users.name AS author_name, users.email AS author_email
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
      const newPostId = this.lastID;

      // Fetch the newly created post with author info so we can emit full object to clients
      const postQuery = `
        SELECT posts.id, posts.title, posts.content, posts.user_id, users.role AS author_role, users.name AS author_name, users.email AS author_email
        FROM posts
        JOIN users ON posts.user_id = users.id
        WHERE posts.id = ?
      `;

      db.get(postQuery, [newPostId], (err2, row) => {
        if (err2) {
          console.error('Error fetching created post:', err2.message);
          // still respond with basic info
          res.status(201).json({ id: newPostId, title, content, user_id: req.user.id });
          return;
        }

        // Emit to all connected clients so they see the new post immediately
        try {
          io.emit('postCreated', row);
          console.log('[ws] Emitted postCreated id=', row && row.id);
        } catch (emitErr) {
          console.error('Error emitting postCreated:', emitErr && emitErr.message ? emitErr.message : emitErr);
        }

        res.status(201).json(row);
      });
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
    console.log('[posts:delete] currentUserId=', currentUserId, 'currentUserRole=', currentUserRole, 'postQueryErr=', err, 'post=', post);
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

        // Notify the post author via WebSocket if they are connected
        try {
          const authorId = post.user_id;
          const sockets = userSockets[authorId];
          if (sockets) {
            for (const sid of sockets) {
              io.to(sid).emit('postDeleted', { postId: Number(postId), message: 'Votre post a été supprimé' });
            }
          }
        } catch (notifyErr) {
          console.error('[ws] notify error:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
        }

        res.json({ message: 'Post supprimé (soft delete) avec succès' });
      }
    );
  });
});

// Expose reset status so clients can detect when the server performed a RESET_DB at startup
app.get('/api/reset-status', (req, res) => {
  res.json({ reset });
});

server.listen(5002, '0.0.0.0', () => console.log('Serveur Backend démarré sur le port 5002'));