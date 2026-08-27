import { useState } from 'react';

const POSTMAN_MOCK_URL = 'https://cc2ab24c-77fd-4997-9926-195510dfcb44.mock.pstmn.io/current-hour';
const API_BASE = 'http://localhost:5002/api';

export default function App() {
  
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);


  const [isSignUp, setIsSignUp] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState('user');
  const [authError, setAuthError] = useState('');

  const [userId, setUserId] = useState('');
  const [output, setOutput] = useState('...');


  const resetAuthFields = () => {
    setAuthName('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthRole('user');
    setAuthError('');
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
    const body = isSignUp
      ? { name: authName, email: authEmail, password: authPassword, role: authRole }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'authentification");

      setToken(data.token);
      setCurrentUser(data.user);
      resetAuthFields();
      setOutput('Connecté avec succès.');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    resetAuthFields();
    setOutput('...');
  };

  const switchAuthMode = (signUpMode) => {
    setIsSignUp(signUpMode);
    resetAuthFields();
  };

  

  const getHour = async () => {
    try {
      const res = await fetch(POSTMAN_MOCK_URL);
      const data = await res.json();
      const heure = data.time || data.formatted || data.current_hour || JSON.stringify(data);
      setOutput(
        <div className="result-card success">
          <span className="result-title">Heure récupérée :</span>
          <p className="result-body">{heure}</p>
        </div>
      );
    } catch (err) {
      setOutput(
        <div className="result-card error">
          <span className="result-title">Erreur :</span>
          <p className="result-body">Impossible de contacter l'API Postman. ({err.message})</p>
        </div>
      );
    }
  };

  const getUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      const users = await res.json();

      if (!Array.isArray(users) || users.length === 0) {
        setOutput(<p className="empty-msg">Aucun utilisateur enregistré.</p>);
        return;
      }

      setOutput(
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className="user-item" onClick={() => deleteUserById(u.id)} title="Cliquer pour supprimer cet utilisateur">
              <span className="badge">User {u.id} ({u.role || 'user'})</span>
              <strong className="user-name">{u.name}</strong>{' '}
              <span className="user-email">({u.email})</span>
            </li>
          ))}
        </ul>
      );
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const getAllPosts = async () => {
    try {
      const res = await fetch(`${API_BASE}/posts`);
      const posts = await res.json();

      if (!Array.isArray(posts) || posts.length === 0) {
        setOutput(<p className="empty-msg">Aucun post trouvé.</p>);
        return;
      }

      setOutput(
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post-item" onClick={() => deletePostById(p.id)} title="Cliquer pour supprimer ce post">
              <span className="badge">Post {p.id} / User {p.user_id}</span>
              <strong className="post-title">{p.title}</strong>
              <p className="post-content">{p.content}</p>
            </li>
          ))}
        </ul>
      );
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const getUserPosts = async (id) => {
    const targetId = id || userId || currentUser?.id;
    if (!targetId) {
      setOutput(<p className="warning-msg">Saisissez un ID Utilisateur.</p>);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${targetId}/posts`);
      const posts = await res.json();

      if (!Array.isArray(posts) || posts.length === 0) {
        setOutput(<p className="empty-msg">Aucun post trouvé pour l'utilisateur {targetId}.</p>);
        return;
      }

      setOutput(
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post-item" onClick={() => deletePostById(p.id)} title="Cliquer pour supprimer ce post">
              <span className="badge">Post {p.id} / User {p.user_id}</span>
              <strong className="post-title">{p.title}</strong>
              <p className="post-content">{p.content}</p>
            </li>
          ))}
        </ul>
      );
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  // Création de Post automatique (sans besoin de titre ni de contenu)
  const createPost = async () => {
    const targetUserId = userId || currentUser?.id;
    const defaultTitle = `Post pour utilisateur ${targetUserId}`;
    const defaultContent = `Créé automatiquement à ${new Date().toLocaleString()}`;

    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(targetUserId),
          title: defaultTitle,
          content: defaultContent,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card success">
            <strong>Post créé avec succès !</strong><br />
            Post ID : <strong>{data.id}</strong> | User ID : <strong>{data.user_id}</strong>
          </div>
        );
        if (currentUser?.role === 'admin') getAllPosts();
        else getUserPosts(currentUser?.id);
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const deleteUserById = async (id) => {
    const target = Number(id || userId);
    if (!target) {
      setOutput(<p className="warning-msg">Saisissez un ID Utilisateur pour la suppression.</p>);
      return;
    }

    if (target === currentUser?.id) {
      setOutput(
        <div className="result-card error">
          <strong>Action interdite :</strong> Vous ne pouvez pas supprimer votre propre compte administrateur.
        </div>
      );
      return;
    }

    if (!confirm(`Confirmez la suppression de l'utilisateur ${target} ?`)) return;

    try {
      const res = await fetch(`${API_BASE}/users/${target}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card error">
            <strong>{data.message || 'Utilisateur supprimé.'}</strong>
          </div>
        );
        getUsers();
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const deletePostById = async (id) => {
    if (!confirm(`Confirmez la suppression du post ${id} ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setOutput(
          <div className="result-card error">
            <strong>{data.message || 'Post supprimé.'}</strong>
          </div>
        );
        if (currentUser?.role === 'admin') getAllPosts();
        else getUserPosts(currentUser?.id);
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };


  if (!token) {
    return (
      <div className="container">
        <h1>Dashboard </h1>
        <div className="card form-card">
          <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
            <button className={`btn ${!isSignUp ? 'btn-primary' : 'btn-outline'}`} onClick={() => switchAuthMode(false)}>
              Connexion
            </button>
            <button className={`btn ${isSignUp ? 'btn-primary' : 'btn-outline'}`} onClick={() => switchAuthMode(true)}>
              Inscription
            </button>
          </div>

          <form onSubmit={handleAuth} autoComplete="off">
            {isSignUp && (
              <>
                <label>Nom</label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Votre nom"
                  required
                />
              </>
            )}
            <label>Email</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              required
            />

            <label>Mot de passe</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Mot de passe"
              required
            />

            {isSignUp && (
              <>
                <label>Rôle</label>
                <select
                  value={authRole}
                  onChange={(e) => setAuthRole(e.target.value)}
                  style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #cbd5e0' }}
                >
                  <option value="user">Utilisateur (User)</option>
                  <option value="admin">Administrateur (Admin)</option>
                </select>
              </>
            )}

            {authError && <p className="error-msg" style={{ color: '#e53e3e', marginBottom: 10 }}>{authError}</p>}

            <button type="submit" className="btn btn-primary" style={{ marginTop: 10, width: '100%' }}>
              {isSignUp ? "S'inscrire" : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }


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
        <h1>Espace Admin</h1>
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