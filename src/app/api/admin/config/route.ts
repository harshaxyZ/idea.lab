import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { idToken, updates } = await req.json();
    if (!idToken || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const adminDb = getAdminFirestore();
    await adminDb.collection("config").doc("global_config").set(updates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Config update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
