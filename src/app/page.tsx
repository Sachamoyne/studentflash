import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-8 text-center">
        <h1 className="text-4xl font-bold">ANKIbis</h1>
        <p className="text-lg text-muted-foreground">
          Apprenez efficacement avec la répétition espacée.
          <br />
          Interface moderne et épurée.
        </p>
        <Link href="/login">
          <Button size="lg">Open app</Button>
        </Link>
      </div>
    </div>
  );
}

