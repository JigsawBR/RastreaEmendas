import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import Home from "./pages/Home.tsx";
import EmendasList from "./pages/EmendasList.tsx";
import EmendaDetail from "./pages/EmendaDetail.tsx";
import Municipios from "./pages/Municipios.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
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
            <Route path="municipios" element={<Municipios />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
