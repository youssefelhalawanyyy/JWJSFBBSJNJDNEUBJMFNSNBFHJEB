import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cashierId = searchParams.get("id");
    const token = searchParams.get("token");

    if (!cashierId || !token) {
      return NextResponse.json({ valid: false, message: "Missing cashier ID or reset token." }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const cashierDoc = await adminDb.collection("cashiers").doc(cashierId).get();

    if (!cashierDoc.exists) {
      return NextResponse.json({ valid: false, message: "Cashier account not found." }, { status: 404 });
    }

    const data = cashierDoc.data();
    if (!data?.resetPinToken || data.resetPinToken !== token) {
      return NextResponse.json({ valid: false, message: "Invalid or expired PIN reset token." }, { status: 403 });
    }

    // Check if token is older than 48 hours
    if (data.resetPinRequestedAt) {
      const requestedTime = new Date(data.resetPinRequestedAt).getTime();
      const now = Date.now();
      const hoursElapsed = (now - requestedTime) / (1000 * 60 * 60);
      if (hoursElapsed > 48) {
        return NextResponse.json({ valid: false, message: "This PIN reset link has expired (48h limit). Please request a new one from your manager." }, { status: 410 });
      }
    }

    return NextResponse.json({
      valid: true,
      cashier: {
        id: cashierDoc.id,
        name: data.name,
        branchId: data.branchId || "alamein4",
        storeId: data.storeId || "Circle K",
        shiftType: data.shiftType || "All"
      }
    });
  } catch (error: any) {
    console.error("GET /api/cashier/reset-pin error:", error);
    return NextResponse.json({ valid: false, message: error?.message || "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cashierId, token, newPin } = body;

    if (!cashierId || !token || !newPin) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (cashierId, token, newPin)." },
        { status: 400 }
      );
    }

    // Validate PIN: Must be exactly 4 digits
    const pinStr = String(newPin).trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return NextResponse.json(
        { success: false, message: "PIN must be exactly 4 numeric digits." },
        { status: 400 }
      );
    }

    // Check against weak sequences
    const weakPins = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"];
    if (weakPins.includes(pinStr)) {
      return NextResponse.json(
        { success: false, message: "This PIN is too common. Please choose a more secure 4-digit code." },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const cashierRef = adminDb.collection("cashiers").doc(cashierId);
    const cashierDoc = await cashierRef.get();

    if (!cashierDoc.exists) {
      return NextResponse.json({ success: false, message: "Cashier account not found." }, { status: 404 });
    }

    const data = cashierDoc.data();
    if (!data?.resetPinToken || data.resetPinToken !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired PIN reset token. Please request a new link." },
        { status: 403 }
      );
    }

    // Update PIN and clear reset token & requirePinChange flag
    const nameSlug = (data.name || "").trim().toLowerCase().replace(/\s+/g, "_");
    const nowIso = new Date().toISOString();

    await cashierRef.update({
      pin: pinStr,
      requirePinChange: false,
      resetPinToken: null,
      resetPinRequestedAt: null,
      pinChangedAt: nowIso,
      updatedAt: nowIso
    });

    // Clean up any stale revocation records so the cashier can immediately log in
    await Promise.all([
      adminDb.collection("revoked_cashier_sessions").doc(cashierId).delete().catch(() => {}),
      adminDb.collection("revoked_cashier_sessions").doc(`name_${nameSlug}`).delete().catch(() => {})
    ]);

    // Log the event in audit_logs
    await adminDb.collection("audit_logs").add({
      timestamp: nowIso,
      action: "CASHIER_PIN_RESET_SELF",
      category: "SECURITY",
      cashierId,
      cashierName: data.name,
      details: `Cashier ${data.name} successfully set a new 4-digit PIN via self-service reset link.`
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "PIN updated successfully. You can now log in with your new PIN.",
      cashierName: data.name
    });
  } catch (error: any) {
    console.error("POST /api/cashier/reset-pin error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update PIN. Please try again." },
      { status: 500 }
    );
  }
}
