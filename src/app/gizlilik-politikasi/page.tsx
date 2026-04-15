import { redirect } from "next/navigation";

/**
 * /gizlilik-politikasi → canonical privacy hub is /kvkk
 * This redirect ensures old links and sitemap entries don't 404.
 */
export default function GizlilikPolitikasiPage() {
  redirect("/kvkk");
}
