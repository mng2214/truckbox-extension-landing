import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";
import App, { SmoothScroll } from "./App";
import { installPageGuard } from "./lib/guard";
import PrivacyPage from "./pages/Privacy";
import GuidePage from "./pages/Guide";
import FAQPage from "./pages/FAQ";
import SuccessPage from "./pages/Success";
import CancelPage from "./pages/Cancel";
import Cabinet from "./pages/business/Cabinet";

installPageGuard();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SmoothScroll />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
        <Route path="/business" element={<Cabinet />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
