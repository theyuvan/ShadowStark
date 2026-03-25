"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

interface TEEStatusProps {
  active: boolean;
}

export function TEEStatus({ active }: TEEStatusProps) {

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        {/* Pulsing halo when active */}
        {active && (
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500/30"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        
        {/* Status indicator */}
        <div
          className={`relative h-8 w-8 rounded-full flex items-center justify-center transition-all ${
            active
              ? "bg-emerald-500/20 border border-emerald-500"
              : "bg-slate-600/20 border border-slate-600"
          }`}
        >
          <Shield className={`h-4 w-4 ${active ? "text-emerald-400" : "text-slate-400"}`} />
        </div>
      </div>

      {/* Status text */}
      <span className="text-xs">
        <span className={`font-semibold ${active ? "text-emerald-400" : "text-slate-400"}`}>
          TEE
        </span>
        <span className="text-muted"> {active ? "Active" : "Inactive"}</span>
      </span>
    </div>
  );
}
