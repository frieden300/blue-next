"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface ActionState {
  error?: string | null;
  success?: string | null;
  info?: string | null;
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { error: "Please provide both email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Provide clean, understandable college demo error messages
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Invalid email or password. Please verify your credentials." };
    }
    if (error.message.includes("Email not confirmed")) {
      return {
        error:
          "Email address not confirmed. Please check your inbox to confirm your email, then log in again.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/account");
  redirect("/account");
}

export async function signupAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const displayName = formData.get("displayName")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  if (!displayName || !email || !password) {
    return { error: "Please fill in all required fields." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "An account with this email address already exists. Try signing in." };
    }
    return { error: error.message };
  }

  // Check if email confirmation is required by Supabase settings
  if (data.user && !data.session) {
    return {
      info:
        "Registration successful! Please check your inbox to confirm your email address, then log in to your account.",
    };
  }

  revalidatePath("/account");
  redirect("/account");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/account");
  redirect("/account");
}

export async function updateDisplayNameAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const displayName = formData.get("displayName")?.toString().trim();

  if (!displayName) {
    return { error: "Display name cannot be empty." };
  }

  if (displayName.length > 50) {
    return { error: "Display name must be 50 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: `Failed to update profile: ${error.message}` };
  }

  revalidatePath("/account");
  return { success: "Display name updated successfully." };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return { error: "Please provide a valid email address." };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      if (
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("security purposes")
      ) {
        return {
          error: "For security purposes, please wait a minute before requesting another code.",
        };
      }
    }
  } catch {
    // Graceful handling to prevent leaking internals
  }

  // Generic message prevents account enumeration
  return {
    error: null,
    success:
      "If an account is associated with this email, an 8-digit verification code has been sent. You can check your inbox on any device and enter the code below.",
  };
}

export async function resendPasswordResetOtpAction(email: string): Promise<ActionState> {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return { error: "Please enter a valid email address to resend the code." };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      if (
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("security purposes")
      ) {
        return {
          error: "Please wait before requesting another recovery code (rate limit active).",
        };
      }
    }
  } catch {
    // Graceful handling
  }

  return {
    error: null,
    success: "A new 8-digit verification code has been dispatched. Please check your inbox.",
  };
}

export async function verifyOtpAndResetPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const token = formData.get("token")?.toString().trim();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  if (!email || !isValidEmail(email)) {
    return { error: "Please provide a valid email address." };
  }

  if (!token || !/^\d{8}$/.test(token)) {
    return { error: "Please enter a valid 8-digit verification code." };
  }

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match. Please verify both fields." };
  }

  const supabase = await createClient();

  // 1. Verify the 8-digit OTP for recovery
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });

  if (verifyError || !verifyData.user) {
    const msg = verifyError?.message?.toLowerCase() || "";
    if (msg.includes("expired")) {
      return {
        error: "This recovery code has expired. Please request a new code.",
      };
    }
    if (msg.includes("invalid") || msg.includes("token")) {
      return {
        error: "The 8-digit verification code is invalid or has already been used. Please check your email or request a new code.",
      };
    }
    if (msg.includes("rate limit") || msg.includes("security")) {
      return {
        error: "Too many failed attempts. Please wait a moment before trying again.",
      };
    }
    return {
      error: "Unable to verify the recovery code. Please ensure it was entered correctly or request a new one.",
    };
  }

  // 2. Confirm authenticated Supabase recovery session is active
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== verifyData.user.id) {
    return {
      error: "Authenticated recovery session could not be established. Please request a new code.",
    };
  }

  // 3. Update the password securely via Supabase Auth API
  const { error: updateError } = await supabase.auth.updateUser({
    password,
  });

  if (updateError) {
    return {
      error: updateError.message || "Failed to update password. Please try again.",
    };
  }

  // 4. Sign out of the temporary recovery session so the user must sign in cleanly
  await supabase.auth.signOut();

  revalidatePath("/account");

  return {
    error: null,
    success:
      "Password updated successfully! You can now sign in with your new password.",
  };
}
