"use client";

import { useActionState, useTransition } from "react";
import { submitPartnerApplicationAction } from "@/app/partner/actions";

interface Props {
  defaultValues?: {
    business_name?: string;
    contact_email?: string;
    location?: string;
    description?: string;
    services?: string[] | null;
  };
  existingServices?: string[];
  isUpgrade?: boolean;
}

const SERVICE_OPTIONS = [
  {
    value: "experience",
    icon: "🤿",
    name: "Experience",
    desc: "Scuba diving, snorkeling, boat tours, guided marine activities",
  },
  {
    value: "sell",
    icon: "🛒",
    name: "Sell",
    desc: "Sell marine equipment, diving gear, and ocean products",
  },
  {
    value: "rent",
    icon: "⚓",
    name: "Rent",
    desc: "Rent out dive kits, cylinders, boats, and related gear",
  },
];

const initial = { error: null, success: null };

export default function PartnerApplyForm({
  defaultValues,
  existingServices = [],
  isUpgrade = false,
}: Props) {
  const [state, formAction] = useActionState(submitPartnerApplicationAction, initial);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form className="partner-form" onSubmit={handleSubmit}>
      {state.error && (
        <div className="pf-alert pf-alert-error" role="alert">
          ⚠ {state.error}
        </div>
      )}
      {state.success && (
        <div className="pf-alert pf-alert-success" role="status">
          ✓ {state.success}
        </div>
      )}

      <div className="pf-group">
        <label className="pf-label" htmlFor="pa-business-name">
          Business / Provider Name <span style={{ color: "#fca5a5" }}>*</span>
        </label>
        <input
          id="pa-business-name"
          name="business_name"
          type="text"
          className="pf-input"
          placeholder="e.g. Aqua Dive Goa"
          maxLength={100}
          required
          defaultValue={defaultValues?.business_name ?? ""}
        />
      </div>

      <div className="pf-group">
        <label className="pf-label" htmlFor="pa-contact-email">
          Contact Email <span style={{ color: "#fca5a5" }}>*</span>
        </label>
        <input
          id="pa-contact-email"
          name="contact_email"
          type="email"
          className="pf-input"
          placeholder="contact@yourbusiness.com"
          defaultValue={defaultValues?.contact_email ?? ""}
          required
        />
      </div>

      <div className="pf-group">
        <label className="pf-label" htmlFor="pa-location">
          Location / Operating Area
        </label>
        <input
          id="pa-location"
          name="location"
          type="text"
          className="pf-input"
          placeholder="e.g. Goa, India"
          maxLength={120}
          defaultValue={defaultValues?.location ?? ""}
        />
      </div>

      <div className="pf-group">
        <label className="pf-label" htmlFor="pa-description">
          About Your Business <span style={{ color: "#fca5a5" }}>*</span>
        </label>
        <textarea
          id="pa-description"
          name="description"
          className="pf-textarea"
          rows={4}
          placeholder="Tell us about your marine business, certifications, and what you offer..."
          maxLength={1000}
          defaultValue={defaultValues?.description ?? ""}
          required
        />
      </div>

      <div className="pf-group">
        <span className="pf-label">
          {isUpgrade ? "Select Services to Add" : "Service Types"} <span style={{ color: "#fca5a5" }}>*</span>
        </span>
        <div className="pf-service-grid">
          {SERVICE_OPTIONS.map((opt) => {
            const isActive = existingServices.includes(opt.value);
            return (
              <div
                key={opt.value}
                className="pf-service-option"
                style={isActive ? { opacity: 0.85, borderColor: "rgba(56, 189, 248, 0.5)", background: "rgba(14, 165, 233, 0.08)" } : undefined}
              >
                {isActive ? (
                  <>
                    <input
                      type="checkbox"
                      id={`svc-${opt.value}`}
                      checked={true}
                      disabled
                      aria-label={`${opt.name} (Active)`}
                    />
                    <input type="hidden" name="services" value={opt.value} />
                  </>
                ) : (
                  <input
                    type="checkbox"
                    id={`svc-${opt.value}`}
                    name="services"
                    value={opt.value}
                    defaultChecked={defaultValues?.services?.includes(opt.value)}
                  />
                )}
                <label className="pf-service-label" htmlFor={`svc-${opt.value}`}>
                  <span className="pf-service-icon" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <span className="pf-service-name">
                    {opt.name}
                    {isActive && (
                      <span
                        style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#38bdf8",
                          background: "rgba(14, 165, 233, 0.15)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-block",
                        }}
                      >
                        ✓ Active
                      </span>
                    )}
                  </span>
                  <span className="pf-service-desc">{opt.desc}</span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <button
        id="pa-submit-btn"
        type="submit"
        className="pf-submit-btn"
        disabled={pending}
      >
        {pending
          ? "Submitting…"
          : isUpgrade
          ? "Submit Service Upgrade Request →"
          : "Submit Application →"}
      </button>
    </form>
  );
}
