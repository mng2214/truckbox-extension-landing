/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import React, { Suspense, lazy, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles.css";
import App, { SmoothScroll } from "./App";
import { captureSource } from "./lib/demoTrack";
import { clearStaleMicrosoftResult } from "./lib/microsoft";
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
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));
const DatToolsPage = lazy(() => import("./pages/DatTools"));
const ExtensionPanel = lazy(() => import("./pages/admin/ExtensionPanel"));
const DirectoryPanel = lazy(() => import("./pages/admin/DirectoryPanel"));
const BackOfficePanel = lazy(() => import("./pages/admin/BackOfficePanel"));

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

/**
 * Keeps the support chat off the admin dashboards. index.html already skips loading Crisp when
 * the page opens on /admin2214, but a click through from the site loads it before we get here,
 * so the widget is hidden on the way in and put back on the way out.
 */
function CrispOffAdmin() {
  const { pathname } = useLocation();
  useEffect(() => {
    const onAdmin = pathname.startsWith("/admin2214");
    // The class is what actually removes it: Crisp's own hide command only applies once its
    // widget has finished loading, and on a click through from the site it may already be there.
    document.documentElement.classList.toggle("tb-no-crisp", onAdmin);
    (window as unknown as { $crisp?: unknown[] }).$crisp?.push([
      "do",
      onAdmin ? "chat:hide" : "chat:show",
    ]);
  }, [pathname]);
  return null;
}

captureSource();
clearStaleMicrosoftResult();

installPageGuard();

if (import.meta.env.PROD) installDevtoolsDetector();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SmoothScroll />
      <LandingThemeSync />
      <CrispOffAdmin />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/update" element={<UpdatePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/dat-load-board-tools" element={<DatToolsPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/admin2214" element={<AdminHome />} />
        <Route path="/admin2214/visits" element={<VisitsPanel />} />
        <Route path="/admin2214/extension" element={<ExtensionPanel />} />
        <Route path="/admin2214/accounts" element={<DirectoryPanel />} />
        <Route path="/admin2214/backoffice" element={<BackOfficePanel />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
        <Route path="/business/start" element={<TeamStart />} />
        <Route path="/business/invite" element={<Navigate to="/business/start" replace />} />
        <Route path="/business/request" element={<Navigate to="/business/start" replace />} />
        <Route path="/business/oauth/microsoft" element={<MicrosoftCallback />} />
        <Route path="/business" element={<Cabinet />} />
        <Route path="/business/:section" element={<Cabinet />} />
        <Route path="/business/:section/:id" element={<Cabinet />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
