import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";
import App, { SmoothScroll } from "./App";
import PrivacyPage from "./pages/Privacy";
import GuidePage from "./pages/Guide";
import DatExample from "./pages/DatExample";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SmoothScroll />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/dat" element={<DatExample />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
