import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { idToken, students } = await req.json();
    if (!idToken || !students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const adminDb = getAdminFirestore();
    const batchId = `batch_${Date.now()}`;

    // Batch write students in groups of 450
    for (let i = 0; i < students.length; i += 450) {
      const batch = adminDb.batch();
      students.slice(i, i + 450).forEach((s: Record<string, string>) => {
        const ref = adminDb.collection("students").doc(s.usn);
        batch.set(ref, {
          usn: s.usn,
          name: s.name,
          email: s.email,
          phone: s.phone,
          branch: s.branch,
          section: s.section,
          importedAt: FieldValue.serverTimestamp(),
          importBatch: batchId,
        });
      });
      await batch.commit();
    }

    // Update config
    await adminDb.collection("config").doc("global_config").set(
      { csvLastUploadedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ success: true, count: students.length });
  } catch (err) {
    console.error("CSV upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
