import React, { Suspense, lazy, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles.css";
import App, { SmoothScroll } from "./App";
import { captureSource } from "./lib/demoTrack";
import { installPageGuard, installDevtoolsDetector } from "./lib/guard";
import { applyLandingTheme, setLandingTheme } from "./lib/theme";
import PrivacyPage from "./pages/Privacy";
import GuidePage from "./pages/Guide";
import UpdatePage from "./pages/Update";
import FAQPage from "./pages/FAQ";
import SuccessPage from "./pages/Success";
import CancelPage from "./pages/Cancel";
const Cabinet = lazy(() => import("./pages/business/Cabinet"));
const TeamStart = lazy(() => import("./pages/business/TeamStart"));
const MicrosoftCallback = lazy(() => import("./pages/business/MicrosoftCallback"));
const DemoPage = lazy(() => import("./pages/demo/DemoPage"));
const VisitsPanel = lazy(() => import("./pages/admin/VisitsPanel"));

{
  const q = new URLSearchParams(location.search).get("theme");
  if (q === "light" || q === "dark") setLandingTheme(q);
  else applyLandingTheme();
}

function LandingThemeSync() {
  const { pathname } = useLocation();
  useEffect(() => applyLandingTheme(pathname), [pathname]);
  return null;
}

captureSource();

installPageGuard();

if (import.meta.env.PROD) installDevtoolsDetector();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SmoothScroll />
      <LandingThemeSync />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/update" element={<UpdatePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/admin2214/visits" element={<VisitsPanel />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
        <Route path="/business/start" element={<TeamStart />} />
        <Route path="/business/invite" element={<Navigate to="/business/start" replace />} />
        <Route path="/business/request" element={<Navigate to="/business/start" replace />} />
        <Route path="/business/oauth/microsoft" element={<MicrosoftCallback />} />
        <Route path="/business" element={<Cabinet />} />
        <Route path="/business/:section" element={<Cabinet />} />
        <Route path="/business/:section/:id" element={<Cabinet />} />
        <Route path="*" element={<App />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
