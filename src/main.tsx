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
import InviteWizard from "./pages/business/InviteWizard";
import RequestAccess from "./pages/business/RequestAccess";

// Anti-copy / anti-devtools guard runs in production only — kept intact, just
// skipped during local development so it doesn't block copy/DevTools while working.
if (import.meta.env.PROD) installPageGuard();

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
        <Route path="/business/invite" element={<InviteWizard />} />
        <Route path="/business/request" element={<RequestAccess />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
