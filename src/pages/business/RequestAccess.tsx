import { useForm, ValidationError } from "@formspree/react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../../lib/meta";

export default function RequestAccess() {
  usePageMeta({ title: "Set up a team — TruckBox", description: "Request TruckBox access for your dispatch team.", path: "/business/request", noindex: true });
  const [state, handleSubmit] = useForm("xnjyvqjv");

  if (state.succeeded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="ed-display text-[8vw] lg:text-[3rem]">Request received</h1>
        <p className="max-w-md" style={{ color: "var(--muted)" }}>
          Thanks. We will review your company and email you a setup link shortly.
        </p>
        <Link className="ed-btn" to="/">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full">
        <h1 className="ed-display text-[8vw] lg:text-[2.5rem]">Set up a team</h1>
        <p style={{ color: "var(--muted)" }}>
          Tell us about your company and we will email you a setup link.
        </p>
        <input type="hidden" name="_subject" value="Company access request" />
        <input className="border px-3 py-2" name="company" placeholder="Company name" required />
        <input className="border px-3 py-2" type="email" name="email" placeholder="Work email" required />
        <ValidationError prefix="Email" field="email" errors={state.errors} className="ed-error" />
        <input
          className="border px-3 py-2"
          type="tel"
          name="phone"
          placeholder="Phone number"
          autoComplete="tel"
          inputMode="tel"
          required
        />
        <ValidationError prefix="Phone" field="phone" errors={state.errors} className="ed-error" />
        <input className="border px-3 py-2" name="mc_number" placeholder="MC number (optional)" />
        <input
          className="border px-3 py-2"
          name="fleet_size"
          placeholder="How many dispatchers?"
          inputMode="numeric"
          required
        />
        <button className="ed-btn ed-btn-accent" type="submit" disabled={state.submitting}>
          Request access
        </button>
        <ValidationError errors={state.errors} className="ed-error" />
      </form>
    </div>
  );
}
