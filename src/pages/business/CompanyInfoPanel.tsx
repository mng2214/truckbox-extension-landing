import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { mcDigits, plainText } from "../../lib/inputGuards";

type AccountSettings = { mcNumber: string | null; companyName: string | null; firstName: string | null };

const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.72rem", letterSpacing: "0.06em",
  textTransform: "uppercase", color: "var(--muted)", marginBottom: 7,
};
const FIELD: React.CSSProperties = {
  width: "100%", padding: "0.6rem 0.7rem", fontSize: "0.9rem",
  color: "var(--ink)", background: "transparent",
  border: "1px solid var(--hairline)", outline: "none",
};

export function CompanyInfoPanel() {
  const [mc, setMc] = useState("");
  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = (s: AccountSettings) => {
    setMc(s.mcNumber ?? "");
    setCompany(s.companyName ?? "");
    setFirstName(s.firstName ?? "");
  };

  useEffect(() => {
    api
      .get<AccountSettings>("/api/v1/account/settings")
      .then(apply)
      .catch(() => setError("Failed to load company info."))
      .finally(() => setLoading(false));
  }, []);

  const save = () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    api
      .put<AccountSettings>("/api/v1/account/settings", { mcNumber: mc, companyName: company, firstName })
      .then((s) => {
        apply(s);
        setSaved(true);
      })
      .catch(() => setError("Failed to save. Try again."))
      .finally(() => setSaving(false));
  };

  return (
    <section style={{ maxWidth: 720 }}>
      <h1 className="ed-display">Company info</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Who the Agent speaks and signs as when it writes to brokers for you.
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
        <div>
          <label style={LABEL}>First name</label>
          <input
            value={firstName}
            maxLength={60}
            disabled={loading}
            onChange={(e) => { setFirstName(plainText(e.target.value)); setSaved(false); }}
            placeholder="e.g. Mike"
            style={FIELD}
          />
        </div>
        <div>
          <label style={LABEL}>Company name</label>
          <input
            value={company}
            maxLength={120}
            disabled={loading}
            onChange={(e) => { setCompany(plainText(e.target.value)); setSaved(false); }}
            placeholder="e.g. TruckBox Logistics LLC"
            style={FIELD}
          />
        </div>
        <div>
          <label style={LABEL}>MC number</label>
          <input
            value={mc}
            maxLength={10}
            disabled={loading}
            onChange={(e) => { setMc(mcDigits(e.target.value)); setSaved(false); }}
            placeholder="e.g. 123456"
            inputMode="numeric"
            style={FIELD}
          />
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{error}</p>}

        <div style={{ paddingTop: "1.25rem", borderTop: "1px solid var(--hairline)" }}>
          <button type="button" className="ed-btn ed-btn-accent" disabled={loading || saving} onClick={save}>
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
