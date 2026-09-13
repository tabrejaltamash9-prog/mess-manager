import { NavLink, useNavigate, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/', icon: '📊', label: 'Reports', exact: true },
  { path: '/students', icon: '👥', label: 'Students' },
  { path: '/meal-windows', icon: '🍽️', label: 'Meal Windows' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>🍽️ Mess QR</h1>
          <p>Admin Dashboard</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="user-info">
              <p>{user?.name ?? 'Admin'}</p>
              <p>{user?.role === 'admin' ? 'Administrator' : 'Mess Staff'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ marginTop: 12, width: '100%', padding: '8px', background: 'rgba(255,255,255,0.08)', color: 'var(--gray-400)', borderRadius: 8, fontSize: 12, border: 'none', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
