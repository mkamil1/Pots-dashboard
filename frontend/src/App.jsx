import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';

const POSTMAN_MOCK_URL = 'https://cc2ab24c-77fd-4997-9926-195510dfcb44.mock.pstmn.io/current-hour';
const API_BASE = '/api';

function AuthPage({ isSignUp, token, setToken, setCurrentUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (token) return <Navigate to="/dashboard" replace />;

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
    const body = isSignUp ? { name, email, password } : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'authentification");

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
        <div style={{ justifyContent: 'center', display: 'flex', gap: 10, marginBottom: 15 }}>
          <Link style={{ textDecoration: 'none' }} to="/login" className={`btn ${!isSignUp ? 'btn-primary' : 'btn-outline'}`}>
            Connexion
          </Link>
          <Link style={{ textDecoration: 'none' }} to="/signup" className={`btn ${isSignUp ? 'btn-primary' : 'btn-outline'}`}>
            Inscription
          </Link>
        </div>

        <form onSubmit={handleAuth} autoComplete="off">
          {isSignUp && (
            <>
              <label>Nom</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" required />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />

          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" required />

          {error && <p className="error-msg" style={{ color: '#e53e3e', marginBottom: 10 }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 10, width: '100%' }}>
            {isSignUp ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ currentUser, token, setToken, setCurrentUser }) {
  const [userId, setUserId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [output, setOutput] = useState(null);
  const [activeAction, setActiveAction] = useState(() => {
    try {
      return sessionStorage.getItem('activeAction') || null;
    } catch (e) {
      return null;
    }
  });
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    try { sessionStorage.removeItem('activeAction'); } catch (e) {}
    setToken('');
    setCurrentUser(null);
    setOutput(null);
    navigate('/login');
  };

  const showAction = (action) => {
    setActiveAction(action);
    setOutput(null);
    try {
      if (action) sessionStorage.setItem('activeAction', action);
      else sessionStorage.removeItem('activeAction');
    } catch (e) {}
  };

  const getHour = async () => {
    setActiveAction(null);
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
    setActiveAction(null);
    try {
      const res = await fetch(`${API_BASE}/users`);
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) return setOutput(<p className="empty-msg">Aucun utilisateur actif.</p>);

      setOutput(
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className="user-item">
              <div>
                <span className={`badge ${u.role === 'superadmin' ? 'badge-danger' : ''}`}>
                  {u.role || 'user'}
                </span>{' '}
                <strong className="user-name">{u.name}</strong> <span className="user-email">({u.email})</span> - ID: {u.id}
              </div>
            </li>
          ))}
        </ul>
      );
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const getDeletedUsers = async () => {
    setActiveAction(null);
    try {
      const res = await fetch(`${API_BASE}/users/deleted`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) {
        return setOutput(<p className="empty-msg">Aucun utilisateur dans la corbeille.</p>);
      }

      setOutput(
        <div>
          <h3>Corbeille (Utilisateurs désactivés)</h3>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id} className="user-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span className="badge badge-danger">Désactivé</span>{' '}
                  <strong>{u.name}</strong> ({u.email}) - ID: {u.id}
                </div>
                <button 
                  onClick={() => handleRestoreUser(u.id)} 
                  className="btn btn-primary"
                 
                >
                  Restaurer
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const handleRestoreUser = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/users/${id}/restore`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOutput(<div className="result-card success"><p className="result-body">{data.message}</p></div>);
    } catch (err) {
      setOutput(<div className="result-card error"><p className="result-body">{err.message}</p></div>);
    }
  };

  const getAllPosts = async () => {
    setActiveAction(null);
    try {
      const res = await fetch(`${API_BASE}/posts`);
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) return setOutput(<p className="empty-msg">Aucun post disponible.</p>);

      setOutput(
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post-item">
              <strong className="post-title">{p.title}</strong>
              <p className="post-content">{p.content}</p>
              <small className="post-author">Auteur ID: {p.user_id}</small>
            </li>
          ))}
        </ul>
      );
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: postTitle, content: postContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

      setOutput(<div className="result-card success"><span className="result-title">Succès :</span><p className="result-body">Post créé avec succès (ID: {data.id})</p></div>);
      setPostTitle('');
      setPostContent('');
    } catch (err) {
      setOutput(<div className="result-card error"><span className="result-title">Erreur :</span><p className="result-body">{err.message}</p></div>);
    }
  };

  const handlePromoteAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la promotion');

      setOutput(<div className="result-card success"><span className="result-title">Succès :</span><p className="result-body">{data.message}</p></div>);
      setUserId('');
    } catch (err) {
      setOutput(<div className="result-card error"><span className="result-title">Erreur :</span><p className="result-body">{err.message}</p></div>);
    }
  };

  const handleDeleteUserSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');

      setOutput(<div className="result-card success"><span className="result-title">Succès :</span><p className="result-body">{data.message}</p></div>);
      setUserId('');
    } catch (err) {
      setOutput(<div className="result-card error"><span className="result-title">Erreur :</span><p className="result-body">{err.message}</p></div>);
    }
  };

  return (
    <div className="container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1>Tableau de bord</h1>
          {currentUser && <p style={{ color: '#4a5568' }}>Connecté en tant que : <strong>{currentUser.name}</strong> ({currentUser.role})</p>}
        </div>
        <button onClick={handleLogout} className="btn btn-out" >
          Déconnexion
        </button>
      </header>

      <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginBottom: 20 }}>
        <button onClick={getHour} className="btn btn-primary">Obtenir Heure</button>
        <button onClick={getUsers} className="btn btn-primary">Voir Utilisateurs</button>
        <button onClick={getAllPosts} className="btn btn-primary">Voir Tous les Posts</button>
        <button onClick={() => showAction('create_post')} className="btn btn-secondary">Créer un Post</button>
        
        {currentUser?.role === 'superadmin' && (
          <>
            <button onClick={() => showAction('promote_admin')} className="btn btn-secondary" >
              Nommer un Admin
            </button>
            <button onClick={getDeletedUsers} className="btn btn-secondary" >
              Corbeille / Restaurer
            </button>
          </>
        )}

        {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
          <button onClick={() => showAction('delete_user')} className="btn btn-danger">Supprimer User</button>
        )}
      </div>

      {activeAction === 'create_post' && (
        <div className="card form-card" style={{ marginBottom: 20 }}>
          <h3>Créer un nouveau post</h3>
          <form onSubmit={handleCreatePost}>
            <label>Titre</label>
            <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} required placeholder="Titre du post" />
            <label>Contenu</label>
            <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} required placeholder="Contenu du post" style={{ width: '100%', padding: 10, borderRadius: 6, marginBottom: 10 }} />
            <button type="submit" className="btn btn-primary">Publier</button>
          </form>
        </div>
      )}

      {activeAction === 'promote_admin' && (
        <div className="card form-card" style={{ marginBottom: 20 }}>
          <h3>Attribuer le rôle Admin (SuperAdmin uniquement)</h3>
          <form onSubmit={handlePromoteAdmin}>
            <label>ID de l'utilisateur à passer Admin</label>
            <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} required placeholder="ex: 2" />
            <button type="submit" className="btn btn-primary" >Promouvoir Admin</button>
          </form>
        </div>
      )}

      {activeAction === 'delete_user' && (
        <div className="card form-card" style={{ marginBottom: 20 }}>
          <h3>Supprimer (Désactiver) un utilisateur</h3>
          <form onSubmit={handleDeleteUserSubmit}>
            <label>ID de l'utilisateur à supprimer</label>
            <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} required placeholder="ex: 2" />
            <button type="submit" className="btn btn-danger">Supprimer de la liste</button>
          </form>
        </div>
      )}

      {output && (
        <div className="card result-container">
          <h2>Résultat</h2>
          <div className="output-box">{output}</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [currentUser, setCurrentUserState] = useState(() => {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const setCurrentUser = (user) => {
    setCurrentUserState(user);
    try {
      if (user) localStorage.setItem('currentUser', JSON.stringify(user));
      else localStorage.removeItem('currentUser');
    } catch (e) {}
  };

  useEffect(() => {
   
    if (token && !currentUser) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const json = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(json);
          if (payload && (payload.role || payload.email)) {
            setCurrentUser(payload);
          }
        }
      } catch (e) {
      
      }
    }
  }, [token, currentUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage isSignUp={false} token={token} setToken={setToken} setCurrentUser={setCurrentUser} />} />
        <Route path="/signup" element={<AuthPage isSignUp={true} token={token} setToken={setToken} setCurrentUser={setCurrentUser} />} />
        <Route
          path="/dashboard"
          element={
            token ? (
              <Dashboard currentUser={currentUser} token={token} setToken={setToken} setCurrentUser={setCurrentUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}