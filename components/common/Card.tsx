import React, { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  accent = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`rounded-xl border bg-paper-card p-5 shadow-paper transition-shadow ${
        accent ? "border-akashiito/40 ring-1 ring-akashiito/20" : "border-line"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
