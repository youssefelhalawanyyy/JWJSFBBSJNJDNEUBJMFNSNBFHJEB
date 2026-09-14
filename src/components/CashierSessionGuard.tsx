"use client";

import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
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
        reasonMessage || "تم حذف هذا الحساب من قبل الإدارة. تم تسجيل الخروج تلقائياً من كافة الأجهزة.",
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
      const revokedSnap = await getDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => null);
      if (revokedSnap?.exists()) {
        terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
        return;
      }
      if (cashierName) {
        const nameSlug = cashierName.trim().toLowerCase().replace(/\s+/g, "_");
        const revokedNameSnap = await getDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => null);
        if (revokedNameSnap?.exists()) {
          terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
          return;
        }
      }
    }).catch(() => {});

    // 2. Real-time Firestore snapshot on the cashier document
    const unsubCashier = onSnapshot(doc(db, "cashiers", cashierId), (snap) => {
      if (!snap.exists()) {
        terminateCashierSession("تم حذف هذا الحساب من قبل الإدارة. تم تسجيل الخروج من جميع الأجهزة.");
      }
    }, (err) => {
      console.warn("Cashier guard doc snapshot error:", err);
    });

    // 3. Real-time Firestore snapshot on revoked sessions by ID
    const unsubRevoked = onSnapshot(doc(db, "revoked_cashier_sessions", cashierId), (snap) => {
      if (snap.exists()) {
        terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
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
          terminateCashierSession("تم إنهاء صلاحية هذا الحساب عن بُعد من قبل الإدارة. تم تسجيل الخروج.");
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
