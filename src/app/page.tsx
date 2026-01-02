import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  Brain,
  BookOpen,
  Sparkles,
  Zap,
  FileText,
  Image,
} from "lucide-react";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero Section */}
      <section className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {APP_NAME}
          </h1>
          <p className="mb-4 text-xl text-muted-foreground sm:text-2xl">
            {APP_TAGLINE}
          </p>
          <p className="mb-12 text-lg text-muted-foreground">
            Master any subject with scientifically-proven spaced repetition.
            <br />
            Create flashcards, import from PDFs and images, and study
            efficiently.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Studying
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    Learn More
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t bg-muted/50 px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-16 text-center text-3xl font-bold sm:text-4xl">
            Why {APP_NAME}?
          </h2>
          <div className="grid gap-12 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Brain className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">
                Spaced Repetition
              </h3>
              <p className="text-muted-foreground">
                Study smarter, not harder. Our algorithm shows you cards right
                when you&apos;re about to forget them, maximizing retention.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">Smart Import</h3>
              <p className="text-muted-foreground">
                Import from PDFs and images. AI-powered card generation helps
                you create high-quality flashcards in seconds.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">Modern Interface</h3>
              <p className="text-muted-foreground">
                Clean, intuitive design that gets out of your way. Focus on
                learning, not navigating complex menus.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-16 text-center text-3xl font-bold sm:text-4xl">
            How It Works
          </h2>
          <div className="space-y-12">
            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                1
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">
                    Create or Import Decks
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  Start by creating a new deck or importing content from PDFs
                  and images. Add flashcards manually or let AI generate them
                  for you.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                2
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">Study Daily</h3>
                </div>
                <p className="text-muted-foreground">
                  Review cards as they come due. The spaced repetition algorithm
                  adapts to your performance, scheduling reviews at optimal
                  intervals.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                3
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">Track Progress</h3>
                </div>
                <p className="text-muted-foreground">
                  Monitor your learning journey with clear stats. See how many
                  cards you&apos;ve mastered and stay motivated with your streak.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t bg-muted/50 px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-16 text-center text-3xl font-bold sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-lg font-semibold">
                What is spaced repetition?
              </h3>
              <p className="text-muted-foreground">
                Spaced repetition is a learning technique that schedules reviews
                of information at increasing intervals. It&apos;s scientifically
                proven to improve long-term retention and reduce study time.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">
                Can I import my existing flashcards?
              </h3>
              <p className="text-muted-foreground">
                Yes! {APP_NAME} supports importing from PDFs and images using
                OCR technology. AI-powered card generation can automatically
                create flashcards from your content.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">
                Is my data stored locally?
              </h3>
              <p className="text-muted-foreground">
                Your flashcards are stored locally in your browser using
                IndexedDB, ensuring fast access and offline capability. Your
                data stays on your device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>
            {APP_NAME} - Learn faster with spaced repetition
          </p>
        </div>
      </footer>
    </div>
  );
}

