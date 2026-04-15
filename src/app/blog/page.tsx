import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

// Cache blog index for 30 minutes
export const revalidate = 1800;
import { Calendar, ArrowRight, Stethoscope, PawPrint,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Veteriner Blog — Köpek ve Kedi Sağlığı | Veterineri Bul",
  description: "Köpek, kedi ve evcil hayvan sağlığı hakkında güncel bilgiler, hastalık rehberleri ve veteriner önerileri.",
};

const FALLBACK_POSTS = [
  {
    id: "1",
    slug: "kopeklerde-parvovirus",
    title: "Köpeklerde Parvovirus: Belirtiler ve Korunma",
    excerpt: "Parvovirus, özellikle yavru köpeklerde görülen ve hızlı müdahale gerektiren tehlikeli bir viral hastalıktır. Belirtileri, tedavisi ve korunma yollarını bu rehberde bulabilirsiniz.",
    cover_image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80",
    tags: ["köpek", "hastalık", "aşı"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-15",
  },
  {
    id: "2",
    slug: "kedilerde-kronik-bobrek-hastaligi",
    title: "Kedilerde Kronik Böbrek Hastalığı",
    excerpt: "Yaşlı kedilerde en sık görülen sağlık sorunlarından biri olan böbrek yetmezliği hakkında bilmeniz gereken her şey: belirtiler, diyet ve veteriner takibi.",
    cover_image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80",
    tags: ["kedi", "sağlık", "beslenme"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-10",
  },
  {
    id: "3",
    slug: "kopeklerde-dis-sagligi",
    title: "Köpeklerde Diş Sağlığı: Evde Bakım Rehberi",
    excerpt: "Köpeklerin %80'i 3 yaşından itibaren diş sorunları yaşar. Düzenli diş bakımı ile pek çok sağlık sorununu önleyebilirsiniz.",
    cover_image: "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800&q=80",
    tags: ["köpek", "diş", "bakım"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-05",
  },
  {
    id: "4",
    slug: "kedi-asilamasinin-onemi",
    title: "Kedi Aşılamasının Önemi: Temel Aşılar",
    excerpt: "Kedileri korumak için hangi aşıların zorunlu olduğunu, ne zaman yaptırılması gerektiğini ve yan etkilerini bu rehberde öğrenin.",
    cover_image: "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=800&q=80",
    tags: ["kedi", "aşı", "sağlık"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-01",
  },
  {
    id: "5",
    slug: "kopekte-deri-hastaliklari",
    title: "Köpeklerde Deri Hastalıkları ve Alerjiler",
    excerpt: "Köpeklerde kaşıntı, dökülme ve kızarıklık gibi deri sorunlarının arkasında ne yatıyor? Tanı ve tedavi seçenekleri.",
    cover_image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    tags: ["köpek", "dermatoloji", "alerji"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2023-12-28",
  },
  {
    id: "6",
    slug: "kedi-beslenmesi-rehberi",
    title: "Kedi Beslenmesi: Yaşa Göre Doğru Diyet",
    excerpt: "Yavru kedi, yetişkin kedi ve yaşlı kedi için doğru beslenme programını öğrenin. Hangi besinler zararlı?",
    cover_image: "https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?w=800&q=80",
    tags: ["kedi", "beslenme", "diyet"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2023-12-20",
  },
];

async function getBlogPosts() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_image, tags, author_name, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (data && data.length > 0) return data;
  } catch {}
  return FALLBACK_POSTS;
}

const ALL_TAGS = ["köpek", "kedi", "aşı", "hastalık", "beslenme", "bakım", "diş", "dermatoloji"];

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="flex items-center gap-1">
              <span className="font-black text-gray-900">Veterineri Bul</span>
            </div>
          </Link>
          <Link href="/auth/register">
            <Button size="sm" className="bg-[#F97316] hover:bg-[#EA6A0A] text-white">Randevu Al</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[#166534] mb-2">
            <Stethoscope className="w-4 h-4" />
            <span className="text-sm font-medium">Veteriner Blog</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Evcil Hayvan Sağlık Rehberi</h1>
          <p className="text-gray-600">Köpek, kedi ve diğer evcil hayvanlar için güncel sağlık bilgileri ve bakım önerileri.</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          {ALL_TAGS.map((tag) => (
            <span key={tag} className="px-3 py-1 bg-[#F0FDF4] text-[#166534] text-xs font-medium rounded-full border border-[#DCFCE7] cursor-pointer hover:bg-[#DCFCE7] transition-colors">
              #{tag}
            </span>
          ))}
        </div>

        {/* Posts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                {/* Cover */}
                <div className="h-40 bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] relative overflow-hidden">
                  {post.cover_image ? (
                    <Image src={post.cover_image} alt={post.title} fill className="object-cover" sizes="400px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Stethoscope className="w-10 h-10 text-[#166534] opacity-40" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(post.tags || []).slice(0, 2).map((tag: string) => (
                      <span key={tag} className="text-xs bg-[#F0FDF4] text-[#166534] px-2 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                  <h2 className="font-bold text-gray-900 mb-2 text-sm leading-snug flex-1">{post.title}</h2>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{post.excerpt}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.published_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                    </div>
                    <span className="text-xs text-[#166534] flex items-center gap-1 font-medium">
                      Oku <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
