import { useState } from 'react';

const POSTMAN_MOCK_URL = 'https://cc2ab24c-77fd-4997-9926-195510dfcb44.mock.pstmn.io/current-hour';
const API_BASE = 'http://localhost:5002/api';

export default function App() {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [postId, setPostId] = useState('');
  const [userId, setUserId] = useState('');
  const [output, setOutput] = useState('...');

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
            <li key={u.id} className="user-item" onClick={() => deleteUserById(u.id)} title="Cliquer pour supprimer cet user">
              <span className="badge">User {u.id}</span>
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
    const targetId = id || userId;
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

  const createDefaultPostForUser = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Number(id), title: `Post for user ${id}`, content: `Created at ${new Date().toISOString()}` }),
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card success">
            <strong>Post créé :</strong> Post ID : <strong>{data.id}</strong> | User ID : <strong>{data.user_id}</strong>
          </div>
        );
        getAllPosts();
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const deleteUserById = async (id) => {
    const target = id || userId;
    if (!target) {
      setOutput(<p className="warning-msg">Saisissez un ID Utilisateur pour suppression.</p>);
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
        getAllPosts();
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
        getAllPosts();
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const modifyUser = async () => {
    if (!userName || !userEmail) {
      setOutput(<p className="warning-msg">Veuillez fournir le nom et l'email de l'utilisateur existant à modifier.</p>);
      return;
    }

    try {
      const resUsers = await fetch(`${API_BASE}/users`);
      const users = await resUsers.json();
      const found = users.find((u) => u.name === userName && u.email === userEmail);
      if (!found) {
        setOutput(
          <div className="result-card warning">
            Utilisateur introuvable. Voulez-vous créer cet utilisateur ?<br />
            <button className="btn btn-primary" onClick={() => createUser(true)}>Créer</button>
          </div>
        );
        return;
      }

      const newName = prompt('Nouveau nom (laisser vide pour ne pas changer)', found.name) || found.name;
      const newEmail = prompt('Nouvel email (laisser vide pour ne pas changer)', found.email) || found.email;

      const res = await fetch(`${API_BASE}/users/${found.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(<div className="result-card success">Utilisateur modifié : {data.name} ({data.email})</div>);
        getUsers();
      } else setOutput(<p className="error-msg">Erreur : {data.error}</p>);
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const createUser = async (forceCreate = false) => {
    if (!userName || !userEmail) {
      setOutput(<p className="warning-msg">Veuillez remplir le nom et l'email.</p>);
      return;
    }

    try {
      const resUsers = await fetch(`${API_BASE}/users`);
      const users = await resUsers.json();
      const found = users.find((u) => u.name === userName && u.email === userEmail);

      if (found && !forceCreate) {
        
        setOutput(
          <div className="result-card">
            <strong>Utilisateur trouvé :</strong> {found.id} — {found.name} ({found.email})
            <div style={{marginTop:8, display:'flex', gap:8}}>
              <button className="btn btn-secondary" onClick={() => createDefaultPostForUser(found.id)}>Créer un post </button>
              <button className="btn btn-info" onClick={() => getUserPosts(found.id)}>Lister ses posts</button>
              <button className="btn btn-danger" onClick={() => setOutput(<p className="small">Pour supprimer un post : lister les posts puis cliquer sur le post à supprimer.</p>)}>
                Supprimer un post
              </button>
            </div>
          </div>
        );
        return;
      }

     
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, email: userEmail }),
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card success">
            <strong>Utilisateur créé / post ajouté !</strong><br />
            User ID : <strong>{data.id}</strong> | Post ID : <strong>{data.post_id}</strong> | Nom : {data.name} ({data.email})
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

  const updateUserPut = async () => {
    if (!userId || !userName || !userEmail) {
      setOutput(<p className="warning-msg">Saisissez l'ID Utilisateur, le Nom et l'Email .</p>);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, email: userEmail }),
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card success">
            <strong>Utilisateur {userId} remplacé avec succès !</strong><br />
            Nom : {data.name} | Email : {data.email}
          </div>
        );
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const updateUserPatch = async () => {
    if (!userId) {
      setOutput(<p className="warning-msg">Saisissez un ID Utilisateur pour PATCH.</p>);
      return;
    }

    const bodyData = {};
    if (userName) bodyData.name = userName;
    if (userEmail) bodyData.email = userEmail;

    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card success">
            <strong>Utilisateur {userId} modifié avec succès !</strong><br />
            Nom : {data.name} | Email : {data.email}
          </div>
        );
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  const deleteUserByPost = async () => {
    if (!postId) {
      setOutput(<p className="warning-msg">Saisissez un ID de post pour supprimer l'utilisateur.</p>);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/by-post/${postId}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setOutput(
          <div className="result-card error">
            <strong>{data.message}</strong>
          </div>
        );
        // refresh users and posts
        getUsers();
        getAllPosts();
      } else {
        setOutput(<p className="error-msg">Erreur : {data.error}</p>);
      }
    } catch (err) {
      setOutput(<p className="error-msg">Erreur : {err.message}</p>);
    }
  };

  return (
    <div className="container">
      <h1>Dashboard </h1>

      <div className="card form-card">
        <h3>Gestion des utilisateurs</h3>
        <div className="grid-2">
          <div>
            <label>Nom</label>
            <input placeholder="Nom" type="text" id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} />
            <label>Email</label>
            <input placeholder="Email" type="email" id="userEmail" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
            <label>User ID (pour afficher posts)</label>
            <input placeholder="User ID" type="number" id="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="button-grid">
        <button className="btn btn-primary" onClick={() => createUser(false)}>Créer / Vérifier</button>
        <button className="btn btn-secondary" onClick={modifyUser}>Modifier</button>
        <button className="btn btn-info" onClick={() => getUserPosts()}>liste des posts du user</button>
        <button className="btn btn-outline" onClick={getUsers}>liste de tous les users</button>
      </div>

      <div className="card response-card">
        <h3>Résultat</h3>
        <div id="output" className="output-box">
          {output}
        </div>
      </div>
    </div>
  );
}