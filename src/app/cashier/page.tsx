"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, getDoc, onSnapshot } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import {
  Lock, User as UserIcon, ChevronDown, FileText, Shield,
  Calendar as CalendarIcon, UserCircle, Globe, LogOut,
  Download, Bell, Fingerprint, ScanLine, ChevronRight, AlertTriangle,
  ClipboardList, Clock, CheckSquare, LayoutGrid, LayoutDashboard, FileBarChart2, Sparkles, BookOpen, Barcode, Pin, PinOff, Package,
  CalendarDays
} from "lucide-react";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { SkeletonDashboard } from "@/components/MobileUX/SkeletonLoader";
import { ActivityRing } from "@/components/MobileUX/ActivityRing";
import { PinPad } from "@/components/PinPad";
import { WelcomeSplash } from "@/components/MobileUX/WelcomeSplash";
import { playSuccessSound, playErrorSound, playPopSound, getAudioCtx } from "@/lib/sounds";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { normalizeArabicName } from "@/lib/schedule-generator";

// ── Midnight Navy Design Tokens (Matches Screenshot) ────────────────
const D = {
  bg: "#0B1121",        // Deep midnight blue
  surface: "#151E32",        // Card background
  surfaceHigh: "#1C2841",        // Elevated surface / hovers
  border: "rgba(34, 211, 238, 0.15)", // Subtle cyan border
  borderMid: "rgba(34, 211, 238, 0.25)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.15)",
  redBorder: "rgba(239,68,68,0.30)",
  textPrimary: "#f8fafc",        // slate-50
  textSecondary: "#94a3b8",        // slate-400
  textDim: "#64748b",        // slate-500
  cyan: "#22d3ee",        // Cyan accent
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  greenBorder: "rgba(52,211,153,0.25)",
};

function DashboardTimeMetrics({ authenticatedUser, lang }: { authenticatedUser: any, lang: string }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const getShiftProgress = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const elapsedSeconds = (hours % 12) * 3600 + minutes * 60 + seconds;
    return elapsedSeconds / (12 * 3600);
  };
  const shiftProgress = getShiftProgress();
  const shiftProgressPercentage = Math.round(shiftProgress * 100);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ActivityRing
        progress={shiftProgress}
        size={64}
        strokeWidth={4}
        color="#22d3ee"
        bgColor="rgba(34, 211, 238, 0.15)"
        icon={
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, #083344, #164e63)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)" }}>
            {authenticatedUser.name.charAt(0).toUpperCase()}
          </div>
        }
      />
      <div>
        <div style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{authenticatedUser.role}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary }}>{authenticatedUser.name.split(" ")[0]}</div>
        <div className="text-[10px] text-cyan-400 font-bold mt-0.5">Shift Progress: {shiftProgressPercentage}%</div>
      </div>
    </div>
  );
}

function DashboardClock({ lang }: { lang: string }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: D.textPrimary, fontWeight: 700 }}>
      <Clock size={14} className="text-cyan-400" />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{currentTime.toLocaleTimeString(lang === "en" ? "en-US" : "ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
}

export default function CashierHubPage() {
  const router = useRouter();
  const { language: lang, setLanguage, t: tFunc } = useLanguage();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [hasFaceIdRegistered, setHasFaceIdRegistered] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [pinnedWidgets, setPinnedWidgets] = useState<string[]>([]);
  const [todayShift, setTodayShift] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticatedUser) return;
    const fetchTodayShift = async () => {
      try {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const todayStr = now.toISOString().split("T")[0];
        const rawStoreId = authenticatedUser.storeId && authenticatedUser.storeId !== "N/A" && authenticatedUser.storeId !== "ALL"
          ? authenticatedUser.storeId
          : (authenticatedUser.branchId || "eL-alamein-4");
        const sId = rawStoreId.toLowerCase().includes("ola") ? "ola-el-koronfol" : "eL-alamein-4";
        const ALL_STORES = Array.from(new Set(["eL-alamein-4", "ola-el-koronfol", sId]));

        let userShiftFound: string | null = null;
        const targetUserNorm = normalizeArabicName(authenticatedUser?.name);

        // 1. Direct Firestore check across all store schedules
        for (const storeKey of ALL_STORES) {
          try {
            const snap = await getDoc(doc(db, "schedules", `${storeKey}_${month}`));
            if (snap.exists()) {
              const data = snap.data();
              if (data && data.assignments && data.assignments.length > 0) {
                const todayEntry = data.assignments?.find((d: any) => d.date === todayStr);
                const myS = todayEntry?.shifts?.find((s: any) =>
                  s.employeeId === authenticatedUser.id ||
                  s.employeeId === authenticatedUser.employeeId ||
                  (s.employeeName && targetUserNorm && normalizeArabicName(s.employeeName) === targetUserNorm)
                );
                if (myS) {
                  userShiftFound = myS.shiftTime;
                  break;
                }
              }
            }
          } catch {
            // continue fallback
          }
        }

        // 2. API fallback if direct read didn't find shift
        if (!userShiftFound) {
          for (const storeKey of ALL_STORES) {
            try {
              const res = await fetch(`/api/schedule?storeId=${storeKey}&month=${month}&t=${Date.now()}`, { cache: "no-store" });
              const data = await res.json();
              if (data.schedule && data.schedule.assignments && data.schedule.assignments.length > 0) {
                const todayEntry = data.schedule.assignments?.find((d: any) => d.date === todayStr);
                const myS = todayEntry?.shifts?.find((s: any) =>
                  s.employeeId === authenticatedUser.id ||
                  s.employeeId === authenticatedUser.employeeId ||
                  (s.employeeName && targetUserNorm && normalizeArabicName(s.employeeName) === targetUserNorm)
                );
                if (myS) {
                  userShiftFound = myS.shiftTime;
                  break;
                }
              }
            } catch {}
          }
        }

        if (userShiftFound) {
          setTodayShift(userShiftFound);
        }
      } catch (err) {
        console.warn("Cashier today shift notice", err);
      }
    };
    fetchTodayShift();
  }, [authenticatedUser]);

  useEffect(() => {
    const saved = localStorage.getItem("ck_pinned_widgets");
    if (saved) {
      try { setPinnedWidgets(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPinnedWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("ck_pinned_widgets", JSON.stringify(next));
      return next;
    });
  };

  // Fake state for bottom nav aesthetics
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleRefresh = async () => {
    // Refresh without artificial delay
    showIsland(lang === "ar" ? "تم التحديث" : "Refreshed", { type: "success" });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
      else setIsInstalled(false);
      const h = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setIsInstalled(false); };
      window.addEventListener("beforeinstallprompt", h);
      window.addEventListener("appinstalled", () => { setIsInstalled(true); setDeferredPrompt(null); });
      return () => window.removeEventListener("beforeinstallprompt", h);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window)
      if (Notification.permission === "granted") setIsNotificationEnabled(true);
  }, []);

  useEffect(() => {
    if (selectedEmployeeId)
      setHasFaceIdRegistered(localStorage.getItem(`faceid_enabled_${selectedEmployeeId}`) === "true");
    else setHasFaceIdRegistered(false);
  }, [selectedEmployeeId]);

  const handleInstallClick = async () => {
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIOS) { toast.info("Tap 'Share' → 'Add to Home Screen' in Safari."); return; }
    if (!deferredPrompt) { toast.warning("Use browser menu → Add to Home screen."); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { setDeferredPrompt(null); setIsInstalled(true); }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) { toast.error("Notifications not supported."); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && messaging) {
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const mi = await messaging;
        if (mi) {
          const token = await getToken(mi, {
            vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M",
            serviceWorkerRegistration: swReg,
          });
          if (token && authenticatedUser) {
            await dbService.setDoc("user_tokens", authenticatedUser.id, {
              fcmToken: token, name: authenticatedUser.name,
              role: authenticatedUser.role || "cashier", updatedAt: new Date().toISOString(),
            });
            setIsNotificationEnabled(true);
            toast.success(lang === "en" ? "Notifications enabled!" : "تم تفعيل الإشعارات!");
          }
        }
      } else toast.error(lang === "en" ? "Permission denied." : "تم رفض الإذن.");
    } catch (err: any) { toast.error(err.message); }
  };

  useEffect(() => {
    const saved = localStorage.getItem("active_cashier_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id === "master_youssef") {
          setAuthenticatedUser(parsed);
          setShowWelcome(true);
          setLoading(false);
          return;
        }
        if (parsed?.id) {
          getDoc(doc(db, "cashiers", parsed.id)).then(async (snap) => {
            if (!snap.exists()) {
              console.warn("Cached cashier account no longer exists in Firestore. Purging session.");
              localStorage.removeItem("active_cashier_session");
              setAuthenticatedUser(null);
              setLoading(false);
              toast.error(lang === "en" ? "This cashier account was removed. Please log in again." : "تم حذف هذا الحساب من قبل الإدارة. يرجى تسجيل الدخول مجدداً.");
              return;
            }

            const cData = snap.data();
            if (cData?.status === "inactive") {
              localStorage.removeItem("active_cashier_session");
              setAuthenticatedUser(null);
              setLoading(false);
              toast.error(lang === "en" ? "This account is deactivated by management." : "هذا الحساب معطل حالياً من قبل الإدارة.");
              return;
            }

            const revSnap = await getDoc(doc(db, "revoked_cashier_sessions", parsed.id)).catch(() => null);
            if (revSnap?.exists() && (revSnap.data()?.status === "inactive" || revSnap.data()?.forceLogout)) {
              localStorage.removeItem("active_cashier_session");
              setAuthenticatedUser(null);
              setLoading(false);
              toast.error(lang === "en" ? "This account session was revoked." : "تم إنهاء صلاحية هذا الحساب.");
              return;
            }
            setAuthenticatedUser(parsed);
            setShowWelcome(true);
            setLoading(false);
          }).catch(() => {
            setAuthenticatedUser(parsed);
            setShowWelcome(true);
            setLoading(false);
          });
          return;
        }
      } catch {
        console.error("Bad session");
        localStorage.removeItem("active_cashier_session");
      }
    }
    (async () => {
      try {
        const cashSnap = await getDocs(collection(db, "cashiers"));
        // Cashiers collection is source of truth. Never auto-delete cashiers!
        let list: any[] = cashSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        list.push({ id: "master_youssef", employeeId: "master_youssef", name: "Mr Youssef (Owner)", pin: "4321", role: "master", storeId: "ALL" });
        setEmployees(list);
      } catch (e) { console.error("Failed to load cashiers list:", e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleLogin = (e: React.FormEvent | string) => {
    if (typeof e !== "string") e.preventDefault();
    if (!selectedEmployeeId) { toast.error(lang === "en" ? "Select your name first." : "اختر اسمك أولاً."); return; }
    const user = employees.find(x => x.id === selectedEmployeeId);
    if (!user) return;

    if (user.status === "inactive") {
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      playErrorSound();
      toast.error(
        lang === "en" 
          ? "This account is deactivated by management. Please contact your manager." 
          : "هذا الحساب معطل حالياً من قبل الإدارة. يرجى مراجعة المسؤول."
      );
      return;
    }

    const pin = typeof e === "string" ? e : pinInput;
    if (!user.pin || pin !== user.pin) {
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      playErrorSound();
      toast.error(lang === "en" ? "Incorrect PIN" : "الرمز السري غير صحيح");
      setPinInput("");
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
      return;
    }
    playSuccessSound();
    const session = { id: user.id, name: user.name, employeeId: user.employeeId || "", storeId: user.storeId || "N/A", branchId: user.branchId || "alamein4", role: user.position || user.role || "cashier", features: user.features || {}, loggedInAt: new Date().toISOString() };
    localStorage.setItem("active_cashier_session", JSON.stringify(session));
    setPinInput("");
    setAuthenticatedUser(session);
    setShowWelcome(true);
  };

  const registerFaceId = async () => {
    if (!window.PublicKeyCredential) return;
    try {
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16); window.crypto.getRandomValues(userId);
      const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "CK Shift App", id: window.location.hostname }, user: { id: userId, name: selectedEmployeeId, displayName: selectedEmployeeId }, pubKeyCredParams: [{ alg: -7, type: "public-key" }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000 } });
      if (cred) {
        localStorage.setItem(`faceid_enabled_${selectedEmployeeId}`, "true");
        setHasFaceIdRegistered(true);
        toast.success(lang === "en" ? "FaceID / TouchID Enabled!" : "تم تفعيل البصمة!");
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp) handleLogin(emp.pin);
      }
    } catch { toast.error("Biometric failed."); }
  };

  const loginWithFaceId = async (empId: string) => {
    try {
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      const assert = await navigator.credentials.get({ publicKey: { challenge, rpId: window.location.hostname, userVerification: "required" } });
      if (assert) {
        const user = employees.find(x => x.id === empId);
        if (user) {
          playSuccessSound();
          const session = { id: user.id, name: user.name, role: user.position || user.role || "cashier", features: user.features || {}, loggedInAt: new Date().toISOString() };
          localStorage.setItem("active_cashier_session", JSON.stringify(session));
          setAuthenticatedUser(session);
          setShowWelcome(true);
        }
      }
    } catch { playErrorSound(); }
  };

  const handleLogout = () => {
    playPopSound();
    localStorage.removeItem("active_cashier_session");
    sessionStorage.removeItem("active_cashier_session");
    setAuthenticatedUser(null); setSelectedEmployeeId(""); setPinInput("");
  };

  // Real-time listener: Immediately log out if this cashier account is deleted or revoked by an admin
  useEffect(() => {
    if (!authenticatedUser?.id || authenticatedUser.id === "master_youssef") return;
    const cashierId = authenticatedUser.id;

    // 1. Direct document listener on cashiers collection
    const unsubCashier = onSnapshot(doc(db, "cashiers", cashierId), (snap) => {
      if (!snap.exists()) {
        console.warn("Cashier account deleted in Firestore. Forcing logout.");
        toast.error(
          lang === "en" 
            ? "This cashier account has been removed by an administrator. Logged out." 
            : "تم حذف هذا الحساب من قبل الإدارة. تم تسجيل الخروج تلقائياً.",
          { duration: 6000 }
        );
        handleLogout();
      }
    }, (err) => {
      console.warn("Cashier snapshot error:", err);
    });

    // 2. Real-time listener on revoked_cashier_sessions
    const unsubRevoked = onSnapshot(doc(db, "revoked_cashier_sessions", cashierId), (snap) => {
      if (snap.exists()) {
        console.warn("Cashier session revoked in Firestore. Forcing logout.");
        toast.error(
          lang === "en" 
            ? "This account session has been revoked by an administrator. Logged out." 
            : "تم إنهاء صلاحية هذا الحساب من قبل الإدارة. تم تسجيل الخروج.",
          { duration: 6000 }
        );
        handleLogout();
      }
    }, (err) => {
      console.warn("Revoked snapshot error:", err);
    });

    // 3. Local tab event from CashierSessionGuard
    const handleSessionRevokedEvent = (e: any) => {
      if (e.detail?.cashierId === cashierId) {
        handleLogout();
      }
    };
    window.addEventListener("cashier_session_revoked", handleSessionRevokedEvent);

    return () => {
      unsubCashier();
      unsubRevoked();
      window.removeEventListener("cashier_session_revoked", handleSessionRevokedEvent);
    };
  }, [authenticatedUser, lang]);

  const nav = (path: string) => { playPopSound(); router.push(path); };
  const isRTL = lang === "ar";

  // Fallback static time for backgrounds (won't re-render entire tree)
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 6 && currentHour < 18;
  const timeBasedBg = isMorning
    ? "linear-gradient(180deg, #083344 0%, #0B1121 100%)" // Morning: Deep Teal to Midnight
    : "linear-gradient(180deg, #050810 0%, #020617 100%)"; // Night: Ultra Dark Indigo/Black

  // Root forced-dark wrapper style
  const rootStyle: React.CSSProperties = {
    background: timeBasedBg,
    color: D.textPrimary,
    colorScheme: "dark",
    fontFamily: "'Inter', 'Cairo', -apple-system, system-ui, sans-serif",
    minHeight: "100vh", // Using 100vh instead of 100dvh to fill the bottom safe area
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  };

  // ─── LOADING ──────────────────────────────────────────────
  if (loading) return (
    <div style={rootStyle}>
      <SkeletonDashboard />
    </div>
  );

  // ─── AUTHENTICATED DASHBOARD ──────────────────────────────
  if (authenticatedUser) {
    const isMaster = authenticatedUser.role === "master";
    const canUseScanner = isMaster || authenticatedUser.features?.canUseMasterScanner === true;

    const actions = [
      ...(isMaster ? [{ id: "master", label: lang === "en" ? "Master Feed" : "اللوحة الرئيسية", icon: Bell, path: "/cashier/master", badge: "LIVE" }] : []),
      ...(canUseScanner ? [{ id: "scanner", label: lang === "en" ? "Master Scanner" : "ماسح الباركود", icon: ScanLine, path: "/cashier/lookup", badge: "NEW" }] : []),
      { id: "shift", label: lang === "en" ? "Daily Shift Report" : "تقرير الوردية", icon: FileText, path: "/shift-reports/cashier" },
      { id: "void", label: lang === "en" ? "Log a Void" : "تسجيل مرتجع", icon: Shield, path: "/voids/cashier" },
      { id: "expiry", label: lang === "en" ? "Expiry Tracker" : "تواريخ الصلاحية", icon: CalendarIcon, path: "/expiries" },
      { id: "outofstock", label: lang === "en" ? "Out of Stock" : "النواقص", icon: AlertTriangle, path: "/cashier/out-of-stock", badge: "NEW" },
      { id: "checklist", label: lang === "en" ? "Checklists" : "قوائم المراجعة", icon: CheckSquare, path: "/checklists/cashier" },
      { id: "cleaning", label: lang === "en" ? "Cleaning" : "النظافة", icon: Sparkles, path: "/cashier/cleaning" },
      { id: "lostandfound", label: lang === "en" ? "Lost & Found" : "المفقودات", icon: Package, path: "/cashier/lost-and-found", badge: "NEW" },
      { id: "sop", label: lang === "en" ? "Food SOP" : "دليل التشغيل", icon: BookOpen, path: "/cashier/sop", badge: "NEW" },
      { id: "codes", label: lang === "en" ? "Food & Coffee Codes" : "أكواد الفود والقهوة", icon: Barcode, path: "/cashier/food-codes", badge: "NEW" },
      { id: "account", label: lang === "en" ? "My Account" : "حسابي", icon: UserCircle, path: "/cashier/account" },
      { id: "schedule", label: lang === "en" ? "My Schedule" : "جدول العمل", icon: ClipboardList, path: "/cashier/schedule" },
      { id: "inventory", label: lang === "en" ? "Inventory Count" : "جرد المخزون", icon: ScanLine, path: "/inventory-audit/cashier" },
    ] as any[];

    const sortedActions = [...actions].sort((a, b) => {
      const aPinned = pinnedWidgets.includes(a.id);
      const bPinned = pinnedWidgets.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    return (
      <div style={{ ...rootStyle, direction: isRTL ? "rtl" : "ltr" }}>
        {showWelcome && <WelcomeSplash name={authenticatedUser.name} onComplete={() => setShowWelcome(false)} />}

        <style>{`
          html, body { background-color: ${isMorning ? "#0B1121" : "#020617"} !important; overscroll-behavior-y: none; }
          .ck-cashier * { color-scheme: dark !important; }
        `}</style>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 20px 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: D.textSecondary, textTransform: "uppercase", flexShrink: 0 }}>
            CIRCLE K <span style={{ color: D.textDim, fontWeight: 500 }}>ANH Portal</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => { playPopSound(); setLanguage(lang === "en" ? "ar" : "en"); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: D.surfaceHigh, border: `1px solid ${D.border}`, color: D.cyan, fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}
            >
              <Globe size={14} />
              {lang === "en" ? "AR" : "EN"}
            </button>
            {!isInstalled && (
              <button
                onClick={() => { playPopSound(); handleInstallClick(); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}
              >
                <Download size={14} />
                {lang === "en" ? "Install" : "تنزيل"}
              </button>
            )}
            <div style={{ width: 28, height: 28, borderRadius: 8, background: D.red, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff", flexShrink: 0 }}>
              K
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, paddingBottom: "100px", position: "relative" }}>
          <PullToRefresh onRefresh={handleRefresh}>
            <div style={{ padding: "0 20px" }}>

              {/* Account Overview Header Card */}
              <div style={{ backgroundColor: "rgba(21, 30, 50, 0.6)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 24, padding: "24px", marginBottom: 24, border: `1px solid ${D.border}`, boxShadow: "0 4px 24px -1px rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <DashboardTimeMetrics authenticatedUser={authenticatedUser} lang={lang} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { playPopSound(); handleEnableNotifications(); }} style={{ width: 36, height: 36, borderRadius: 12, background: isNotificationEnabled ? D.cyanDim : D.surfaceHigh, border: `1px solid ${isNotificationEnabled ? D.cyanBorder : D.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                      <Bell size={16} color={isNotificationEnabled ? D.cyan : D.textSecondary} />
                      {isNotificationEnabled && <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", backgroundColor: D.cyan, border: `2px solid ${D.surface}` }} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>
                    <LayoutDashboard size={14} className="text-cyan-400" />
                    <span>{authenticatedUser.branchId || "El Alamein 4"}</span>
                  </div>
                  <DashboardClock lang={lang} />
                </div>

                <div
                  onClick={() => nav("/cashier/schedule")}
                  style={{
                    marginTop: 14,
                    padding: "12px 16px",
                    borderRadius: 16,
                    background: todayShift && todayShift.toLowerCase().includes("off") ? "rgba(100,116,139,0.14)" : "rgba(34,211,238,0.12)",
                    border: `1px solid ${todayShift && todayShift.toLowerCase().includes("off") ? "rgba(100,116,139,0.25)" : D.cyanBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: todayShift && todayShift.toLowerCase().includes("off") ? "rgba(100,116,139,0.25)" : D.cyanDim,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <CalendarDays size={18} color={todayShift && todayShift.toLowerCase().includes("off") ? D.textSecondary : D.cyan} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {lang === "en" ? "Work Schedule Roster" : "جدول مواعيد العمل"}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>
                        {todayShift || (lang === "en" ? "View Monthly Roster" : "عرض ورديات الشهر")}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: D.cyan, display: "flex", alignItems: "center", gap: 4 }}>
                    {lang === "en" ? "Full Roster" : "الجدول"}
                    <ChevronRight size={14} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: D.textSecondary, textTransform: "uppercase", marginBottom: 12, padding: "0 4px" }}>
                {lang === "en" ? "Operations" : "العمليات"}
              </div>

              {/* Action Grid (Upgraded for POS Touch Screen) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginTop: 12 }}>
                {sortedActions.map((a: any) => {
                  const Icon = a.icon;
                  const isPinned = pinnedWidgets.includes(a.id);
                  // Assign unique gradients based on the action type for a premium look
                  let bgGradient = "rgba(30, 41, 59, 0.6)";
                  let iconColor = D.cyan;
                  let iconBg = D.cyanDim;
                  let borderColor = "rgba(34, 211, 238, 0.15)";

                  if (a.id === "shift") { bgGradient = "rgba(22, 78, 99, 0.6)"; iconColor = "#22d3ee"; iconBg = "rgba(34,211,238,0.2)"; borderColor = "rgba(34,211,238,0.3)"; }
                  if (a.id === "void") { bgGradient = "rgba(127, 29, 29, 0.6)"; iconColor = "#f87171"; iconBg = "rgba(248,113,113,0.2)"; borderColor = "rgba(248,113,113,0.3)"; }
                  if (a.id === "inventory") { bgGradient = "rgba(6, 95, 70, 0.6)"; iconColor = "#34d399"; iconBg = "rgba(52,211,153,0.2)"; borderColor = "rgba(52,211,153,0.3)"; }
                  if (a.id === "outofstock") { bgGradient = "rgba(161, 98, 7, 0.6)"; iconColor = "#facc15"; iconBg = "rgba(250,204,21,0.2)"; borderColor = "rgba(250,204,21,0.3)"; }

                  return (
                    <button
                      key={a.id}
                      onClick={() => nav(a.path)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
                        padding: "24px 16px", borderRadius: 24, background: bgGradient, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${borderColor}`,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)",
                        cursor: "pointer", textAlign: "center", transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        position: "relative", transform: "translateZ(0)", WebkitTransform: "translateZ(0)"
                      }}
                      onPointerDown={e => { e.currentTarget.style.transform = "scale(0.98) translateZ(0)"; e.currentTarget.style.filter = "brightness(1.2)"; }}
                      onPointerUp={e => { e.currentTarget.style.transform = "scale(1) translateZ(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
                      onPointerLeave={e => { e.currentTarget.style.transform = "scale(1) translateZ(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
                    >
                      <div 
                        onClick={(e) => togglePin(e, a.id)}
                        style={{ position: "absolute", top: 12, left: 12, padding: "4px", borderRadius: "50%", background: isPinned ? D.cyan : "rgba(255,255,255,0.1)", color: isPinned ? D.bg : "#fff", zIndex: 10, cursor: "pointer", transition: "background 0.2s" }}
                      >
                        {isPinned ? <Pin size={12} fill="currentColor" /> : <Pin size={12} />}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: iconBg, boxShadow: `0 4px 12px ${iconBg}` }}>
                        <Icon size={28} color={iconColor} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1.2, letterSpacing: "0.02em" }}>{a.label}</span>
                      
                      {a.badge && (
                        <span style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 900, padding: "4px 8px", borderRadius: 8, background: D.cyan, color: D.bg, textTransform: "uppercase" }}>{a.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>

            </div>
          </PullToRefresh>
        </main>

        {/* ── BOTTOM NAV ── */}
        <CashierBottomNav lang={lang} />
      </div>
    );
  }

  // ─── LOGIN SCREEN ─────────────────────────────────────────
  return (
    <div style={{ ...rootStyle, direction: isRTL ? "rtl" : "ltr", alignItems: "stretch" }} onClick={() => getAudioCtx()}>
      <style>{`
        html, body { background-color: ${isMorning ? "#0B1121" : "#020617"} !important; overscroll-behavior-y: none; }
        .ck-cashier * { color-scheme: dark !important; }
        .ck-pinpad button { background-color: ${D.surfaceHigh} !important; color: ${D.textPrimary} !important; border-color: ${D.border} !important; }
        .ck-pinpad button:active { background-color: ${D.cyanDim} !important; border-color: ${D.cyanBorder} !important; color: ${D.cyan} !important; }
      `}</style>

      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 20px 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: D.textSecondary, textTransform: "uppercase", flexShrink: 0 }}>
          CIRCLE K <span style={{ color: D.textDim, fontWeight: 500 }}>ANH Portal</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => { playPopSound(); setLanguage(lang === "en" ? "ar" : "en"); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: D.surface, border: `1px solid ${D.border}`, color: D.textSecondary, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <Globe size={14} />
            {lang === "en" ? "EN" : "AR"}
          </button>
          {!isInstalled && (
            <button onClick={() => { playPopSound(); handleInstallClick(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              <Download size={14} />
              {lang === "en" ? "Install App" : "تنزيل التطبيق"}
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px 24px" }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: D.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 900, color: "#fff", marginBottom: 20, boxShadow: `0 0 0 4px ${D.redDim}, 0 10px 30px rgba(239,68,68,0.3)` }}>K</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{lang === "en" ? "Staff Login" : "تسجيل الدخول"}</h1>
      </div>

      {/* Form card */}
      <div style={{ flex: 1, margin: "0 20px 32px" }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: D.surface, borderRadius: 24, border: `1px solid ${D.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", overflow: "hidden" }}>

          {/* Name section */}
          <div style={{ padding: "24px 24px 16px", borderBottom: `1px solid ${D.border}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: D.textDim, textTransform: "uppercase", marginBottom: 12 }}>
              <UserIcon size={12} color={D.cyan} />
              {lang === "en" ? "Select Account" : "اختر الحساب"}
            </label>
            <div style={{ position: "relative" }}>
              <div onClick={() => { playPopSound(); setIsDropdownOpen(!isDropdownOpen); }} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", backgroundColor: D.surfaceHigh, border: `1px solid ${isDropdownOpen ? D.cyanBorder : D.border}`, boxSizing: "border-box" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: selectedEmployeeId ? D.textPrimary : D.textDim }}>
                  {selectedEmployeeId ? employees.find(x => x.id === selectedEmployeeId)?.name || (lang === "en" ? "Select name" : "اختر الاسم") : (lang === "en" ? "Select your name" : "اختر اسمك")}
                </span>
                <ChevronDown size={18} color={D.textDim} style={{ transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </div>
              {isDropdownOpen && (
                <div style={{ position: "absolute", zIndex: 100, top: "calc(100% + 8px)", left: 0, right: 0, maxHeight: 240, overflowY: "auto", borderRadius: 12, backgroundColor: D.surface, border: `1px solid ${D.cyanBorder}`, boxShadow: "0 20px 40px rgba(0,0,0,0.7)" }}>
                  {employees.length === 0
                    ? <div style={{ padding: 20, textAlign: "center", color: D.textDim, fontSize: 13 }}>{lang === "en" ? "No employees found." : "لا يوجد موظفون."}</div>
                    : employees.map((c, idx) => (
                      <div key={c.id} onClick={() => { playPopSound(); setSelectedEmployeeId(c.id); setIsDropdownOpen(false); if (localStorage.getItem(`faceid_enabled_${c.id}`) === "true") loginWithFaceId(c.id); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: idx < employees.length - 1 ? `1px solid ${D.border}` : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: D.cyanDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: D.cyan, flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: c.status === "inactive" ? "#94a3b8" : D.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{c.name}</span>
                            {c.status === "inactive" && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                                {lang === "en" ? "Deactivated" : "معطل"}
                              </span>
                            )}
                          </div>
                          {c.position && <div style={{ fontSize: 10, fontWeight: 600, color: D.textSecondary, marginTop: 2, textTransform: "uppercase" }}>{c.position}</div>}
                        </div>
                        {localStorage.getItem(`faceid_enabled_${c.id}`) === "true" && <Fingerprint size={16} color={D.cyan} style={{ opacity: 0.8, flexShrink: 0 }} />}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* PIN section */}
          <div style={{ padding: "20px 24px 24px" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: D.textDim, textTransform: "uppercase", marginBottom: 20 }}>
              <Lock size={12} color={D.cyan} />
              {lang === "en" ? "Enter 4-Digit PIN" : "أدخل الرمز السري"}
            </label>
            <div className="flex-1 flex flex-col justify-end pb-8">
              <PinPad onPinChange={(val) => setPinInput(val)} onSubmit={(val) => handleLogin(val as any)} maxLength={4} error={pinError} />
            </div>
            {hasFaceIdRegistered && (
              <button type="button" onClick={() => { playPopSound(); loginWithFaceId(selectedEmployeeId); }} style={{ marginTop: 20, width: "100%", padding: "14px 20px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: D.cyanDim, border: `1px solid ${D.cyanBorder}`, color: D.cyan, fontSize: 14, fontWeight: 700, cursor: "pointer", boxSizing: "border-box" }}>
                <Fingerprint size={18} color={D.cyan} />
                {lang === "en" ? "Login with FaceID" : "دخول بالبصمة"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
