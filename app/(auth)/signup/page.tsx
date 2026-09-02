import React from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">新しい仲間と始める</h1>
        <p className="mt-2 text-xs text-ink-muted">グループで合格までの暗記を習慣化</p>
      </div>
      <SignupForm />
    </main>
  );
}
