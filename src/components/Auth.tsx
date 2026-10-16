import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import GdgLogo from "./GdgLogo";
import { button, input } from "./Profile";
import {
  api,
  BRANCHES,
  emailError,
  PASSWORD_RULE,
  safeNext,
  signupErrors,
  YEARS,
  type Signup,
} from "../lib/profile";

type Mode = "login" | "signup";
const EMPTY: Signup = { name: "", email: "", password: "", confirm: "", branch: "", year: undefined };

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: (a: object) => ReactNode;
}) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={name} className="text-sm font-bold">
        {label}
      </label>
      <div className="mt-1">
        {children({ id: name, name, "aria-invalid": !!error, "aria-describedby": describedBy })}
      </div>
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-err`} className="mt-1 text-sm font-bold text-gred">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Auth() {
  const params = new URLSearchParams(location.hash.split("?")[1]);
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [form, setForm] = useState<Signup>(() => ({
    ...EMPTY,
    name: params.get("name") ?? "",
    email: params.get("email") ?? "",
    year: Number(params.get("year")) || undefined,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<Signup>) => setForm((f) => ({ ...f, ...patch }));
  const signup = mode === "signup";

  useEffect(() => {
    api("/users/me")
      .then(() => {
        location.hash = "#" + next;
      })
      .catch(() => {});
  }, [next]);

  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }, [errors]);

  const switchTo = (m: Mode) => {
    setMode(m);
    setErrors({});
    setMsg("");
    set({ password: "", confirm: "" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) {
      return;
    }

    let errs: Record<string, string> = {};
    if (signup) {
      errs = signupErrors(form);
    } else {
      const emailProblem = emailError(form.email.trim());
      if (emailProblem) {
        errs.email = emailProblem;
      }
      if (!form.password) {
        errs.password = "Enter your password.";
      }
    }

    setErrors(errs);
    setMsg("");
    if (Object.keys(errs).length) {
      return;
    }

    setBusy(true);
    try {
      if (signup) {
        const { confirm: _, ...body } = form;
        await api("/auth/register", "POST", body);
      } else {
        await api("/auth/login", "POST", { email: form.email, password: form.password });
      }
      location.hash = "#" + next;
    } catch (err) {
      setMsg((err as Error).message);
      setErrors((err as { errors?: Record<string, string> }).errors ?? {});
    } finally {
      setBusy(false);
    }
  };

  const pw = show ? "text" : "password";

  let submitLabel = signup ? "Create account" : "Log in";
  if (busy) {
    submitLabel = signup ? "Creating account…" : "Logging in…";
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <a href="#" aria-label="GDGoC PSIT home">
        <GdgLogo variant="lockup" size={220} clear={0} />
      </a>

      <h1 className="mt-8 font-display text-4xl font-extrabold">
        {signup ? "Create your account" : "Log in"}
      </h1>
      <p className="mt-2 text-muted">
        {signup
          ? "Join GDGoC PSIT to register for events and track your tickets."
          : "Welcome back to GDGoC PSIT."}
      </p>

      <form
        key={mode}
        ref={formRef}
        onSubmit={submit}
        noValidate
        className="mt-8 space-y-4 border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7"
      >
        {signup && (
          <Field name="name" label="Full name" error={errors.name}>
            {(a) => (
              <input
                {...a}
                className={input}
                autoFocus
                autoComplete="name"
                maxLength={60}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            )}
          </Field>
        )}
        <Field name="email" label={signup ? "College email" : "Email"} error={errors.email}>
          {(a) => (
            <input
              {...a}
              className={input}
              autoFocus={!signup}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          )}
        </Field>
        {signup && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="branch" label="Branch (optional)" error={errors.branch}>
              {(a) => (
                <select
                  {...a}
                  className={input}
                  value={form.branch}
                  onChange={(e) => set({ branch: e.target.value })}
                >
                  <option value="">Not set</option>
                  {BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field name="year" label="Year (optional)" error={errors.year}>
              {(a) => (
                <select
                  {...a}
                  className={input}
                  value={form.year ?? ""}
                  onChange={(e) => set({ year: Number(e.target.value) || undefined })}
                >
                  <option value="">Not set</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}
        <Field
          name="password"
          label="Password"
          hint={signup ? PASSWORD_RULE : undefined}
          error={errors.password}
        >
          {(a) => (
            <input
              {...a}
              className={input}
              type={pw}
              autoComplete={signup ? "new-password" : "current-password"}
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
            />
          )}
        </Field>
        {signup && (
          <Field name="confirm" label="Confirm password" error={errors.confirm}>
            {(a) => (
              <input
                {...a}
                className={input}
                type={pw}
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => set({ confirm: e.target.value })}
              />
            )}
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
        </label>

        <p role="alert" className="min-h-5 text-sm font-bold text-gred">
          {msg}
        </p>

        <button type="submit" className={`${button} w-full`} disabled={busy}>
          {submitLabel}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        {signup ? "Already have an account? " : "New here? "}
        <button
          type="button"
          className="font-bold underline"
          onClick={() => switchTo(signup ? "login" : "signup")}
        >
          {signup ? "Log in" : "Create an account"}
        </button>
      </p>
    </main>
  );
}
