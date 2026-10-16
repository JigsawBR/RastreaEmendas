import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import Home from "./pages/Home.tsx";
import EmendasList from "./pages/EmendasList.tsx";
import EmendaDetail from "./features/federal-amendments/pages/AmendmentDetail.tsx";
import Municipios from "./features/federal-amendments/pages/Municipalities.tsx";
import DataSources from "./pages/DataSources.tsx";
import StateAmendmentDetail from "./features/state-amendments/pages/StateAmendmentDetail.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<Home />} />
            <Route path="emendas" element={<EmendasList />} />
            <Route path="emendas/:codigo" element={<EmendaDetail />} />
            <Route
              path="emendas-estaduais/:ano/:numero"
              element={<StateAmendmentDetail />}
            />
            <Route path="municipios" element={<Municipios />} />
            <Route path="sobre-os-dados" element={<DataSources />} />
            <Route
              path="*"
              element={
                <div className="panel">
                  <h1>Página não encontrada</h1>
                  <a href="/">Voltar à visão geral</a>
                </div>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
