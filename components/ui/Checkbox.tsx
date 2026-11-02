import type { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";

// Square with 4px corners; checked = filled #1E1E21 with a white ✓ (Style Guide).
// The 44px wrapper keeps the touch target on mobile.
export function Checkbox({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className={`relative inline-flex size-11 shrink-0 items-center justify-center md:size-6 ${className}`}>
      <input
        type="checkbox"
        className="peer size-[18px] cursor-pointer appearance-none rounded-tag border-[1.5px] border-input-border bg-white transition-colors duration-150 checked:border-text checked:bg-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <Check
        aria-hidden
        size={13}
        strokeWidth={3}
        className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
