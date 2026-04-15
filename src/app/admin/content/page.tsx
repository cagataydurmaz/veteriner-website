import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Bell, PenSquare, ExternalLink, Send, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
};

type AnnouncementItem = {
  id: string;
  title: string;
  target_role: string;
  sent_at: string | null;
  created_at: string;
};

const TARGET_LABELS: Record<string, string> = {
  all: "Herkes",
  owner: "Hayvan Sahipleri",
  vet: "Veterinerler",
};

export default async function AdminContentPage() {
  const supabase = createServiceClient();

  const [
    { data: posts },
    { count: publishedCount },
    { count: draftCount },
    { data: announcements },
    { count: announcementTotal },
  ] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, title, slug, published, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("blog_posts")
      .select("*", { count: "exact", head: true })
      .eq("published", true),
    supabase
      .from("blog_posts")
      .select("*", { count: "exact", head: true })
      .eq("published", false),
    supabase
      .from("announcements")
      .select("id, title, target_role, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("announcements")
      .select("*", { count: "exact", head: true }),
  ]);

  const recentPosts = (posts || []) as BlogPost[];
  const recentAnnouncements = (announcements || []) as AnnouncementItem[];

  const totalPosts = (publishedCount ?? 0) + (draftCount ?? 0);
  const sentCount = recentAnnouncements.filter(a => a.sent_at !== null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">İçerik Yönetimi</h1>
        <p className="text-sm text-gray-500 mt-1">Blog yazıları ve duyuruları tek yerden yönet</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Blog Yazısı", value: totalPosts, icon: FileText, color: "bg-blue-100 text-blue-600" },
          { label: "Yayında", value: publishedCount ?? 0, icon: Eye, color: "bg-[#F0FDF4] text-[#166534]" },
          { label: "Taslak", value: draftCount ?? 0, icon: EyeOff, color: "bg-yellow-100 text-yellow-600" },
          { label: "Toplam Duyuru", value: announcementTotal ?? 0, icon: Bell, color: "bg-purple-100 text-purple-600" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blog section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <PenSquare className="w-4 h-4 text-[#166534]" />
                Blog Yazıları
              </CardTitle>
              <Link
                href="/admin/blog"
                className="text-xs text-[#166534] hover:underline flex items-center gap-1"
              >
                Tümünü Yönet
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentPosts.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">
                <FileText className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                Henüz blog yazısı yok
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentPosts.map(post => (
                  <div key={post.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${post.published ? "bg-[#166534]" : "bg-yellow-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(post.created_at).toLocaleDateString("tr-TR")}
                        {" · "}
                        <span className={post.published ? "text-[#166534]" : "text-yellow-600"}>
                          {post.published ? "Yayında" : "Taslak"}
                        </span>
                      </p>
                    </div>
                    {post.published && (
                      <Link href={`/blog/${post.slug}`} target="_blank" className="shrink-0">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-[#166534]" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100">
              <Link href="/admin/blog">
                <button className="w-full text-center text-xs text-[#166534] font-medium hover:underline">
                  Blog Yönetimine Git →
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Announcements section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-600" />
                Son Duyurular
              </CardTitle>
              <Link
                href="/admin/announcements"
                className="text-xs text-[#166534] hover:underline flex items-center gap-1"
              >
                Tümünü Yönet
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentAnnouncements.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">
                <Bell className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                Henüz duyuru yok
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentAnnouncements.map(ann => (
                  <div key={ann.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      ann.sent_at ? "bg-[#F0FDF4] text-[#166534]" : "bg-yellow-50 text-yellow-600"
                    }`}>
                      {ann.sent_at ? <Send className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ann.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">
                          {new Date(ann.created_at).toLocaleDateString("tr-TR")}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {TARGET_LABELS[ann.target_role] || ann.target_role}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          ann.sent_at ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                        }`}>
                          {ann.sent_at ? "Gönderildi" : "Taslak"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100">
              <Link href="/admin/announcements">
                <button className="w-full text-center text-xs text-[#166534] font-medium hover:underline">
                  Duyuru Yönetimine Git →
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Hızlı Erişim</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/blog">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F0FDF4] text-[#166534] rounded-xl text-sm font-medium hover:bg-green-100 transition-colors">
                <PenSquare className="w-4 h-4" />
                Blog Yönetimi
              </button>
            </Link>
            <Link href="/admin/announcements">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors">
                <Bell className="w-4 h-4" />
                Duyurular
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
