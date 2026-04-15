"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Load ChatWidget lazily — it's not needed on initial paint.
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), { ssr: false });

// Panel routes have their own support/chat solutions; hide the public AI widget there.
const PANEL_PREFIXES = ["/vet", "/owner", "/admin"];

export default function ChatWidgetConditional() {
  const pathname = usePathname();
  if (PANEL_PREFIXES.some(p => pathname.startsWith(p))) return null;
  return <ChatWidget />;
}
