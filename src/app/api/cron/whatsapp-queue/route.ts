import { alertCronFailure } from "@/lib/cron-alert";
import { NextRequest, NextResponse } from "next/server";

/** WhatsApp queue cron — disabled, WhatsApp integration not active */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  return NextResponse.json({ skipped: true });
}
