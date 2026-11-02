import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

const controlBase =
  "w-full h-11 md:h-10 rounded-control border-[1.5px] bg-white px-3 text-[14px] text-text " +
  "placeholder:text-muted/70 outline-none transition-[border-color,box-shadow] duration-150 " +
  "focus:ring-3";

function borderFor(error?: string) {
  return error
    ? "border-accent focus:border-accent focus:ring-accent/15"
    : "border-input-border focus:border-text focus:ring-text/10";
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
};

// Label above the control, error message below it
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-semibold text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-small text-accent" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-small text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: string };

export function Input({ error, className = "", id, ...props }: InputProps) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${controlBase} ${borderFor(error)} ${className}`}
      {...props}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { error?: string };

export function Select({ error, className = "", id, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${controlBase} ${borderFor(error)} appearance-none ps-3 pe-9 cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
