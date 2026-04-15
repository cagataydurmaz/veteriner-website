"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlusCircle, Edit2, Eye, EyeOff, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  published_at: string;
  tags: string[];
}

export default function AdminBlogClient({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    tags: "",
    author_name: "",
    published: false,
  });

  const generateSlug = (title: string) =>
    title.toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const slug = form.slug || generateSlug(form.title);
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { data, error } = await supabase.from("blog_posts").insert({
        title: form.title,
        slug,
        excerpt: form.excerpt,
        content: form.content,
        tags,
        author_name: form.author_name || "Veterineri Bul Editörü",
        published: form.published,
        published_at: new Date().toISOString(),
      }).select("id, title, slug, published, published_at, tags").maybeSingle();

      if (error) throw error;
      if (data) setPosts((p) => [data, ...p]);
      toast.success("Yazı kaydedildi");
      setShowEditor(false);
      setForm({ title: "", slug: "", excerpt: "", content: "", tags: "", author_name: "", published: false });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (postId: string, published: boolean) => {
    const supabase = createClient();
    try {
      await supabase.from("blog_posts").update({ published: !published }).eq("id", postId);
      setPosts((p) => p.map((post) => post.id === postId ? { ...post, published: !published } : post));
      toast.success(published ? "Yazı gizlendi" : "Yazı yayınlandı");
    } catch {
      toast.error("İşlem başarısız");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">{posts.length} yazı</p>
        </div>
        <Button onClick={() => setShowEditor(true)} className="bg-[#F97316] hover:bg-[#EA6A0A] text-white">
          <PlusCircle className="w-4 h-4 mr-2" />
          Yeni Yazı
        </Button>
      </div>

      {/* Posts table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {posts.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Başlık</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Etiketler</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm text-gray-900 line-clamp-1">{post.title}</p>
                    <p className="text-xs text-gray-400">/blog/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(post.tags || []).slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs bg-[#F0FDF4] text-[#166534] px-1.5 py-0.5 rounded">#{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={post.published ? "success" : "outline"} className="text-xs">
                      {post.published ? "Yayında" : "Taslak"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => togglePublish(post.id, post.published)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={post.published ? "Gizle" : "Yayınla"}
                      >
                        {post.published
                          ? <EyeOff className="w-4 h-4 text-gray-500" />
                          : <Eye className="w-4 h-4 text-[#166534]" />}
                      </button>
                      {post.published && (
                        <Link href={`/blog/${post.slug}`} target="_blank">
                          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                            <ExternalLink className="w-4 h-4 text-[#166534]" />
                          </button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Edit2 className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Henüz yazı yok. İlk yazınızı ekleyin!</p>
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Blog Yazısı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Başlık *</Label>
                <Input
                  placeholder="Köpeklerde Parvovirus..."
                  value={form.title}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    title: e.target.value,
                    slug: f.slug || generateSlug(e.target.value),
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL (slug)</Label>
                <Input
                  placeholder="kopeklerde-parvovirus"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Yazar</Label>
                <Input
                  placeholder="Veterineri Bul Editörü"
                  value={form.author_name}
                  onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Özet</Label>
              <Textarea
                placeholder="Yazının kısa özeti..."
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>İçerik * (Markdown desteklenir)</Label>
              <Textarea
                placeholder="## Başlık&#10;&#10;İçerik burada..."
                rows={10}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Etiketler (virgülle ayırın)</Label>
              <Input
                placeholder="köpek, hastalık, aşı"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="published"
                checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#166534]"
              />
              <label htmlFor="published" className="text-sm text-gray-700">Hemen yayınla</label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowEditor(false)} className="flex-1">İptal</Button>
              <Button
                onClick={handleSave}
                loading={loading}
                disabled={!form.title || !form.content}
                className="flex-1 bg-[#166534] hover:bg-[#14532D] text-white"
              >
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
