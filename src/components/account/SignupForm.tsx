"use client";

import { useActionState } from "react";
import { signupAction, type ActionState } from "@/app/account/actions";

const initialState: ActionState = {};

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      {state.error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>⚠️</span>
          <span>{state.error}</span>
        </div>
      )}

      {state.info && (
        <div className="auth-alert auth-alert-info" role="status">
          <span>ℹ️</span>
          <span>{state.info}</span>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="displayName">
          Full Name / Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          placeholder="Captain Nemo"
          className="form-input"
          disabled={isPending}
        />
        <span className="form-hint">Shown on your bookings and reviews</span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="diver@projectblue.org"
          className="form-input"
          disabled={isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          className="form-input"
          disabled={isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          className="form-input"
          disabled={isPending}
        />
      </div>

      <button
        type="submit"
        className="auth-btn-submit"
        disabled={isPending}
      >
        {isPending ? "Creating Account..." : "Create Account"}
      </button>
    </form>
  );
}
