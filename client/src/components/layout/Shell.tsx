import { NavLink, Outlet } from 'react-router-dom';

export default function Shell() {
  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="border-b border-navy-700 px-6 py-0"
        style={{ background: 'linear-gradient(180deg, #0a1628 0%, #060f24 100%)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center h-14 gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 select-none">
            <span className="text-2xl">⚾</span>
            <span className="text-xl font-black tracking-tight text-white">
              e<span className="text-blue-400">Score</span>
            </span>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-navy-600" />

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/teams"
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            >
              Teams
            </NavLink>
            <NavLink
              to="/games"
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            >
              Games
            </NavLink>
            <NavLink
              to="/leagues"
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            >
              Leagues
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
