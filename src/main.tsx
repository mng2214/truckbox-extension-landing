import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";
import App, { SmoothScroll } from "./App";
import { installPageGuard, installDevtoolsDetector } from "./lib/guard";
import { installCrispTheme } from "./lib/crispTheme";
import PrivacyPage from "./pages/Privacy";
import GuidePage from "./pages/Guide";
import UpdatePage from "./pages/Update";
import FAQPage from "./pages/FAQ";
import SuccessPage from "./pages/Success";
import CancelPage from "./pages/Cancel";
// Business cabinet is its own app — loaded only on /business/* so landing
// visitors don't download it.
const Cabinet = lazy(() => import("./pages/business/Cabinet"));
const InviteWizard = lazy(() => import("./pages/business/InviteWizard"));
const RequestAccess = lazy(() => import("./pages/business/RequestAccess"));

installPageGuard();
installCrispTheme();

if (import.meta.env.PROD) installDevtoolsDetector();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SmoothScroll />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/update" element={<UpdatePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
        <Route path="/business/invite" element={<InviteWizard />} />
        <Route path="/business/request" element={<RequestAccess />} />
        <Route path="/business" element={<Cabinet />} />
        <Route path="/business/:section" element={<Cabinet />} />
        <Route path="/business/:section/:id" element={<Cabinet />} />
        <Route path="*" element={<App />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
