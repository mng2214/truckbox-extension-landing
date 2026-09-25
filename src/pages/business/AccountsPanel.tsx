/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { ContactEmail } from "./ContactEmail";
import { LinkedAccounts } from "./LinkedAccounts";

export function AccountsPanel() {
  return (
    <section style={{ maxWidth: 720 }}>
      <h1 className="ed-display">Accounts</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Where we send you emails, and which Google or Microsoft accounts can sign in to this TruckBox account.
      </p>

      <div
        style={{
          marginTop: 20,
          border: "1px solid var(--hairline)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <ContactEmail />
        <div style={{ borderTop: "1px solid var(--hairline)" }} />
        <LinkedAccounts />
      </div>
    </section>
  );
}
