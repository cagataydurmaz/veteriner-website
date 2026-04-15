"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFormAutoSave } from "@/hooks/useFormAutoSave";
import { toast } from "sonner";
import { Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PET_SPECIES_OPTIONS } from "@/lib/constants";

const schema = z.object({
  name: z.string().min(1, "İsim gereklidir"),
  species: z.string().min(1, "Tür seçiniz"),
  breed: z.string().optional(),
  birth_date: z.string().optional(),
  weight: z.string().optional(),
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
});

type PetForm = z.infer<typeof schema>;

export default function AddPetPage() {
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<PetForm>({
    resolver: zodResolver(schema),
  });
  const { register, handleSubmit, formState: { errors } } = form;

  // Auto-save to sessionStorage — restored on page refresh, cleared after success
  const { clearSaved } = useFormAutoSave(form, "pet_add_draft");

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fotoğraf 5MB'dan büyük olamaz");
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: PetForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      let photoUrl: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("pet-photos")
          .upload(path, photoFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("pet-photos")
            .getPublicUrl(path);
          photoUrl = publicUrl;
        }
      }

      // Insert and immediately get the new pet's ID from the returned row
      const { data: newPet, error } = await supabase
        .from("pets")
        .insert({
          owner_id: user.id,
          name: data.name,
          species: data.species,
          breed: data.breed || null,
          birth_date: data.birth_date || null,
          weight: data.weight ? parseFloat(data.weight) : null,
          photo_url: photoUrl,
          allergies: data.allergies || null,
          chronic_conditions: data.chronic_conditions || null,
        })
        .select("id")
        .maybeSingle();

      if (error) throw error;

      // Auto-generate vaccine schedule for dogs and cats (fire-and-forget)
      if (newPet?.id && data.species) {
        fetch("/api/pets/auto-vaccines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            petId:     newPet.id,
            species:   data.species,
            birthDate: data.birth_date || null,
            ownerId:   user.id,
          }),
        }).catch(() => {});
      }

      clearSaved(); // clear draft after successful submission
      toast.success(`${data.name} başarıyla eklendi! Aşı takvimi oluşturuldu.`);
      router.push("/owner/pets");
    } catch (error: unknown) {
      const msg = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? JSON.stringify(error);
      console.error("[AddPet] error:", error);
      toast.error("Hayvan eklenemedi: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/owner/pets">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hayvan Ekle</h1>
          <p className="text-sm text-gray-500">Evcil hayvanınızın bilgilerini girin</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fotoğraf</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#166534] transition-colors"
              onClick={() => document.getElementById("pet-photo")?.click()}
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Önizleme" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                  <span className="text-xs text-gray-400">Fotoğraf</span>
                </div>
              )}
            </div>
            <input
              id="pet-photo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("pet-photo")?.click()}
              >
                Fotoğraf Seç
              </Button>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG — maks. 5MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Temel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>İsim *</Label>
                <Input data-testid="pet-name" placeholder="Buddy" {...register("name")} />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Tür *</Label>
                <select
                  data-testid="pet-species"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                  {...register("species")}
                >
                  <option value="">Tür seçin</option>
                  {PET_SPECIES_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {errors.species && <p className="text-xs text-red-500">{errors.species.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Irk (Opsiyonel)</Label>
                <Input placeholder="Golden Retriever" {...register("breed")} />
              </div>
              <div className="space-y-1.5">
                <Label>Doğum Tarihi</Label>
                <Input type="date" {...register("birth_date")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ağırlık (kg)</Label>
              <Input type="number" step="0.1" placeholder="5.5" {...register("weight")} />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Sağlık Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Alerjiler</Label>
              <Textarea
                placeholder="Bilinen alerjileri listeleyin..."
                rows={2}
                {...register("allergies")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kronik Hastalıklar</Label>
              <Textarea
                placeholder="Kronik veya süregelen durumlar..."
                rows={2}
                {...register("chronic_conditions")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Link href="/owner/pets" className="flex-1">
            <Button variant="outline" className="w-full" type="button">
              İptal
            </Button>
          </Link>
          <Button data-testid="pet-submit" type="submit" className="flex-1" loading={loading}>
            Hayvanı Ekle
          </Button>
        </div>
      </form>
    </div>
  );
}
