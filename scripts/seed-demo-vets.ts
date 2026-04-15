/**
 * Seed 15 demo veterinarians into the veterinarians table.
 * Run with: npx ts-node --project tsconfig.json scripts/seed-demo-vets.ts
 * Or: node -r ts-node/register scripts/seed-demo-vets.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo vets data — these are inserted without a real user_id.
// We use a placeholder user_id (a fixed UUID for demo purposes).
// In production, demo vets should be associated with a real or fake auth user.
// Here we use a well-known nil UUID so the FK constraint requires adjusting or
// a demo user must exist. Adjust DEMO_USER_ID to match your DB setup.
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

const demoVets = [
  {
    full_name: "Dr. Ayşe Kaya",
    specialty: "Genel Pratisyen",
    city: "İstanbul",
    rating: 4.9,
    appointment_count: 127,
    bio: "Kedi ve köpek uzmanı, 10 yıl deneyim",
    phone: "+905551234001",
    email: "ayse.kaya.demo@vetbul.com",
    consultation_fee: 350,
  },
  {
    full_name: "Dr. Mehmet Yılmaz",
    specialty: "Ortopedi",
    city: "Ankara",
    rating: 4.8,
    appointment_count: 89,
    bio: "Kemik ve eklem hastalıkları uzmanı",
    phone: "+905551234002",
    email: "mehmet.yilmaz.demo@vetbul.com",
    consultation_fee: 450,
  },
  {
    full_name: "Dr. Zeynep Demir",
    specialty: "Dermatoloji",
    city: "İzmir",
    rating: 4.7,
    appointment_count: 203,
    bio: "Deri hastalıkları ve alerji uzmanı",
    phone: "+905551234003",
    email: "zeynep.demir.demo@vetbul.com",
    consultation_fee: 400,
  },
  {
    full_name: "Dr. Ali Çelik",
    specialty: "Göz Hastalıkları",
    city: "Bursa",
    rating: 4.9,
    appointment_count: 156,
    bio: "Veteriner göz hastalıkları uzmanı",
    phone: "+905551234004",
    email: "ali.celik.demo@vetbul.com",
    consultation_fee: 420,
  },
  {
    full_name: "Dr. Fatma Şahin",
    specialty: "Diş Hekimliği",
    city: "Antalya",
    rating: 4.6,
    appointment_count: 94,
    bio: "Diş hastalıkları ve ağız sağlığı",
    phone: "+905551234005",
    email: "fatma.sahin.demo@vetbul.com",
    consultation_fee: 380,
  },
  {
    full_name: "Dr. Hasan Arslan",
    specialty: "İç Hastalıklar",
    city: "Adana",
    rating: 4.8,
    appointment_count: 178,
    bio: "İç hastalıklar ve tanı uzmanı",
    phone: "+905551234006",
    email: "hasan.arslan.demo@vetbul.com",
    consultation_fee: 430,
  },
  {
    full_name: "Dr. Elif Yıldız",
    specialty: "Egzotik Hayvanlar",
    city: "İstanbul",
    rating: 4.9,
    appointment_count: 67,
    bio: "Kuş, sürüngen ve egzotik hayvan uzmanı",
    phone: "+905551234007",
    email: "elif.yildiz.demo@vetbul.com",
    consultation_fee: 500,
  },
  {
    full_name: "Dr. Murat Özkan",
    specialty: "Kardiyoloji",
    city: "Ankara",
    rating: 4.7,
    appointment_count: 112,
    bio: "Veteriner kardiyoloji uzmanı",
    phone: "+905551234008",
    email: "murat.ozkan.demo@vetbul.com",
    consultation_fee: 550,
  },
  {
    full_name: "Dr. Selin Koca",
    specialty: "Nöroloji",
    city: "İzmir",
    rating: 4.8,
    appointment_count: 88,
    bio: "Sinir sistemi hastalıkları uzmanı",
    phone: "+905551234009",
    email: "selin.koca.demo@vetbul.com",
    consultation_fee: 480,
  },
  {
    full_name: "Dr. Burak Tekin",
    specialty: "Onkoloji",
    city: "İstanbul",
    rating: 4.9,
    appointment_count: 145,
    bio: "Kanser teşhis ve tedavi uzmanı",
    phone: "+905551234010",
    email: "burak.tekin.demo@vetbul.com",
    consultation_fee: 600,
  },
  {
    full_name: "Dr. Merve Aydın",
    specialty: "Acil Tıp",
    city: "Ankara",
    rating: 4.8,
    appointment_count: 234,
    bio: "7/24 acil veteriner hizmetleri",
    phone: "+905551234011",
    email: "merve.aydin.demo@vetbul.com",
    consultation_fee: 520,
  },
  {
    full_name: "Dr. Emre Güneş",
    specialty: "Üreme",
    city: "İzmir",
    rating: 4.7,
    appointment_count: 167,
    bio: "Kısırlaştırma ve üreme hastalıkları",
    phone: "+905551234012",
    email: "emre.gunes.demo@vetbul.com",
    consultation_fee: 400,
  },
  {
    full_name: "Dr. Canan Yurt",
    specialty: "Beslenme",
    city: "Bursa",
    rating: 4.6,
    appointment_count: 78,
    bio: "Veteriner beslenme ve diyet uzmanı",
    phone: "+905551234013",
    email: "canan.yurt.demo@vetbul.com",
    consultation_fee: 350,
  },
  {
    full_name: "Dr. Serkan Doğan",
    specialty: "Davranış",
    city: "İstanbul",
    rating: 4.9,
    appointment_count: 56,
    bio: "Hayvan davranışı ve eğitim uzmanı",
    phone: "+905551234014",
    email: "serkan.dogan.demo@vetbul.com",
    consultation_fee: 450,
  },
  {
    full_name: "Dr. Nazlı Arslan",
    specialty: "Genel Pratisyen",
    city: "İzmit",
    rating: 4.8,
    appointment_count: 189,
    bio: "Tüm hayvanlar için kapsamlı veteriner bakımı",
    phone: "+905551234015",
    email: "nazli.arslan.demo@vetbul.com",
    consultation_fee: 330,
  },
];

function toAvatarSeed(fullName: string): string {
  return fullName
    .replace(/^Dr\.\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

async function seed() {
  console.log("Seeding 15 demo vets...");

  for (const vet of demoVets) {
    const avatarSeed = toAvatarSeed(vet.full_name);
    const photoUrl = `https://api.dicebear.com/7.x/personas/svg?seed=${avatarSeed}&backgroundColor=e8f5ee`;

    const { error } = await supabase.from("veterinarians").upsert(
      {
        user_id: DEMO_USER_ID,
        license_number: `DEMO-${avatarSeed.toUpperCase().slice(0, 8)}`,
        specialty: vet.specialty,
        city: vet.city,
        district: null,
        bio: vet.bio,
        subscription_tier: "basic",
        is_verified: true,
        is_demo: true,
        consultation_fee: vet.consultation_fee,
        video_consultation_fee: vet.consultation_fee,
        online_consultation: true,
        offers_video: true,
        offers_in_person: false,
        offers_nobetci: false,
        average_rating: vet.rating,
        total_reviews: vet.appointment_count,
        photo_url: photoUrl,
      },
      { onConflict: "license_number" }
    );

    if (error) {
      console.error(`Error inserting ${vet.full_name}:`, error.message);
    } else {
      console.log(`✓ Inserted: ${vet.full_name}`);
    }
  }

  console.log("Done.");
}

seed().catch(console.error);
