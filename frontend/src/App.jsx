import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';

const POSTMAN_MOCK_URL = 'https://cc2ab24c-77fd-4997-9926-195510dfcb44.mock.pstmn.io/current-hour';
const API_BASE = 'http://localhost:5002/api';

// --- PAGE D'AUTHENTIFICATION (Connexion / Inscription) ---

function AuthPage({ isSignUp, token, setToken, setCurrentUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Si l'utilisateur est déjà connecté, redirection automatique
  if (token) return <Navigate to="/dashboard" replace />;

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
    const body = isSignUp ? { name, email, password, role } : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'authentification");

      // Sauvegarde dans le localStorage
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <h1>Authentification</h1>
      <div className="card form-card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
          <Link to="/login" className={`btn ${!isSignUp ? 'btn-primary' : 'btn-outline'}`}>
            Connexion
          </Link>
          <Link to="/signup" className={`btn ${isSignUp ? 'btn-primary' : 'btn-outline'}`}>
            Inscription
          </Link>
        </div>

        <form onSubmit={handleAuth} autoComplete="off">
          {isSignUp && (
            <>
              <label>Nom</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" required />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />

          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" required />

          {isSignUp && (
            <>
              <label>Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6 }}>
                <option value="user">Utilisateur (User)</option>
                <option value="admin">Administrateur (Admin)</option>
              </select>
            </>
          )}

          {error && <p className="error-msg" style={{ color: '#e53e3e', marginBottom: 10 }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 10, width: '100%' }}>
            {isSignUp ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- DASHBOARD (Composant gérant Admin et User) ---

function Dashboard({ currentUser, token, setToken, setCurrentUser }) {
  const [userId, setUserId] = useState('');
  const [output, setOutput] = useState('...');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setCurrentUser(null);
    navigate('/login');
  };

  const getHour = async () => {
    try {
      const res = await fetch(POSTMAN_MOCK_URL);
      const data = await res.json();
      const heure = data.time || data.formatted || data.current_hour || JSON.stringify(data);
      setOutput(<div className="result-card success"><span className="result-title">Heure récupérée :</span><p className="result-body">{heure}</p></div>);
    } catch (err) {
      setOutput(<div className="result-card error"><span className="result-title">Erreur :</span><p className="result-body">{err.message}</p></div>);
    }
  };

  const getUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) return setOutput(<p className="empty-msg">Aucun utilisateur enregistré.</p>);
      setOutput(
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className="user-item" onClick={() => deleteUserById(u.id)} title="Cliquer pour supprimer">
              <span className="badge">User {u.id} ({u.role || 'user'})</span>
              <strong className="user-name">{u.name}</strong> <span className="user-email">({u.email})</span>
            </li>
          ))}
        </ul>
      );
    } catch (err) { setOutput(<p className="error-msg">Erreur : {err.message}</p>); }
  };

  const getAllPosts = async () => {
    try {
      const res = await fetch(`${API_BASE}/posts`);
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) return setOutput(<p className="empty-msg">Aucun post trouvé.</p>);
      setOutput(
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post-item" onClick={() => deletePostById(p.id)} title="Cliquer pour supprimer">
              <span className="badge">Post {p.id} / User {p.user_id}</span>
              <strong className="post-title">{p.title}</strong>
              <p className="post-content">{p.content}</p>
            </li>
          ))}
        </ul>
      );
    } catch (err) { setOutput(<p className="error-msg">Erreur : {err.message}</p>); }
  };

  const getUserPosts = async (id) => {
    const targetId = id || userId || currentUser?.id;
    if (!targetId) return setOutput(<p className="warning-msg">Saisissez un ID Utilisateur.</p>);
    try {
      const res = await fetch(`${API_BASE}/users/${targetId}/posts`);
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) return setOutput(<p className="empty-msg">Aucun post trouvé pour l'utilisateur {targetId}.</p>);
      setOutput(
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post-item" onClick={() => deletePostById(p.id)} title="Cliquer pour supprimer">
              <span className="badge">Post {p.id} / User {p.user_id}</span>
              <strong className="post-title">{p.title}</strong>
              <p className="post-content">{p.content}</p>
            </li>
          ))}
        </ul>
      );
    } catch (err) { setOutput(<p className="error-msg">Erreur : {err.message}</p>); }
  };

  
  const createPost = async () => {
    const targetUserId = userId || currentUser?.id;
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(targetUserId),
          title: `Post pour utilisateur ${targetUserId}`,
          content: `Créé automatiquement à ${new Date().toLocaleString()}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(<div className="result-card success"><strong>Post créé avec succès !</strong><br />Post ID : <strong>{data.id}</strong> | User ID : <strong>{data.user_id}</strong></div>);
        if (currentUser?.role === 'admin') getAllPosts();
        else getUserPosts(currentUser?.id);
      } else { setOutput(<p className="error-msg">Erreur : {data.error}</p>); }
    } catch (err) { setOutput(<p className="error-msg">Erreur : {err.message}</p>); }
  };

  // L'Admin ne peut PAS s'auto-supprimer
  const deleteUserById = async (id) => {
    const target = Number(id || userId);
    if (!target) return setOutput(<p className="warning-msg">Saisissez un ID Utilisateur pour la suppression.</p>);
    if (target === currentUser?.id) {
      return setOutput(<div className="result-card error"><strong>Action interdite :</strong> Vous ne pouvez pas supprimer votre propre compte administrateur.</div>);
    }
    if (!confirm(`Confirmez la suppression de l'utilisateur ${target} ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/users/${target}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { setOutput(<div className="result-card error"><strong>{data.message || 'Utilisateur supprimé.'}</strong></div>); getUsers(); } 
      else { setOutput(<p className="error-msg">Erreur : {data.error}</p>); }
    } catch (err) { setOutput(<p className="error-msg">Erreur : {err.message}</p>); }
  };

  const deletePostById = async (id) => {
    if (!confirm(`Confirmez la suppression du post ${id} ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setOutput(<div className="result-card error"><strong>{data.message || 'Post supprimé.'}</strong></div>);
        if (currentUser?.role === 'admin') getAllPosts();
        else getUserPosts(currentUser?.id);
      } else { setOutput(<p className="error-msg">Erreur : {data.error}</p>); }
    } catch (err) { setOutput(<p className="error-msg">Erreur : {err.message}</p>); }
  };

  if (currentUser?.role === 'user') {
    return (
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Espace Utilisateur</h1>
          <button className="btn btn-out" onClick={handleLogout}>Déconnexion</button>
        </div>
        <div className="card form-card">
          <h3>Profil : {currentUser.name}</h3>
          <p>Email : {currentUser.email} | Rôle : <strong>Utilisateur</strong> | ID : {currentUser.id}</p>
        </div>
        <div className="button-grid">
          <button className="btn btn-info" onClick={() => getUserPosts(currentUser.id)}>Mes Posts</button>
          <button className="btn btn-primary" onClick={createPost}>Créer un Post</button>
          <button className="btn btn-secondary" onClick={getHour}>Obtenir l'heure (Postman API)</button>
        </div>
        <div className="card response-card">
          <h3>Résultat</h3>
          <div id="output" className="output-box">{output}</div>
        </div>
      </div>
    );
  }

  
  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard Admin</h1>
        <button className="btn btn-out" onClick={handleLogout}>Déconnexion</button>
      </div>
      <div className="card form-card">
        <h3>Gestion & Création de Posts (Admin)</h3>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>Connecté en tant que <strong>{currentUser?.name}</strong> (ID: {currentUser?.id})</p>
        <div>
          <label>User ID cible (laisser vide pour votre propre compte)</label>
          <input placeholder={`Ex: ${currentUser?.id}`} type="number" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
      </div>
      <div className="button-grid">
        <button className="btn btn-primary" onClick={createPost}>Créer un Post</button>
        <button className="btn btn-info" onClick={() => getUserPosts()}>Posts de l'utilisateur cible</button>
        <button className="btn btn-outline" onClick={getUsers}>Liste des utilisateurs</button>
        <button className="btn btn-posts" onClick={getAllPosts}>Tous les posts</button>
        <button className="btn btn-danger" onClick={() => deleteUserById(userId)}>Supprimer l'utilisateur cible</button>
        <button className="btn btn-secondary" onClick={getHour}>Obtenir l'heure</button>
      </div>
      <div className="card response-card">
        <h3>Résultat</h3>
        <div id="output" className="output-box">{output}</div>
      </div>
    </div>
  );
}



function ProtectedRoute({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}



export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);


  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((user) => setCurrentUser(user))
        .catch(() => {
          localStorage.removeItem('token');
          setToken('');
          setCurrentUser(null);
        });
    }
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage isSignUp={false} token={token} setToken={setToken} setCurrentUser={setCurrentUser} />} />
        <Route path="/signup" element={<AuthPage isSignUp={true} token={token} setToken={setToken} setCurrentUser={setCurrentUser} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute token={token}>
              <Dashboard currentUser={currentUser} token={token} setToken={setToken} setCurrentUser={setCurrentUser} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}