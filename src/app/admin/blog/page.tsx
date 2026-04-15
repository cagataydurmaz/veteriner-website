import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminBlogClient from "./client";

export default async function AdminBlogPage() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  let posts: {
    id: string; title: string; slug: string; published: boolean;
    published_at: string; tags: string[];
  }[] = [];

  try {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, title, slug, published, published_at, tags")
      .order("created_at", { ascending: false });
    posts = data || [];
  } catch {}

  return <AdminBlogClient initialPosts={posts} />;
}
