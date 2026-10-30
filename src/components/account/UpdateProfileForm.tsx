"use client";

import { useActionState, useState } from "react";
import { updateDisplayNameAction, type ActionState } from "@/app/account/actions";

interface UpdateProfileFormProps {
  initialDisplayName: string;
}

const initialState: ActionState = {};

export default function UpdateProfileForm({ initialDisplayName }: UpdateProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateDisplayNameAction, initialState);
  const [name, setName] = useState(initialDisplayName);
  const [prevInitialDisplayName, setPrevInitialDisplayName] = useState(initialDisplayName);

  // Sync state when initialDisplayName prop updates (e.g. after server action revalidation)
  if (initialDisplayName !== prevInitialDisplayName) {
    setPrevInitialDisplayName(initialDisplayName);
    setName(initialDisplayName);
  }

  return (
    <form action={formAction} className="auth-form">
      {state.error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>⚠️</span>
          <span>{state.error}</span>
        </div>
      )}

      {state.success && (
        <div className="auth-alert auth-alert-success" role="status">
          <span>✓</span>
          <span>{state.success}</span>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="displayName">
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          disabled={isPending}
        />
        <span className="form-hint">Your public identity on Project Blue</span>
      </div>

      <button
        type="submit"
        className="auth-btn-submit"
        disabled={isPending || name.trim() === initialDisplayName.trim()}
      >
        {isPending ? "Saving changes..." : "Save Display Name"}
      </button>
    </form>
  );
}
