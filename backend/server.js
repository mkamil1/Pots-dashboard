const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(path.resolve(__dirname, 'database.sqlite'), (err) => {
  if (!err) {
    console.log('Connecté à SQLite.');
    db.run('PRAGMA foreign_keys = ON');

    // Table Users (Unique Auto-Increment ID)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      )
    `);

    // Table Posts (Separate Auto-Increment ID linked to user_id)
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

  // GET all posts
  app.get('/api/posts', (req, res) => {
    db.all('SELECT post_id AS id, user_id, title, content FROM posts ORDER BY post_id ASC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // GET posts for a specific user
  app.get('/api/users/:id/posts', (req, res) => {
    const { id } = req.params;
    db.all('SELECT post_id AS id, user_id, title, content FROM posts WHERE user_id = ? ORDER BY post_id ASC', [id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // POST create a new post
  app.post('/api/posts', (req, res) => {
    const { user_id, title, content } = req.body;
    if (!user_id || !title) return res.status(400).json({ error: 'user_id and title are required.' });

    db.get('SELECT user_id FROM users WHERE user_id = ?', [user_id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(400).json({ error: 'User not found.' });

      db.run('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [user_id, title, content || null], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, user_id, title, content: content || null });
      });
    });
  });

  // PUT replace a post
  app.put('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    const { user_id, title, content } = req.body;
    if (!user_id || !title) return res.status(400).json({ error: 'user_id and title are required.' });

    db.get('SELECT user_id FROM users WHERE user_id = ?', [user_id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(400).json({ error: 'User not found.' });

      db.run('UPDATE posts SET user_id = ?, title = ?, content = ? WHERE post_id = ?', [user_id, title, content || null, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Post not found.' });
        res.json({ message: 'Post updated', id: Number(id), user_id, title, content: content || null });
      });
    });
  });

  // PATCH modify a post partially
  app.patch('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    const { user_id, title, content } = req.body;

    db.get('SELECT * FROM posts WHERE post_id = ?', [id], (err, post) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!post) return res.status(404).json({ error: 'Post not found.' });

      const newUserId = user_id !== undefined ? user_id : post.user_id;
      const newTitle = title !== undefined ? title : post.title;
      const newContent = content !== undefined ? content : post.content;

      if (user_id !== undefined) {
        db.get('SELECT user_id FROM users WHERE user_id = ?', [newUserId], (err2, row) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (!row) return res.status(400).json({ error: 'User not found.' });

          db.run('UPDATE posts SET user_id = ?, title = ?, content = ? WHERE post_id = ?', [newUserId, newTitle, newContent, id], function (err3) {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ message: 'Post patched', id: Number(id), user_id: newUserId, title: newTitle, content: newContent });
          });
        });
      } else {
        db.run('UPDATE posts SET title = ?, content = ? WHERE post_id = ?', [newTitle, newContent, id], function (err4) {
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({ message: 'Post patched', id: Number(id), user_id: newUserId, title: newTitle, content: newContent });
        });
      }
    });
  });

  // DELETE a post
  app.delete('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM posts WHERE post_id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Post not found.' });
      res.json({ message: `Post ${id} deleted.` });
    });
  });

// GET all users
app.get('/api/users', (req, res) => {
  db.all('SELECT user_id AS id, name, email FROM users ORDER BY user_id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new user (Unique ID assigned by SQLite)
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Nom et Email requis." });

  // Check if a user with same name+email already exists -> return same id
  db.get('SELECT user_id FROM users WHERE name = ? AND email = ?', [name, email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    const finishWithPost = (userId, created) => {
      // create a new post for this user on each (re)creation
      const title = `Auto post for user ${userId}`;
      const content = `Created at ${new Date().toISOString()}`;
      db.run('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [userId, title, content], function (errPost) {
        if (errPost) return res.status(500).json({ error: errPost.message });
        const resp = { id: userId, name, email, post_id: this.lastID };
        return res.status(created ? 201 : 200).json(resp);
      });
    };

    if (row) {
      // Existing user — keep same id, but create a new post and return its id
      return finishWithPost(row.user_id, false);
    }

    // No existing user — create new user then create a post
    db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function (err2) {
      if (err2) {
        if (err2.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: "Cet email est déjà utilisé." });
        }
        return res.status(500).json({ error: err2.message });
      }
      finishWithPost(this.lastID, true);
    });
  });
});

// GET users with their latest post id
app.get('/api/users/with-latest-post', (req, res) => {
  const sql = `
    SELECT u.user_id AS id, u.name, u.email, p.post_id AS last_post_id
    FROM users u
    LEFT JOIN (
      SELECT user_id, MAX(post_id) AS post_id FROM posts GROUP BY user_id
    ) p ON u.user_id = p.user_id
    ORDER BY u.user_id ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// DELETE user by post id (deletes the user who authored the given post)
app.delete('/api/users/by-post/:postId', (req, res) => {
  const { postId } = req.params;
  db.get('SELECT user_id FROM posts WHERE post_id = ?', [postId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Post not found.' });

    const userId = row.user_id;
    db.run('DELETE FROM users WHERE user_id = ?', [userId], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found.' });
      res.json({ message: `User ${userId} deleted (triggered by post ${postId}).`, id: userId });
    });
  });
});

// PUT update user
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

// DELETE user
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM users WHERE user_id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Utilisateur non trouvé." });
    res.json({ message: `Utilisateur ${id} supprimé avec succès.` });
  });
});

app.listen(PORT, () => console.log(`Backend Express actif sur le port ${PORT}`));