"use client";

import type { ReactNode } from "react";

// A native <button type="submit"> that gates the enclosing form's submit on
// a browser confirm() dialog — for destructive server actions (e.g.
// deleting a floor plan) where an accidental click shouldn't be one click
// away from irreversible.
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
