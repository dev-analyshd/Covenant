import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Size = "sm" | "md" | "lg" | "xl" | "full";

const sizeMap: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw] h-[90vh]",
};

export function Modal({
  open, onClose, title, subtitle, size = "md", footer, children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: Size;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${sizeMap[size]} rounded-2xl overflow-hidden flex flex-col`}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-lg)", maxHeight: "85vh" }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {title && (
              <div className="flex items-start justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
                  {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{subtitle}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-tertiary)" }} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
            {footer && (
              <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
