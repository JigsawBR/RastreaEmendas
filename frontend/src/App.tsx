import {
  NavLink,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Icon } from "./shared/components/Icon";

export default function App() {
  const location = useLocation();
  const [search] = useSearchParams();
  const stateDetail = location.pathname.startsWith("/emendas-estaduais/");
  const source =
    stateDetail || search.get("origem") === "estadual" ? "estadual" : "federal";
  const year = stateDetail
    ? location.pathname.split("/")[2]
    : search.get("ano");
  const query = new URLSearchParams({ origem: source });
  if (year) query.set("ano", year);
  const scope = "?" + query.toString();
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <div className="header-inner">
          <NavLink to={"/" + scope} className="brand">
            <span className="brand-mark">
              <Icon name="route" size={20} />
            </span>
            RastreaEmendas
          </NavLink>
          <nav aria-label="Navegação principal">
            <NavLink to="/" end>
              Visão geral
            </NavLink>
            <NavLink
              to={"/emendas" + scope}
              className={
                location.pathname.startsWith("/emendas") ? "active" : ""
              }
            >
              Emendas
            </NavLink>
            <NavLink to="/municipios">Municípios</NavLink>
            <NavLink to={"/sobre-os-dados" + scope}>Sobre os dados</NavLink>
          </nav>
          <span className="header-caption">PARAÍBA / DADOS ABERTOS</span>
        </div>
      </header>
      <main id="main-content" className="page-container">
        <Outlet />
      </main>
      <footer className="site-footer">
        RastreaEmendas · Transparência para a Paraíba / TCC · IFPB Cajazeiras
      </footer>
    </div>
  );
}
