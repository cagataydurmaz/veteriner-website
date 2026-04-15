import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Tag, ArrowLeft, ArrowRight, Stethoscope, ShieldCheck, PawPrint,
} from "lucide-react";

// Cache individual blog posts for 30 minutes
export const revalidate = 1800;
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const FALLBACK_POSTS: Record<string, {
  title: string; excerpt: string; content: string; tags: string[];
  author_name: string; published_at: string; specialty: string;
}> = {
  "kopeklerde-parvovirus": {
    title: "Köpeklerde Parvovirus: Belirtiler ve Korunma",
    excerpt: "Parvovirus, özellikle yavru köpeklerde görülen ve hızlı müdahale gerektiren tehlikeli bir viral hastalıktır.",
    tags: ["köpek", "hastalık", "aşı"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-15",
    specialty: "Genel Veterinerlik",
    content: `## Parvovirus Nedir?

Parvovirus (CPV), köpeklerin sindirim sistemini ve bağışıklık sistemini etkileyen son derece bulaşıcı bir viral hastalıktır. Özellikle 6 hafta ile 6 ay arasındaki yavru köpeklerde ölümcül olabilir.

## Belirtiler

**Erken Dönem:**
- Ateş (39°C üzeri)
- Halsizlik ve iştahsızlık
- Depresif davranış

**İleri Dönem:**
- Şiddetli kusma (kanlı olabilir)
- Kanlı ishal
- Dehidrasyon
- Kilo kaybı

## Bulaşma Yolları

Parvovirus enfekte köpeklerin dışkısıyla temas yoluyla bulaşır. Virüs çevrede aylarca yaşayabilir ve standart dezenfektanlara karşı dirençlidir.

## Tedavi

Parvovirus için özgül bir antiviral tedavi yoktur. Destekleyici tedavi uygulanır:
- Damardan sıvı takviyesi
- Antibiyotikler (sekonder enfeksiyonlar için)
- Antiemetikler
- Beslenme desteği

**Erken müdahale hayat kurtarır.** Belirtiler görüldüğünde vakit kaybetmeden veterinere başvurun.

## Korunma

**Aşılama** en etkili korunma yöntemidir:
- 6-8 haftalıkken ilk doz
- 10-12 haftalıkken ikinci doz
- 14-16 haftalıkken üçüncü doz
- Yıllık hatırlatma aşıları

Aşılanmamış köpekleri hasta köpeklerden ve potansiyel olarak kontamine alanlardan uzak tutun.`,
  },
  "kedilerde-kronik-bobrek-hastaligi": {
    title: "Kedilerde Kronik Böbrek Hastalığı",
    excerpt: "Yaşlı kedilerde en sık görülen sağlık sorunlarından biri olan böbrek yetmezliği hakkında bilmeniz gerekenler.",
    tags: ["kedi", "sağlık", "beslenme"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-10",
    specialty: "İç Hastalıklar",
    content: `## Kronik Böbrek Hastalığı Nedir?

Kronik böbrek hastalığı (KBH), kedilerde böbreklerin zamanla fonksiyonunu yitirmesiyle karakterize ilerleyici bir hastalıktır. 7 yaş üzeri kedilerin yaklaşık %30-40'ında görülür.

## Belirtiler

**Erken Dönem:**
- Artan su tüketimi
- Daha sık idrara çıkma
- Hafif kilo kaybı

**İleri Dönem:**
- Şiddetli iştahsızlık
- Kusma
- Kötü ağız kokusu (üre kokusu)
- Tüylerin matlaşması
- Kas zayıflığı

## Tanı

Kan testleri (BUN, kreatinin), idrar analizi ve ultrason ile teşhis konulur. **Yılda bir kez sağlık kontrolü** erken tanı için kritiktir.

## Tedavi ve Yönetim

KBH tedavi edilemez ancak yönetilebilir:

**Diyet:** Düşük fosfor, düşük protein içerikli özel reçeteli böbrek diyeti
**Sıvı Desteği:** Evde cilt altı sıvı takviyesi
**İlaçlar:** Fosfor bağlayıcılar, kan basıncı ilaçları, antiemetikler

## Prognoz

Erken teşhis ve uygun yönetimle kediler yıllarca kaliteli yaşam sürebilir. Düzenli veteriner kontrolü hayat kurtarır.`,
  },
  "kopeklerde-dis-sagligi": {
    title: "Köpeklerde Diş Sağlığı: Evde Bakım Rehberi",
    excerpt: "Köpeklerin %80'i 3 yaşından itibaren diş sorunları yaşar.",
    tags: ["köpek", "diş", "bakım"],
    author_name: "Veterineri Bul Editörü",
    published_at: "2024-01-05",
    specialty: "Diş Hekimliği",
    content: `## Neden Önemli?

Köpeklerin %80'inden fazlasında 3 yaşından itibaren periodontal hastalık başlar. Diş sorunları sadece ağıza değil, kalp, böbrek ve karaciğere de zarar verebilir.

## Evde Diş Bakımı

**Dişleri Fırçalama:**
- Haftada en az 2-3 kez
- Sadece köpekler için üretilmiş diş macunu kullanın (insan macunu toksiktir!)
- Küçük dairesel hareketlerle fırçalayın

**Diş Bakım Ürünleri:**
- Diş kemikleri ve chew oyuncaklar
- Ağız gargarası (su bazlı)
- Diş bakım maması

## Belirtiler — Veterinere Gidin!

- Kötü ağız kokusu
- Yemek yerken ağrı
- Sarkık veya şiş diş etleri
- Sarı-kahverengi diş taşı

## Profesyonel Diş Temizliği

Yılda bir kez anestezi altında profesyonel diş temizliği önerilir. Bu işlem:
- Diş taşlarını temizler
- Çürük dişleri tespit eder
- Periodontal hastalığı önler`,
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const fallback = FALLBACK_POSTS[slug];
  if (fallback) {
    return {
      title: `${fallback.title} | Veterineri Bul Blog`,
      description: fallback.excerpt,
    };
  }
  return { title: "Blog | Veterineri Bul" };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;

  let post: {
    title: string; content: string; excerpt: string; tags: string[];
    author_name: string; published_at: string; specialty?: string;
  } | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (data) post = data;
  } catch {}

  if (!post) {
    const fallback = FALLBACK_POSTS[slug];
    if (!fallback) notFound();
    post = fallback;
  }

  // Parse simple markdown to HTML-ish JSX
  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.slice(3)}</h2>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(2, -2)}</p>;
      if (line.startsWith("- ")) return <li key={i} className="text-gray-700 ml-4 list-disc">{line.slice(2)}</li>;
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="text-gray-700 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Blog</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="flex items-center gap-1">
              <span className="font-black text-gray-900">Veterineri Bul</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Cover */}
        <div className="h-48 bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] rounded-2xl flex items-center justify-center mb-8">
          <Stethoscope className="w-16 h-16 text-[#166534] opacity-30" />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(post.tags || []).map((tag) => (
            <span key={tag} className="text-xs bg-[#F0FDF4] text-[#166534] px-2 py-1 rounded-full flex items-center gap-1">
              <Tag className="w-3 h-3" />#{tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{post.title}</h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-[#F0FDF4] rounded-full flex items-center justify-center">
              <span className="text-[#166534] text-xs font-bold">{post.author_name?.charAt(0)}</span>
            </div>
            <span>{post.author_name}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#166534]" />
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(post.published_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none space-y-1">
          {renderContent(post.content)}
        </div>

        {/* CTA */}
        <div className="mt-10 bg-[#F0FDF4] rounded-2xl p-6 border border-[#DCFCE7]">
          <h3 className="font-bold text-gray-900 mb-2">Bu konuda uzman veteriner bul</h3>
          <p className="text-sm text-gray-600 mb-4">
            {post.specialty
              ? `${post.specialty} alanında doğrulanmış veterinerlerle online randevu alın.`
              : "Doğrulanmış veterinerlerle online randevu alın."}
          </p>
          <Link href={`/auth/register${post.specialty ? `?specialty=${encodeURIComponent(post.specialty)}` : ""}`}>
            <Button className="bg-[#F97316] hover:bg-[#EA6A0A] text-white">
              Veterineri Bul <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
