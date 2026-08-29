import React, { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold tracking-wider text-ink-muted uppercase">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full rounded-lg border bg-paper-card px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle/60 transition-all focus:border-ink ${
            error ? "border-akashiito focus:ring-akashiito" : "border-line focus:ring-ink"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-akashiito">{error}</p>}
        {helperText && !error && <p className="text-xs text-ink-muted">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
