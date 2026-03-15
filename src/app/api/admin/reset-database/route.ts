import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";

/**
 * POST /api/admin/reset-database
 *
 * Server-side database reset using admin SDK (bypasses Firestore rules).
 * Requires a valid Firebase ID token from an admin user.
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken, clearCSV, clearOtpCodes } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Verify the Firebase ID token
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const adminDb = getAdminFirestore();

    // Delete registrations
    await deleteCollection(adminDb, "registrations");

    // Delete teams
    await deleteCollection(adminDb, "teams");

    // Delete invites
    await deleteCollection(adminDb, "invites");

    // Delete notifications
    await deleteCollection(adminDb, "notifications");

    // Clear CSV student data if selected
    if (clearCSV) {
      await deleteCollection(adminDb, "students");
    }

    // Clear OTP codes if selected
    if (clearOtpCodes) {
      await deleteCollection(adminDb, "otp_codes");
    }

    return NextResponse.json({
      success: true,
      message: "Database reset complete." +
        (clearCSV ? " CSV data cleared." : "") +
        (clearOtpCodes ? " OTP codes cleared." : ""),
    });
  } catch (err) {
    console.error("Reset database error:", err);
    const msg = err instanceof Error ? err.message : "Failed to reset database.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Delete all documents in a collection using batched writes (admin SDK).
 */
async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string
) {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) return;

  // Batch in groups of 450 (Firestore limit is 500)
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    docs.slice(i, i + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}
