import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Send, FileText, Calendar } from "lucide-react";
import AnnouncementsClient from "./client";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  target_role: "all" | "owner" | "vet";
  sent_at: string | null;
  created_at: string;
};

export default async function AdminAnnouncementsPage() {
  const supabase = createServiceClient();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, target_role, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const all = (announcements || []) as AnnouncementRow[];

  const total = all.length;
  const sent = all.filter(a => a.sent_at !== null).length;
  const draft = all.filter(a => a.sent_at === null).length;
  const thisWeek = all.filter(a => new Date(a.created_at) >= oneWeekAgo).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Duyurular</h1>
        <p className="text-sm text-gray-500 mt-1">Platform kullanıcılarına duyuru gönder ve yönet</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Duyuru", value: total, icon: Bell, color: "bg-blue-100 text-blue-600" },
          { label: "Gönderildi", value: sent, icon: Send, color: "bg-[#F0FDF4] text-[#166534]" },
          { label: "Taslak", value: draft, icon: FileText, color: "bg-yellow-100 text-yellow-600" },
          { label: "Bu Hafta", value: thisWeek, icon: Calendar, color: "bg-purple-100 text-purple-600" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AnnouncementsClient announcements={all} />
    </div>
  );
}
