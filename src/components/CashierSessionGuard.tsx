"use client";

import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

export function CashierSessionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const activeSessionStr = localStorage.getItem("active_cashier_session");
    if (!activeSessionStr) return;

    let activeSession: any = null;
    try {
      activeSession = JSON.parse(activeSessionStr);
    } catch {
      localStorage.removeItem("active_cashier_session");
      return;
    }

    if (!activeSession?.id || activeSession.id === "master_youssef") return;

    const cashierId = activeSession.id;
    const cashierName = activeSession.name || "";
    let isTerminating = false;

    const terminateCashierSession = (reasonMessage?: string) => {
      if (isTerminating) return;
      isTerminating = true;

      console.warn("Cashier session termination triggered:", reasonMessage);
      localStorage.removeItem("active_cashier_session");
      sessionStorage.removeItem("active_cashier_session");
      localStorage.removeItem("active_cashier_device_id");

      // Notify any listening components in the same tab
      window.dispatchEvent(new CustomEvent("cashier_session_revoked", { detail: { cashierId, cashierName } }));

      toast.error(
        reasonMessage || "تم إنهاء صلاحية هذا الحساب من قبل الإدارة. تم تسجيل الخروج تلقائياً.",
        { duration: 7000 }
      );

      // If user is currently on any cashier route, bounce back to /cashier login
      const isCashierRoute = 
        pathname?.startsWith("/cashier") ||
        pathname?.startsWith("/shift-reports/cashier") ||
        pathname?.startsWith("/voids/cashier") ||
        pathname?.startsWith("/checklists/cashier") ||
        pathname?.startsWith("/inventory-audit/cashier") ||
        pathname?.startsWith("/expiries");

      if (isCashierRoute) {
        setTimeout(() => {
          if (pathname === "/cashier") {
            window.location.reload();
          } else {
            window.location.href = "/cashier";
          }
        }, 400);
      }
    };

    // 1. Initial verification check on mount/refresh
    getDoc(doc(db, "cashiers", cashierId)).then(async (snap) => {
      if (!snap.exists()) {
        terminateCashierSession("تم حذف هذا الحساب من قبل الإدارة. تم تسجيل الخروج تلقائياً.");
        return;
      }

      const cashierData = snap.data();
      // If marked inactive, immediately kick out
      if (cashierData?.status === "inactive") {
        terminateCashierSession("تم إلغاء تفعيل هذا الحساب من قبل الإدارة. تم تسجيل الخروج.");
        return;
      }

      // Account is active in Firestore! Stale tombstones in revoked_cashier_sessions must be auto-purged
      deleteDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => {});
      if (cashierName) {
        const nameSlug = cashierName.trim().toLowerCase().replace(/\s+/g, "_");
        deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {});
      }
    }).catch(() => {});

    // 2. Real-time Firestore snapshot on the cashier document
    const unsubCashier = onSnapshot(doc(db, "cashiers", cashierId), (snap) => {
      if (!snap.exists()) {
        terminateCashierSession("تم حذف هذا الحساب من قبل الإدارة. تم تسجيل الخروج من جميع الأجهزة.");
      } else if (snap.data()?.status === "inactive") {
        terminateCashierSession("تم إلغاء تفعيل هذا الحساب من قبل الإدارة. تم تسجيل الخروج.");
      }
    }, (err) => {
      console.warn("Cashier guard doc snapshot error:", err);
    });

    // 3. Real-time Firestore snapshot on revoked sessions by ID
    const unsubRevoked = onSnapshot(doc(db, "revoked_cashier_sessions", cashierId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const sessionLoginTime = activeSession.loggedInAt || "";
        // If revoked BEFORE current session logged in, it's an old tombstone: auto-purge and ignore!
        if (data?.revokedAt && sessionLoginTime && data.revokedAt < sessionLoginTime) {
          deleteDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => {});
          return;
        }

        // Before kicking out, verify if cashier is actually inactive or deleted in Firestore
        const cSnap = await getDoc(doc(db, "cashiers", cashierId)).catch(() => null);
        if (cSnap?.exists() && cSnap.data()?.status !== "inactive") {
          // Account is marked ACTIVE in cashiers collection! Stale revocation: auto-purge and allow!
          deleteDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => {});
          return;
        }

        if (data?.forceLogout || data?.status === "inactive") {
          terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
        }
      }
    }, (err) => {
      console.warn("Cashier guard revoked snapshot error:", err);
    });

    // 4. Real-time Firestore snapshot on revoked sessions by Name Slug
    let unsubRevokedName: (() => void) | null = null;
    if (cashierName) {
      const nameSlug = cashierName.trim().toLowerCase().replace(/\s+/g, "_");
      unsubRevokedName = onSnapshot(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`), async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const sessionLoginTime = activeSession.loggedInAt || "";
          if (data?.revokedAt && sessionLoginTime && data.revokedAt < sessionLoginTime) {
            deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {});
            return;
          }

          const cSnap = await getDoc(doc(db, "cashiers", cashierId)).catch(() => null);
          if (cSnap?.exists() && cSnap.data()?.status !== "inactive") {
            deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {});
            return;
          }

          if (data?.status === "inactive" || data?.forceLogout) {
            terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
          }
        }
      }, (err) => {
        console.warn("Cashier guard revoked name snapshot error:", err);
      });
    }

    // 5. Cross-tab storage listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "active_cashier_session" && !e.newValue) {
        terminateCashierSession("تم تسجيل الخروج من حساب الكاشير.");
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      unsubCashier();
      unsubRevoked();
      if (unsubRevokedName) unsubRevokedName();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [pathname]);

  return null;
}
