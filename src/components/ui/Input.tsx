import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Size = "sm" | "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helper?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: Size;
  masked?: boolean;
}

const sizeMap: Record<Size, string> = {
  sm: "text-xs py-1.5",
  md: "text-sm py-2.5",
  lg: "text-base py-3",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helper, error, icon, suffix, size = "md", masked, className = "", type, ...props }, ref) => {
    const [reveal, setReveal] = useState(false);
    const actualType = masked ? (reveal ? "text" : "password") : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && <span className="absolute left-3 flex items-center pointer-events-none" style={{ color: "var(--text-tertiary)" }}>{icon}</span>}
          <input
            ref={ref}
            type={actualType}
            className={`w-full rounded-lg outline-none transition-all ${sizeMap[size]} ${icon ? "pl-9" : "pl-3"} ${suffix || masked ? "pr-10" : "pr-3"} ${className}`}
            style={{
              background: "var(--bg-input)",
              border: `1px solid ${error ? "var(--accent-danger)" : "var(--border-default)"}`,
              color: "var(--text-primary)",
            }}
            {...props}
          />
          {masked && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute right-3 flex items-center"
              style={{ color: "var(--text-tertiary)" }}
              tabIndex={-1}
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          {suffix && !masked && <span className="absolute right-3 flex items-center text-xs" style={{ color: "var(--text-tertiary)" }}>{suffix}</span>}
        </div>
        {error ? (
          <p className="text-xs mt-1.5" style={{ color: "var(--accent-danger)" }}>{error}</p>
        ) : helper ? (
          <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>{helper}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export function Select({
  label, helper, error, className = "", children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; helper?: string; error?: string }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          {label}
        </label>
      )}
      <select
        className={`w-full rounded-lg outline-none px-3 py-2.5 text-sm appearance-none ${className}`}
        style={{
          background: "var(--bg-input)",
          border: `1px solid ${error ? "var(--accent-danger)" : "var(--border-default)"}`,
          color: "var(--text-primary)",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238a8a9a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.75rem center",
          backgroundSize: "1rem",
          paddingRight: "2.5rem",
        }}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs mt-1.5" style={{ color: "var(--accent-danger)" }}>{error}</p>}
      {helper && !error && <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>{helper}</p>}
    </div>
  );
}
