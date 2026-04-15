import { NextResponse } from "next/server";

/** WhatsApp reminders — disabled, WhatsApp integration not active */
export async function POST() {
  return NextResponse.json({ skipped: true });
}
