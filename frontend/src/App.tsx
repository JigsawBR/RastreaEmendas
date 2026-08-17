import { NavLink, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center gap-8">
          <NavLink to="/" className="text-lg font-semibold text-slate-900">
            Rastrea<span className="text-emerald-600">Emendas</span>
          </NavLink>
          <nav className="flex gap-6 text-sm">
            <NavLink to="/" end className={({ isActive }) =>
              isActive ? "text-emerald-700 font-medium" : "text-slate-600 hover:text-slate-900"
            }>Dashboard</NavLink>
            <NavLink to="/emendas" className={({ isActive }) =>
              isActive ? "text-emerald-700 font-medium" : "text-slate-600 hover:text-slate-900"
            }>Emendas</NavLink>
            <NavLink to="/municipios" className={({ isActive }) =>
              isActive ? "text-emerald-700 font-medium" : "text-slate-600 hover:text-slate-900"
            }>Municipios</NavLink>
          </nav>
          <div className="ml-auto text-xs text-slate-500">
            TCC IFPB Cajazeiras - Paraiba
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
