import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5002/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLogin, setIsLogin] = useState(true);
  
  // Dynamic Views
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data States
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [deletedUsers, setDeletedUsers] = useState([]);
  
  // Forms
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [error, setError] = useState('');
  const [promoteId, setPromoteId] = useState('');
  const [promoteMsg, setPromoteMsg] = useState('');
  // Sidebar button
  const [isOpen, setIsOpen] = useState(false);
  const toggleSidebar = () => {setIsOpen(!isOpen);};
  // Post filters
  const [filterType, setFilterType] = useState('name');
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, [token]);

  useEffect(() => {
    fetchPosts();
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      fetchUsers();
    }
    if (user && user.role === 'superadmin') {
      fetchDeletedUsers();
    }
  }, [user]);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/posts`);
      const data = await res.json();
      if (Array.isArray(data)) setPosts(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Promote user to admin (superadmin only)
  const handlePromoteUser = async (e) => {
    e?.preventDefault?.();
    setPromoteMsg('');
    if (!promoteId) return setPromoteMsg('Entrez un ID valide');
    try {
      const res = await fetch(`${API_URL}/users/${promoteId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) return setPromoteMsg(data.error || 'Erreur lors de la promotion');
      setPromoteMsg('Utilisateur promu en admin avec succès');
      setPromoteId('');
      fetchUsers();
    } catch (err) {
      setPromoteMsg('Erreur réseau');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeletedUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users/deleted`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setDeletedUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/auth/login' : '/auth/signup';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur d authentification');
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      // after successful login, show refreshed dashboard by default
      setActiveTab('dashboard');
      fetchPosts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newPost)
      });
      if (res.ok) {
        setNewPost({ title: '', content: '' });
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePost = async (id) => {
    try {
      const res = await fetch(`${API_URL}/posts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
        if (user.role === 'superadmin') fetchDeletedUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/users/${id}/restore`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
        fetchDeletedUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <h2 style={{ textAlign: 'center' }}>{isLogin ? 'Connexion' : 'Créer un compte'}</h2>
          
          {error && <p style={{ color: 'red', fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</p>}
          <form onSubmit={handleAuth}>
            {!isLogin && (
              <div className="form-group">
                <label>Nom complet</label>
                <input
                  type="text"
                  className="input-field"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Adresse Email</label>
              <input
                type="email"
                className="input-field"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Mot de passe</label>
              <input
                type="password"
                className="input-field"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
          <div className="auth-toggle">
            {isLogin ? "Vous n'avez pas de compte ? " : 'Déjà un compte ? '}
            <span onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "S'inscrire" : 'Se connecter'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
      
    <div className="dashboard-layout">
       {/* The Side Button */}
      <button 
        className={`side-button ${isOpen ? 'active' : ''}`} 
        onClick={toggleSidebar}
      >
        {isOpen ? '✕' : '→'}
      </button>
      {/* Sidebar Gauche */}
      <div className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
        <div>
          <div className="brand-logo"> Post Studio</div>
          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            {(user.role === 'admin' || user.role === 'superadmin') && (
              <button 
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                Utilisateurs
              </button>
            )}
            {user.role === 'superadmin' && (
              <button 
                className={`nav-item ${activeTab === 'trash' ? 'active' : ''}`}
                onClick={() => setActiveTab('trash')}
              >
                Corbeille
              </button>
            )}
            {user.role === 'superadmin' && (
              <button
                className={`nav-item ${activeTab === 'nommer' ? 'active' : ''}`}
                onClick={() => setActiveTab('nommer')}
              >
                Nommer Admin
              </button>
            )}
          </nav>
        </div>
        <div className="user-profile-widget">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>
          <button className="btn-danger-sm" onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>

      {/* Panneau Central (Flux) */}
      <main className="main-content">
        <div className="content-header">
          <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
        </div>
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: 6 }}>
                <option value="name">Author name</option>
                <option value="id">Author id</option>
                <option value="email">Author email</option>
                <option value="role">Author role</option>
              </select>
              <input className="input-field" placeholder={`Filter by ${filterType}`} value={filterValue} onChange={(e) => setFilterValue(e.target.value)} style={{ width: 240 }} />
              <button className="btn-primary" onClick={() => setFilterValue('')}>Clear</button>
            </div>

            {(() => {
              const q = filterValue.trim().toLowerCase();
              const filtered = q === '' ? posts : posts.filter((post) => {
                if (filterType === 'name') return (post.author_name || '').toLowerCase().includes(q);
                if (filterType === 'id') return String(post.user_id) === q || String(post.user_id).includes(q);
                if (filterType === 'email') return (post.author_email || '').toLowerCase().includes(q);
                if (filterType === 'role') return (post.author_role || '').toLowerCase().includes(q);
                return true;
              });

              return filtered.map((post) => (
                <div key={post.id} className="post-card">
                <div className="post-header">
                  <span className="post-title">{post.title}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`badge badge-${post.author_role}`}>{post.author_role}</span>
                    <button className="btn-danger-sm" onClick={() => handleDeletePost(post.id)}>Supprimer</button>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#475569' }}>{post.content}</p>
                <span className="post-meta">Par {post.author_name} ({post.author_email})</span>
              </div>
              ));
            })()}
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            {users.map((u) => (
              <div key={u.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#334155' }}>ID: <strong>{u.id}</strong></div>
                  <strong>{u.name}</strong> ({u.email})
                  <div><span className={`badge badge-${u.role}`}>{u.role}</span></div>
                </div>
                {u.id !== user.id && (
                  <button className="btn-danger-sm" onClick={() => handleDeleteUser(u.id)}>Soft Delete</button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'trash' && (
          <div>
            {deletedUsers.map((u) => (
              <div key={u.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#334155' }}>ID: <strong>{u.id}</strong></div>
                  <strong>{u.name}</strong> ({u.email})
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Supprimé le: {u.deleted_at}</div>
                </div>
                <button className="btn-primary" style={{ width: 'auto', padding: '4px 12px' }} onClick={() => handleRestoreUser(u.id)}>Restaurer</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'nommer' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <p>Entrez l'ID de l'utilisateur à promouvoir en admin</p>
            <form onSubmit={handlePromoteUser} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                value={promoteId}
                onChange={(e) => setPromoteId(e.target.value)}
                placeholder="ID utilisateur"
              />
              <button className="btn-primary" type="submit">Promouvoir</button>
            </form>
            {promoteMsg && (
              <div style={{ marginTop: 8, color: promoteMsg.includes('succès') ? 'green' : 'red' }}>{promoteMsg}</div>
            )}
          </div>
        )}
      </main>

      
      <aside className="right-panel">
        <div className="panel-title">Nouveau Post</div>
        <form onSubmit={handleCreatePost}>
          <div className="form-group">
            <label>Titre</label>
            <input
              type="text"
              className="input-field"
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Contenu</label>
            <textarea
              className="input-field"
              rows="4"
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            ></textarea>
          </div>
          <button type="submit" className="btn-primary">Publier</button>
        </form>
      </aside>
    </div>
  );
}