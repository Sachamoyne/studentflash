import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";

// Helper: Parse Anki deck hierarchy
// "Parent::Child::Grandchild" -> ["Parent", "Child", "Grandchild"]
function parseDeckName(deckName: string): string[] {
  return deckName.split("::").map((part) => part.trim());
}

// Helper: Get or create deck with hierarchy
async function getOrCreateDeck(
  supabase: any,
  userId: string,
  deckPath: string[],
  deckCache: Map<string, string>
): Promise<string> {
  let parentId: string | null = null;

  for (let i = 0; i < deckPath.length; i++) {
    const deckName = deckPath[i];
    const fullPath = deckPath.slice(0, i + 1).join("::");

    // Check cache first
    if (deckCache.has(fullPath)) {
      parentId = deckCache.get(fullPath)!;
      continue;
    }

    // Check if deck exists
    const { data: existing }: { data: { id: string } | null } = await supabase
      .from("decks")
      .select("id")
      .eq("user_id", userId)
      .eq("name", deckName)
      .eq("parent_deck_id", parentId)
      .maybeSingle();

    if (existing) {
      parentId = existing.id;
      deckCache.set(fullPath, existing.id);
    } else {
      // Create new deck
      const { data: newDeck, error }: { data: { id: string } | null; error: any } = await supabase
        .from("decks")
        .insert({
          user_id: userId,
          name: deckName,
          parent_deck_id: parentId,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (newDeck) {
        parentId = newDeck.id;
        deckCache.set(fullPath, newDeck.id);
      }
    }
  }

  return parentId!;
}

// Helper: Convert Anki card type to ease factor
function getEaseFromType(type: number): number {
  // type: 0=new, 1=learning, 2=review, 3=relearning
  // Default ease is 2.5 (250%)
  return 2.5;
}

// Helper: Convert Anki interval to days
function getIntervalDays(ivl: number, type: number): number {
  // ivl can be:
  // - negative for learning cards (seconds * -1)
  // - positive for review cards (days)
  if (type === 0) return 0; // New cards
  if (ivl < 0) return 0; // Learning cards (intraday)
  return ivl; // Review cards
}

// Helper: Map Anki card state to Synapse state
function getCardState(type: number): "new" | "learning" | "review" {
  // type: 0=new, 1=learning, 2=review, 3=relearning
  if (type === 0) return "new";
  if (type === 1 || type === 3) return "learning";
  return "review";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".apkg")) {
      return NextResponse.json({ error: "File must be .apkg" }, { status: 400 });
    }

    // Get current user - use request cookies directly for Route Handler
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Cannot set cookies in Route Handler - request.cookies is read-only
            // Session refresh happens in middleware
          },
        },
      }
    );

    // Debug: log cookies
    const cookies = request.cookies.getAll();
    console.log("[ANKI IMPORT] === AUTH DEBUG START ===");
    console.log("[ANKI IMPORT] Cookies count:", cookies.length);
    console.log("[ANKI IMPORT] Cookie names:", cookies.map(c => c.name));
    console.log("[ANKI IMPORT] Has sb-* cookies:", cookies.some(c => c.name.startsWith('sb-')));

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[ANKI IMPORT] Auth result:", {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message,
      authErrorStatus: authError?.status
    });
    console.log("[ANKI IMPORT] === AUTH DEBUG END ===");

    if (authError || !user) {
      console.error("[ANKI IMPORT] Auth failed:", authError?.message || "No user");
      return NextResponse.json({
        error: "Unauthorized",
        details: authError?.message || "No user session found"
      }, { status: 401 });
    }

    const userId = user.id;

    // Read file as buffer
    const buffer = await file.arrayBuffer();
    const zip = new AdmZip(Buffer.from(buffer));

    // Extract collection.anki2
    const collectionEntry = zip.getEntry("collection.anki2");
    if (!collectionEntry) {
      return NextResponse.json(
        { error: "Invalid .apkg file: collection.anki2 not found" },
        { status: 400 }
      );
    }

    // Write to temp file and open with better-sqlite3
    const tempPath = `/tmp/anki-${randomUUID()}.anki2`;
    zip.extractEntryTo(collectionEntry, "/tmp", false, true);

    const db = new Database(tempPath);

    try {
      // Get decks from collection
      const colRow = db.prepare("SELECT decks FROM col").get() as { decks: string };
      const decksJson = JSON.parse(colRow.decks);

      // Get notes and cards
      const notes = db.prepare("SELECT id, mid, flds, tags FROM notes").all() as Array<{
        id: number;
        mid: number;
        flds: string;
        tags: string;
      }>;

      const cards = db.prepare(`
        SELECT id, nid, did, type, ivl, factor, reps, lapses, due
        FROM cards
      `).all() as Array<{
        id: number;
        nid: number;
        did: number;
        type: number;
        ivl: number;
        factor: number;
        reps: number;
        lapses: number;
        due: number;
      }>;

      // Build deck cache
      const deckCache = new Map<string, string>();
      const ankiDeckIdToSynapseDeckId = new Map<number, string>();

      // Create decks with hierarchy
      for (const [deckId, deckData] of Object.entries(decksJson)) {
        const deckName = (deckData as any).name as string;
        const deckPath = parseDeckName(deckName);
        const synapseDeckId = await getOrCreateDeck(supabase, userId, deckPath, deckCache);
        ankiDeckIdToSynapseDeckId.set(Number(deckId), synapseDeckId);
      }

      // Build note lookup
      const noteMap = new Map(notes.map((n) => [n.id, n]));

      // Import cards
      let importedCount = 0;
      const now = new Date();

      for (const card of cards) {
        const note = noteMap.get(card.nid);
        if (!note) continue;

        const synapseDeckId = ankiDeckIdToSynapseDeckId.get(card.did);
        if (!synapseDeckId) continue;

        // Parse note fields (separated by \x1f)
        const fields = note.flds.split("\x1f");
        const front = fields[0] || "";
        const back = fields[1] || "";

        if (!front.trim() || !back.trim()) continue;

        // Calculate due date
        const state = getCardState(card.type);
        const intervalDays = getIntervalDays(card.ivl, card.type);
        let dueAt = now;

        if (state === "review" && intervalDays > 0) {
          // For review cards, add interval to current date
          dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        }

        // Insert card
        const { error: cardError } = await supabase.from("cards").insert({
          user_id: userId,
          deck_id: synapseDeckId,
          front,
          back,
          state,
          due_at: dueAt.toISOString(),
          interval_days: intervalDays,
          ease: card.factor > 0 ? card.factor / 1000 : 2.5, // Anki stores ease as integer (2500 = 2.5)
          reps: card.reps,
          lapses: card.lapses,
          learning_step_index: state === "learning" ? 0 : null,
        });

        if (!cardError) {
          importedCount++;
        } else {
          console.error("[ANKI IMPORT] Card insert failed:", cardError.message, { front: front.substring(0, 50) });
        }
      }

      db.close();

      // Clean up temp file
      try {
        const fs = require("fs");
        fs.unlinkSync(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      return NextResponse.json({
        success: true,
        imported: importedCount,
        decks: deckCache.size,
      });
    } finally {
      // Ensure database is closed
      if (db.open) {
        db.close();
      }
    }
  } catch (error) {
    console.error("Anki import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
