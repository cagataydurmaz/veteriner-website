"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  petId: string;
  petName: string;
}

/**
 * PetDeleteButton
 *
 * Renders a "Sil" button on the pet detail page.
 * Opens a confirmation dialog before calling DELETE /api/owner/pets/[id].
 * On success, navigates back to /owner/pets.
 *
 * data-testid attributes let e2e tests target the button + dialog.
 */
export default function PetDeleteButton({ petId, petName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/pets/${petId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Silinemedi");

      toast.success(`${petName} silindi`);
      setOpen(false);
      router.push("/owner/pets");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
        onClick={() => setOpen(true)}
        data-testid="pet-delete-btn"
      >
        <Trash2 className="w-4 h-4 mr-1.5" />
        Sil
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Hayvanı Sil
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 pt-1">
              <strong className="text-gray-900">{petName}</strong> adlı hayvanın tüm
              kayıtları <span className="font-semibold text-red-600">kalıcı olarak silinecek</span>:
              aşı geçmişi, muayene notları ve kilo kayıtları.
              <br /><br />
              Bu işlem <span className="font-semibold">geri alınamaz</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              data-testid="pet-delete-confirm-btn"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Trash2 className="w-4 h-4 mr-2" />
              }
              Kalıcı Olarak Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
