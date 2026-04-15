"use client";

import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  label?: string;
}

export default function BackButton({ className, label = "Geri Git" }: BackButtonProps) {
  return (
    <button
      onClick={() => window.history.back()}
      className={className}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
