import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

// All 81 Turkish province slugs for city landing pages
const TR_CITIES = [
  "adana","adiyaman","afyonkarahisar","agri","aksaray","amasya","ankara","antalya",
  "ardahan","artvin","aydin","balikesir","bartin","batman","bayburt","bilecik",
  "bingol","bitlis","bolu","burdur","bursa","canakkale","cankiri","corum",
  "denizli","diyarbakir","duzce","edirne","elazig","erzincan","erzurum","eskisehir",
  "gaziantep","giresun","gumushane","hakkari","hatay","igdir","isparta","istanbul",
  "izmir","kahramanmaras","karabuk","karaman","kars","kastamonu","kayseri","kilis",
  "kirikkale","kirklareli","kirsehir","kocaeli","konya","kutahya","malatya","manisa",
  "mardin","mersin","mugla","mus","nevsehir","nigde","ordu","osmaniye","rize",
  "sakarya","samsun","sanliurfa","siirt","sinop","sirnak","sivas","tekirdag",
  "tokat","trabzon","tunceli","usak","van","yalova","yozgat","zonguldak",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://veterineribul.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                           lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${baseUrl}/veteriner-bul`,        lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}/online-veteriner`,     lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}/nobetci-veteriner`,    lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}/hakkimizda`,           lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/iletisim`,             lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/blog`,                 lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/kvkk`,                 lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/kvkk/hayvan-sahibi`,   lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/kvkk/veteriner`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/kvkk/cerez-politikasi`,lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/kullanim-kosullari`,   lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/auth/login`,           lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/auth/register`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/auth/vet-register`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // All 81 city landing pages — always included regardless of DB
  const cityPages: MetadataRoute.Sitemap = TR_CITIES.map((slug) => ({
    url: `${baseUrl}/${slug}-veteriner`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  try {
    const supabase = await createClient();

    // Verified vet profile pages
    const { data: vets } = await supabase
      .from("veterinarians")
      .select("id, updated_at")
      .eq("is_verified", true)
      .order("updated_at", { ascending: false });

    const vetPages: MetadataRoute.Sitemap = (vets || []).map((vet) => ({
      url: `${baseUrl}/veteriner/${vet.id}`,
      lastModified: vet.updated_at ? new Date(vet.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Blog post pages
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("published", true)
      .order("updated_at", { ascending: false });

    const blogPages: MetadataRoute.Sitemap = (posts || []).map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...cityPages, ...vetPages, ...blogPages];
  } catch {
    // Return static + city pages if DB is unavailable
    return [...staticPages, ...cityPages];
  }
}
