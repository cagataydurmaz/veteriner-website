"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PassportPrintButton() {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-2">
        <Printer className="w-4 h-4" />
        Yazdır / PDF Kaydet
      </Button>
    </div>
  );
}
