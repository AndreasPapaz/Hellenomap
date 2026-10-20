"use client";

import { useActionState } from "react";
import { requestSignInLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestSignInLink, { sent: false });
  if (state.sent) {
    return (
      <p role="status" className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-green-900" data-testid="login-sent">
        If that email belongs to an owner account, a sign-in link is on its way.
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3">
      <label htmlFor="email" className="block font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="block w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="h-10 rounded-full bg-[#0d5eaf] px-5 font-medium text-white disabled:opacity-60">
        {pending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
