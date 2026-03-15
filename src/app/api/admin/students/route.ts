import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";

export async function PUT(req: NextRequest) {
  try {
    const { idToken, usn, data } = await req.json();
    if (!idToken || !usn || !data) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const adminDb = getAdminFirestore();
    await adminDb.collection("students").doc(usn).update(data);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Student update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { idToken, usn } = await req.json();
    if (!idToken || !usn) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const adminDb = getAdminFirestore();
    await adminDb.collection("students").doc(usn).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Student delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
