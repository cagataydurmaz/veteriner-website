"use client";

import dynamic from "next/dynamic";

// ssr:false must live inside a Client Component.
// This thin wrapper is imported by the Server Component layout.
const VetSupportWidget = dynamic(
  () => import("./VetSupportWidget"),
  { ssr: false }
);

export default function VetSupportWidgetLoader({ vetName }: { vetName: string }) {
  return <VetSupportWidget vetName={vetName} />;
}
