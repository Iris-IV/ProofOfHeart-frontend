"use client";

import { useState } from "react";
import { ShieldCheck, KeyRound, CheckCircle2, Copy, RefreshCw } from "lucide-react";

// TOTP setup steps
type Step = "intro" | "qr" | "verify" | "done";

// Deterministically derive a display secret from a wallet address for demo purposes.
// A real implementation would call a backend /auth/totp/setup endpoint.
function deriveMockSecret(address: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  let secret = "";
  for (let i = 0; i < 16; i++) {
    secret += chars[seed % 32];
    seed = (seed * 1664525 + 1013904223) >>> 0;
  }
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

interface Props {
  adminAddress: string;
}

export default function AdminTwoFactorSetup({ adminAddress }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const secret = deriveMockSecret(adminAddress);
  const issuer = "ProofOfHeart";
  const account = adminAddress.slice(0, 8) + "…" + adminAddress.slice(-4);
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret.replace(/\s/g, "")}&issuer=${encodeURIComponent(issuer)}`;

  function handleCopy() {
    navigator.clipboard.writeText(secret.replace(/\s/g, "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    // In production, POST the code to /api/auth/totp/verify.
    // Here we accept any 6-digit code as a UI demo.
    if (/^\d{6}$/.test(code)) {
      setError("");
      setStep("done");
    } else {
      setError("Enter the 6-digit code from your authenticator app.");
    }
  }

  if (step === "intro") {
    return (
      <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="text-emerald-500" size={24} />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Two-Factor Authentication
          </h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Protect this admin account with a time-based one-time password (TOTP). You will need an
          authenticator app such as Google Authenticator, Authy, or 1Password.
        </p>
        <button
          onClick={() => setStep("qr")}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <KeyRound size={16} />
          Set up 2FA
        </button>
      </div>
    );
  }

  if (step === "qr") {
    return (
      <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="text-emerald-500" size={24} />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Scan QR Code
          </h2>
        </div>

        {/* QR placeholder — rendered as a grid pattern until a real QR library is wired */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div
            className="w-48 h-48 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 p-4"
            aria-label="QR code placeholder"
          >
            <svg viewBox="0 0 9 9" className="w-32 h-32" aria-hidden="true">
              {/* Finder pattern top-left */}
              <rect x="0" y="0" width="3" height="3" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="1" y="1" width="1" height="1" fill="white" />
              {/* Finder pattern top-right */}
              <rect x="6" y="0" width="3" height="3" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="7" y="1" width="1" height="1" fill="white" />
              {/* Finder pattern bottom-left */}
              <rect x="0" y="6" width="3" height="3" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="1" y="7" width="1" height="1" fill="white" />
              {/* Data modules */}
              <rect x="4" y="1" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="4" y="3" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="3" y="4" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="5" y="4" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="4" y="5" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="4" y="7" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="6" y="5" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="7" y="6" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="6" y="7" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
              <rect x="8" y="7" width="1" height="1" fill="currentColor" className="text-zinc-900 dark:text-zinc-100" />
            </svg>
            <span className="text-[10px] text-zinc-400 text-center leading-tight">
              Scan with your authenticator app
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Can&apos;t scan? Enter this secret manually:
          </p>
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
            <code className="text-sm font-mono text-zinc-800 dark:text-zinc-200 tracking-widest">
              {secret}
            </code>
            <button
              onClick={handleCopy}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Copy secret"
            >
              {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 max-w-xs text-center">
            otpauth URL (for manual import):
            <br />
            <a
              href={otpauthUrl}
              className="text-blue-500 hover:underline break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {otpauthUrl.slice(0, 60)}…
            </a>
          </p>
        </div>

        <button
          onClick={() => setStep("verify")}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          I&apos;ve scanned it — next
        </button>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="text-emerald-500" size={24} />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Verify Code
          </h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Enter the 6-digit code your authenticator app shows for ProofOfHeart.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col gap-4 max-w-xs">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="One-time password"
            autoComplete="one-time-code"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("qr")}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw size={14} />
              Back
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Verify
            </button>
          </div>
        </form>
      </div>
    );
  }

  // done
  return (
    <div className="rounded-[2rem] border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <CheckCircle2 className="text-emerald-500" size={24} />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          2FA Enabled
        </h2>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Two-factor authentication is active for this admin account. You will be prompted for a TOTP
        code on each sensitive action.
      </p>
    </div>
  );
}
