import type { ButtonHTMLAttributes } from "react";

type Variant = "accent" | "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  accent: "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark",
  primary: "bg-text text-white hover:bg-ink-active",
  secondary: "bg-white text-text border border-text hover:bg-surface",
  ghost: "text-muted hover:text-text hover:bg-surface",
};

const sizes: Record<Size, string> = {
  md: "h-11 md:h-[38px] px-4 text-[14px]",
  sm: "h-11 md:h-8 px-3 text-[13px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return [
    "inline-flex items-center justify-center gap-1.5 rounded-control font-semibold whitespace-nowrap",
    "transition-colors duration-150 cursor-pointer",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text",
    "disabled:bg-line disabled:text-muted disabled:border-transparent disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
  ].join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant, size)} ${className}`}
      {...props}
    />
  );
}
