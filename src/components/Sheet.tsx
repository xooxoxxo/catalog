import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "@phosphor-icons/react";

export function Sheet({
  title, onClose, children, width = 720,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="sheet-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <motion.div className="sheet" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </motion.div>
    </motion.div>
  );
}
