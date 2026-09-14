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

      // Account is active: Clean up any stale leftover tombstones from previous deletions
      const revokedSnap = await getDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => null);
      if (revokedSnap?.exists()) {
        const revData = revokedSnap.data();
        if (revData?.status === "inactive" || (revData?.revokedAt && cashierData?.updatedAt && revData.revokedAt > cashierData.updatedAt)) {
          terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
          return;
        } else {
          // Stale tombstone from an old deleted account - clean it up so it never interferes
          deleteDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => {});
        }
      }

      if (cashierName) {
        const nameSlug = cashierName.trim().toLowerCase().replace(/\s+/g, "_");
        const revokedNameSnap = await getDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => null);
        if (revokedNameSnap?.exists()) {
          const revNameData = revokedNameSnap.data();
          if (revNameData?.status === "inactive" || (revNameData?.revokedAt && cashierData?.updatedAt && revNameData.revokedAt > cashierData.updatedAt)) {
            terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
            return;
          } else {
            // Stale name slug tombstone from an old deleted account - auto-purge!
            deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {});
          }
        }
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
    const unsubRevoked = onSnapshot(doc(db, "revoked_cashier_sessions", cashierId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
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
      unsubRevokedName = onSnapshot(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.status === "inactive") {
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
