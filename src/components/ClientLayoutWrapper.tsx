"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sun, Moon, Shield, Database, LayoutDashboard, FileText, Printer, ClipboardList, CheckCircle, Search, LogOut, User, Users, Menu, X, Bell, PackageX, Truck, CalendarDays, DollarSign, Activity, Wallet, Tag, Sparkles, Barcode, Briefcase, Clock, PackageMinus, Package, Bot, ShoppingCart, Box, Monitor, ArrowLeft } from "lucide-react";
import { auth, messaging, dbService, db } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, limit } from "firebase/firestore";
import PwaInstallPrompt from "./PwaInstallPrompt";
import type { User as FirebaseUser } from "firebase/auth";
import { useBranch, BranchId, BRANCHES } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useBrand } from "@/context/BrandContext";
import { ThemeToggle } from "./ThemeToggle";
import { Store, Languages } from "lucide-react";
import GlobalReminders from "./GlobalReminders";
import { IdleScreensaver } from "./IdleScreensaver";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ManagerBottomNav } from "./MobileUX/ManagerBottomNav";
import { MobileHeader } from "./MobileUX/MobileHeader";
import { updateAppBadge, sendManagerInteractiveNotification, triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";
import { audioChimes } from "@/lib/audio-chimes";

import WelcomeModal from "./WelcomeModal";
import { RemoteMessageOverlay, RemoteMessage } from "./RemoteMessageOverlay";
import { RemoteLockOverlay } from "./RemoteLockOverlay";
import EnterpriseLoginScreen from "./EnterpriseLoginScreen";
import NotificationBell from "./NotificationBell";
import { CashierSessionGuard } from "./CashierSessionGuard";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { currentBranch, setBranch, availableBranches, setAvailableBranches } = useBranch();
  const currentBranchRef = React.useRef(currentBranch);
  useEffect(() => {
    currentBranchRef.current = currentBranch;
  }, [currentBranch]);
  const { language, setLanguage, t } = useLanguage();
  const { logoUrl, brandColor } = useBrand();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [role, setRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("circlek_role") || "owner";
    }
    return "owner";
  });
  const [user, setUser] = useState<FirebaseUser | null>(() => {
    if (typeof window !== "undefined" && auth?.currentUser) {
      return auth.currentUser;
    }
    return null;
  });
  const [userDoc, setUserDoc] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const fullCached = localStorage.getItem("circlek_cached_user_doc");
        if (fullCached) return JSON.parse(fullCached);
      } catch (e) {}
      const cachedName = localStorage.getItem("circlek_user_name");
      const cachedRole = localStorage.getItem("circlek_role");
      if (cachedName || cachedRole) {
        return { displayName: cachedName || "Manager", role: cachedRole || "manager" };
      }
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      if (auth?.currentUser || localStorage.getItem("circlek_logged_in") === "true") return false;
    }
    return true;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingShiftCount, setPendingShiftCount] = useState(0);
  const [pendingVoidCount, setPendingVoidCount] = useState(0);
  const [pendingExpiriesCount, setPendingExpiriesCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const [pendingOosCount, setPendingOosCount] = useState(0);
  const [hasAgedShifts, setHasAgedShifts] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [incomingRemoteMessage, setIncomingRemoteMessage] = useState<RemoteMessage | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockPin, setLockPin] = useState("1234");
  const [lockReason, setLockReason] = useState("");
  const [lockedAt, setLockedAt] = useState<string | undefined>(undefined);
  const pathname = usePathname();
  const router = useRouter();
  const isAr = language === "ar";

  const [pushPermissionNeeded, setPushPermissionNeeded] = useState(false);

  const registerFcmPushToken = async (currentUserObj?: any) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error(language === "ar" ? "الإشعارات غير مدعومة على هذا الجهاز" : "Push notifications are not supported on this browser/device.");
      return;
    }

    try {
      let perm = Notification.permission;

      if (perm === "denied") {
        toast.error(
          language === "ar"
            ? "الإشعارات محظورة من إعدادات المتصفح. يرجى تفعيلها من إعدادات الموقع."
            : "Notifications are blocked in your browser settings. Please enable notification permissions in site settings.",
          { duration: 6000 }
        );
        setPushPermissionNeeded(false);
        return;
      }

      if (perm !== "granted") {
        setPushPermissionNeeded(true);
        return;
      }

      if (perm === "granted") {
        setPushPermissionNeeded(false);
        toast.success(language === "ar" ? "تم تفعيل الإشعارات بنجاح! 🔔" : "Push notifications enabled successfully! 🔔");

        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((swErr) => {
            console.warn("SW register catch:", swErr);
            return null;
          });
          if (reg) await navigator.serviceWorker.ready;

          if (messaging) {
            const messagingInstance = await messaging;
            if (messagingInstance) {
              const tokenOptions: any = {
                vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY || "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M"
              };
              if (reg) tokenOptions.serviceWorkerRegistration = reg;

              const token = await getToken(messagingInstance, tokenOptions).catch((tokenErr) => {
                console.warn("FCM getToken catch:", tokenErr);
                return null;
              });

              if (token) {
                const activeRole = localStorage.getItem("circlek_role") || "manager";
                const emailStr = currentUserObj?.email || user?.email || "user@ckk.com";
                const activeBranch = localStorage.getItem("circlek_current_branch") || "alamein4";
                const storeIds = [activeBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"];

                const uid = currentUserObj?.uid || user?.uid;
                if (uid) {
                  await dbService.setDoc("user_tokens", uid, {
                    fcmToken: token,
                    tokens: [token],
                    email: emailStr,
                    role: activeRole,
                    branchId: activeBranch,
                    storeIds,
                    updatedAt: new Date().toISOString()
                  });

                  await dbService.updateDoc("users", uid, {
                    fcmToken: token,
                    fcmTokens: [token],
                    branchId: activeBranch
                  }).catch(() => {});
                }
              }
            }
          }
        }
      } else {
        toast.error(language === "ar" ? "لم يتم منح إذن الإشعارات" : "Notification permission was not granted.");
      }
    } catch (err: any) {
      console.error("FCM Token generation error:", err);
      toast.error(language === "ar" ? "حدث خطأ أثناء طلب تفعيل الإشعارات" : "Failed to request notification permission.");
    }
  };

  useEffect(() => {
    const handleOpenWelcome = () => setShowWelcomeModal(true);
    window.addEventListener("open_welcome_modal", handleOpenWelcome);
    return () => window.removeEventListener("open_welcome_modal", handleOpenWelcome);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Clean up legacy stale service workers and corrupted caches once
      if (!localStorage.getItem("anh_sw_cleaned_v2")) {
        localStorage.setItem("anh_sw_cleaned_v2", "true");
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => {
              if (name.includes("circlek-pwa") || name.includes("workbox")) {
                caches.delete(name).catch(() => {});
              }
            });
          }).catch(() => {});
        }
      }
      if ("Notification" in window) {
        if (Notification.permission !== "granted") {
          setPushPermissionNeeded(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("circlek_theme", "dark");
    setTheme("dark");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "dark";

    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);

    // Safety fallback: give Firebase ample time to read from IndexedDB on refresh
    const safetyTimeout = setTimeout(() => {
      setAuthLoading(false);
    }, 5000);
    const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 30000);
    setCurrentDateTime(new Date());

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimeout);
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        if (typeof window !== "undefined") {
          localStorage.setItem("circlek_logged_in", "true");
          if (currentUser.email) {
            localStorage.setItem("circlek_user_email", currentUser.email);
          }
        }
        if (!localStorage.getItem("has_seen_welcome_anh_v2")) {
          setShowWelcomeModal(true);
        }
        (async () => {
        try {
          let userDocData: any = null;

          const docSnapByUid = await getDoc(doc(db, "users", currentUser.uid));
          if (docSnapByUid.exists()) {
            userDocData = docSnapByUid.data();
          } else if (currentUser.email) {
            const emailKey = currentUser.email.toLowerCase().replace(/[@.]/g, "_");
            const docSnapByEmailKey = await getDoc(doc(db, "users", emailKey));
            if (docSnapByEmailKey.exists()) {
              userDocData = docSnapByEmailKey.data();
            } else {
              const qEmail = query(collection(db, "users"), where("email", "==", currentUser.email.toLowerCase()));
              const emailSnap = await getDocs(qEmail);
              if (!emailSnap.empty) {
                userDocData = emailSnap.docs[0].data();
              }
            }
          }

          if (userDocData) {
            const mName = userDocData.displayName || userDocData.name || userDocData.features?.displayName || currentUser.displayName || currentUser.email?.split("@")[0] || "Manager";
            const userRoleResolved = userDocData.role || userDocData.features?.role || storedRole || "manager";

            const normalizedUserDoc = {
              ...userDocData,
              displayName: mName,
              role: userRoleResolved
            };

            setUserDoc(normalizedUserDoc);
            if (typeof window !== "undefined") {
              localStorage.setItem("circlek_cached_user_doc", JSON.stringify(normalizedUserDoc));
            }

            if (currentUser && mName && (!currentUser.displayName || currentUser.displayName !== mName)) {
              updateProfile(currentUser, { displayName: mName }).catch(console.warn);
            }

            if (currentUser.uid && typeof window !== "undefined" && !sessionStorage.getItem(`user_doc_synced_${currentUser.uid}`)) {
              sessionStorage.setItem(`user_doc_synced_${currentUser.uid}`, "true");
              setDoc(doc(db, "users", currentUser.uid), {
                ...normalizedUserDoc,
                updatedAt: new Date().toISOString()
              }, { merge: true }).catch(console.warn);
            }

            localStorage.setItem("circlek_user_name", mName);
            window.dispatchEvent(new CustomEvent("circlek_user_changed", { detail: mName }));

            setRole(userRoleResolved);
            localStorage.setItem("circlek_role", userRoleResolved);
            window.dispatchEvent(new CustomEvent("circlek_role_changed", { detail: userRoleResolved }));

            if (typeof window !== "undefined" && !sessionStorage.getItem(`signin_logged_${currentUser.uid}`)) {
              sessionStorage.setItem(`signin_logged_${currentUser.uid}`, "true");
              dbService.logAction(
                currentUser.email || "Unknown",
                mName,
                userRoleResolved,
                "User Sign-In",
                "N/A",
                `Signed in to platform (${userRoleResolved})`
              ).catch(() => {});
            }

            // Register device session for admin device tracking
            if (typeof window !== "undefined") {
              try {
                const ua = navigator.userAgent;
                let browser = "Unknown";
                let os = "Unknown";
                let deviceType = "desktop";

                // Parse browser
                if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
                else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
                else if (ua.includes("Firefox")) browser = "Firefox";
                else if (ua.includes("Edg")) browser = "Edge";
                else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

                // Parse OS
                if (ua.includes("Windows")) os = "Windows";
                else if (ua.includes("Mac OS")) os = "macOS";
                else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
                else if (ua.includes("Android")) os = "Android";
                else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

                // Parse device type
                if (/Mobi|Android.*Mobile|iPhone/.test(ua)) deviceType = "mobile";
                else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) deviceType = "tablet";

                // Generate unique session ID per tab (stored in sessionStorage)
                let sessionId = sessionStorage.getItem("device_session_id");
                if (!sessionId) {
                  sessionId = `${currentUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  sessionStorage.setItem("device_session_id", sessionId);
                  sessionStorage.setItem("device_login_time", new Date().toISOString());
                }

                setDoc(doc(db, "active_sessions", sessionId), {
                  userId: currentUser.uid,
                  userEmail: currentUser.email || "",
                  userName: mName,
                  role: userRoleResolved,
                  browser,
                  os,
                  deviceType,
                  loginAt: new Date().toISOString(),
                  lastActiveAt: new Date().toISOString(),
                  forceLogout: false
                }, { merge: true }).catch(console.warn);
              } catch (sessionErr) {
                console.warn("Session registration failed:", sessionErr);
              }
            }

            const rawStoreIds: any[] = [];
            if (Array.isArray(userDocData.storeIds)) rawStoreIds.push(...userDocData.storeIds);
            if (Array.isArray(userDocData.features?.storeIds)) rawStoreIds.push(...userDocData.features.storeIds);
            if (userDocData.storeId) rawStoreIds.push(userDocData.storeId);
            if (userDocData.branchId) rawStoreIds.push(userDocData.branchId);
            if (userDocData.features?.storeId) rawStoreIds.push(userDocData.features.storeId);
            if (userDocData.features?.branchId) rawStoreIds.push(userDocData.features.branchId);

            const mappedBranches: { id: BranchId; name: string }[] = [];
            const storeStrings = rawStoreIds.map((s) => String(s).toLowerCase());

            const hasAlamein = storeStrings.some((s) => s.includes("alamein") || s.includes("4"));
            const hasOla = storeStrings.some((s) => s.includes("ola") || s.includes("koronfol"));

            if (hasAlamein) {
              mappedBranches.push({ id: "alamein4", name: "El Alamein 4" });
            }
            if (hasOla) {
              mappedBranches.push({ id: "ola", name: "Ola El Koronfol" });
            }

            if (userRoleResolved === "manager") {
              if (mappedBranches.length > 0) {
                setAvailableBranches(mappedBranches);
                setBranch(mappedBranches[0].id, mappedBranches);
              }
            } else {
              setAvailableBranches(BRANCHES);
              if (mappedBranches.length > 0) {
                setBranch(mappedBranches[0].id, BRANCHES);
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch user doc:", err);
        }

        registerFcmPushToken(currentUser);

        if (typeof window !== "undefined") {
          const hasSeenWelcome = sessionStorage.getItem("circlek_welcomed");
          if (!hasSeenWelcome) {
            toast.success(`Welcome back, ${currentUser.displayName || currentUser.email?.split('@')[0]}! 👋`, { duration: 4000 });
            sessionStorage.setItem("circlek_welcomed", "true");
          }
        }
        })().catch(console.warn);
      } else {
        setUserDoc(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("circlek_logged_in");
          localStorage.removeItem("circlek_user_email");
        }
      }
    });

    // Real-Time Live Notification Listener for Mobile Manager
    let isFirstLoad = true;
    const notifQuery = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(5));
    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      if (isFirstLoad) {
        isFirstLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const activeRole = localStorage.getItem("circlek_role") || "manager";

          // If manager role, strictly check if notification belongs to their active branch
          if (activeRole === "manager") {
            const notifBranchId = (data.branchId || data.storeId || "").toLowerCase();
            const notifNorm = (notifBranchId.includes("ola") || notifBranchId.includes("koronfol")) ? "ola" : "alamein4";
            if (notifNorm !== currentBranchRef.current) {
              return; // Suppress notification from another branch for manager
            }
          }

          const notifTitle = data.title || "Circle K Alert";
          const notifBody = data.body || data.message || "New activity logged in store.";

          // Play Category-Specific Audio Chime
          try {
            audioChimes.playByType(data.type);
          } catch (e) {}

          triggerHapticFeedback([100, 50, 100]);

          // Toast Alert inside Manager Portal
          toast.success(`${notifTitle}: ${notifBody}`, { duration: 5000 });

          // Update PWA App Badge
          updateAppBadge(1);
        }
      });
    }, (err) => {
      console.debug("Firestore notification listener error:", err);
    });

    // Global Sound Effects
    const playClick = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch (e) { }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('.cursor-pointer')) {
        playClick();
      }
    };
    window.addEventListener('click', handleClick);

    return () => {
      unsubscribe();
      if (typeof unsubNotifs === "function") unsubNotifs();
      clearTimeout(safetyTimeout);
      window.removeEventListener('click', handleClick);
      clearInterval(clockTimer);
    };
  }, []);

  // Helper for friendly page name
  const getFriendlyPageTitle = (path: string): string => {
    if (path === "/" || path === "/dashboard") return "Dashboard Overview";
    if (path.includes("/financials/inputs/deposits")) return "Deposits Input";
    if (path.includes("/financials/inputs/sales")) return "Sales Input";
    if (path.includes("/financials/inputs/payments")) return "Payments Input";
    if (path.includes("/financials/inputs/credits")) return "Credits Input";
    if (path.includes("/financials/inputs/cheques")) return "Cheques Input";
    if (path.includes("/financials/inputs/tmt-invoices")) return "TMT Invoices";
    if (path.includes("/financials/inputs/safe-report")) return "Safe Report";
    if (path.includes("/financials/inputs")) return "Financial Inputs";
    if (path.includes("/financial-reports/month-summary")) return "Month Summary Report";
    if (path.includes("/financial-reports/pnl")) return "P&L Statement";
    if (path.includes("/financial-reports/expenses")) return "Expenses Report";
    if (path.includes("/financial-reports/sales-and-credits")) return "Sales & Credits";
    if (path.includes("/financial-reports/vendor-statements")) return "Vendor Statements";
    if (path.includes("/financial-reports/end-shift-cash")) return "End Shift Cash";
    if (path.includes("/financial-reports")) return "Financial Reports";
    if (path.includes("/financials/detailed-sales")) return "Detailed Sales Analysis";
    if (path.includes("/financials/out-of-stock")) return "Out of Stock Log";
    if (path.includes("/shift-reports/manager")) return "Shift Reports Audit";
    if (path.includes("/shift-reports/cashier")) return "Cashier Shift Entry";
    if (path.includes("/voids/manager")) return "Voids & Returns Manager";
    if (path.includes("/voids/cashier")) return "Cashier Voids Request";
    if (path.includes("/admin/devices")) return "Device Sessions & Control";
    if (path.includes("/admin/users")) return "User Management";
    if (path.includes("/admin/schedule")) return "Smart Scheduler";
    if (path.includes("/admin/payroll")) return "Payroll System";
    if (path.includes("/admin/adjustments")) return "Adjustments & Loans";
    if (path.includes("/admin/cleaning")) return "Cleaning Logs";
    if (path.includes("/admin/lost-and-found")) return "Lost & Found";
    if (path.includes("/admin/offers")) return "Offers Management";
    if (path.includes("/admin/food-codes")) return "Food Codes";
    if (path.includes("/admin/inventory-predict")) return "Inventory Predict";
    if (path.includes("/admin/send-document")) return "Dispatch Document";
    if (path.includes("/admin/import-csv")) return "Data Import";
    if (path.includes("/products/expiries-audit")) return "Expiries Audit";
    if (path.includes("/products/supplier-orders")) return "Supplier Orders";
    if (path.includes("/products/product-lookup") || path.includes("/admin/product-lookup")) return "Product Lookup";
    if (path.includes("/checklists/manager")) return "Manager Checklists";
    if (path.includes("/checklists/cashier")) return "Cashier Checklists";
    if (path.includes("/hr/employees")) return "HR Employees";
    if (path.includes("/ai-assistant")) return "Ibrahim AI Assistant";
    if (path.includes("/settings/audit-log")) return "Security Audit Log";
    if (path.includes("/settings/notifications")) return "Notification Settings";
    if (path.includes("/settings/cashiers")) return "Cashier Accounts";
    if (path.includes("/cashier")) return "Cashier Terminal";
    return path;
  };

  // Real-time live page & PWA status sync
  useEffect(() => {
    if (!user) return;
    const sessionId = typeof window !== "undefined" ? sessionStorage.getItem("device_session_id") : null;
    if (!sessionId) return;

    const isStandalone = typeof window !== "undefined" && (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );

    setDoc(doc(db, "active_sessions", sessionId), {
      currentPath: pathname,
      pageLabel: getFriendlyPageTitle(pathname),
      isPwa: isStandalone,
      screenSize: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "Unknown",
      lastActiveAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});
  }, [pathname, user]);

  // Device session heartbeat, remote message & force-logout listener
  useEffect(() => {
    if (!user) return;

    const sessionId = typeof window !== "undefined" ? sessionStorage.getItem("device_session_id") : null;
    const loginTime = typeof window !== "undefined" ? (sessionStorage.getItem("device_login_time") || new Date().toISOString()) : new Date().toISOString();

    let hasLoadedSessionDoc = false;
    let isTerminating = false;
    let lastSeenMsgId = "";
    let lastSeenCommandId = "";

    const triggerClientLogout = async (reason?: string) => {
      if (isTerminating) return;
      isTerminating = true;
      console.log("Remote force logout triggered:", reason);

      try {
        toast.error(language === "ar" ? "تم تسجيل خروجك عن بُعد بواسطة المسؤول" : "You have been logged out remotely by an administrator.", { duration: 8000 });
      } catch (e) {}

      if (sessionId) {
        deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
        sessionStorage.removeItem("device_session_id");
      }
      sessionStorage.removeItem("device_login_time");
      sessionStorage.removeItem("circlek_welcomed");
      localStorage.removeItem("circlek_logged_in");
      localStorage.removeItem("circlek_user_email");
      localStorage.removeItem("circlek_user_name");
      localStorage.removeItem("circlek_role");
      sessionStorage.clear();

      try {
        await signOut(auth);
      } catch (e) {}
      setUser(null);
      setUserDoc(null);
      setAuthLoading(false);

      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    };

    // 1. Listen to active_sessions/{sessionId}
    let unsubSession: (() => void) | null = null;
    if (sessionId) {
      unsubSession = onSnapshot(doc(db, "active_sessions", sessionId), (snap) => {
        if (snap.exists()) {
          hasLoadedSessionDoc = true;
          const data = snap.data();

          // Check Force Logout
          if (data.forceLogout === true) {
            triggerClientLogout("forceLogout flag is true");
            return;
          }

          // Check Remote Screen Lock / Kiosk Lockdown
          if (data.isLocked === true) {
            setIsLocked(true);
            setLockPin(data.lockPin || "1234");
            setLockReason(data.lockReason || "Terminal secured remotely by Administration");
            setLockedAt(data.lockedAt);
          } else {
            setIsLocked(false);
          }

          // Check Remote Instant Broadcast Message
          if (data.remoteMessage && data.remoteMessage.id && data.remoteMessage.id !== lastSeenMsgId) {
            lastSeenMsgId = data.remoteMessage.id;
            setIncomingRemoteMessage(data.remoteMessage);
            try {
              audioChimes.playPingSound();
            } catch (e) {}
            triggerHapticFeedback([200, 100, 200, 100, 300]);
          } else if (!data.remoteMessage) {
            setIncomingRemoteMessage(null);
          }

          // Check Remote Command: Capture Screen Snapshot
          if (data.remoteCommand && data.remoteCommand.action === "capture_screen" && data.remoteCommand.commandId !== lastSeenCommandId) {
            lastSeenCommandId = data.remoteCommand.commandId;
            const cmdId = data.remoteCommand.commandId;
            (async () => {
              let imageBase64: string | null = null;
              let captureError = "";

              try {
                // 1. Primary: html-to-image (works with modern Tailwind v4, oklch, and WebKit/Safari)
                const { toJpeg } = await import("html-to-image");
                const targetNode = document.body;
                imageBase64 = await toJpeg(targetNode, {
                  quality: 0.65,
                  pixelRatio: 0.7,
                  cacheBust: true,
                  backgroundColor: "#09090b",
                  filter: (node: any) => {
                    if (node?.classList && node.classList.contains("no-print")) return false;
                    return true;
                  }
                });
              } catch (err: any) {
                console.warn("Primary html-to-image failed, trying fallback:", err);
                captureError = err?.message || "html-to-image failed";

                // 2. Fallback: html2canvas
                try {
                  const html2canvas = (await import("html2canvas")).default;
                  const canvas = await html2canvas(document.body, {
                    scale: 0.5,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                  });
                  imageBase64 = canvas.toDataURL("image/jpeg", 0.5);
                  captureError = "";
                } catch (err2: any) {
                  console.error("Secondary canvas capture failed:", err2);
                  captureError = err2?.message || "Canvas capture failed";
                }
              }

              // Always write response back so admin UI is never stuck on loading
              await setDoc(doc(db, "active_sessions", sessionId), {
                screenSnapshot: {
                  imageBase64: imageBase64 || null,
                  capturedAt: new Date().toISOString(),
                  currentPath: pathname,
                  pageLabel: getFriendlyPageTitle(pathname),
                  requestId: cmdId,
                  error: captureError || null
                }
              }, { merge: true }).catch(console.error);
            })();
          }

          // Check Remote Command (e.g. reload app)
          if (data.remoteCommand && data.remoteCommand.action === "reload" && data.remoteCommand.commandId !== lastSeenCommandId) {
            lastSeenCommandId = data.remoteCommand.commandId;
            toast.loading(language === "ar" ? "جاري تحديث التطبيق عن بُعد..." : "Reloading application (remote command)...", { duration: 2000 });
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }

          // Check Remote Command: Navigate / Teleport
          if (data.remoteCommand && data.remoteCommand.action === "navigate" && data.remoteCommand.commandId !== lastSeenCommandId) {
            lastSeenCommandId = data.remoteCommand.commandId;
            const targetPath = data.remoteCommand.targetPath;
            const pageName = data.remoteCommand.pageLabel || targetPath;
            toast.success(`🔀 Teleported to ${pageName} by Administrator`, { duration: 4500 });
            try {
              audioChimes.playShiftAuditSound();
            } catch (e) {}
            if (targetPath) {
              router.push(targetPath);
            }
          }

          // Check Remote Command: Clear Cache & Storage
          if (data.remoteCommand && data.remoteCommand.action === "clear_cache" && data.remoteCommand.commandId !== lastSeenCommandId) {
            lastSeenCommandId = data.remoteCommand.commandId;
            toast.loading("Clearing application offline cache & reloading...", { duration: 2500 });
            try {
              if ("caches" in window) {
                caches.keys().then((names) => {
                  names.forEach((name) => caches.delete(name));
                });
              }
              if (navigator.serviceWorker) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                  for (const registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            } catch (e) {}
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          }
        } else if (hasLoadedSessionDoc) {
          // Document was removed/deleted by admin
          triggerClientLogout("session document deleted");
        }
      }, (err) => {
        console.debug("Force-logout listener error:", err);
      });
    }

    // 2. Listen to users/{userId} for account deactivation or global forceLogoutAt
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.isActive === false) {
          triggerClientLogout("Account deactivated");
        } else if (data.forceLogoutAt) {
          const forceTime = new Date(data.forceLogoutAt).getTime();
          const currentLoginTime = new Date(loginTime).getTime();
          // If forceLogoutAt occurred after or right around this session's login
          if (forceTime >= currentLoginTime - 10000) {
            triggerClientLogout("Global force logout for user");
          }
        }
      }
    }, (err) => {
      console.debug("User doc listener error:", err);
    });

    // Battery Status Telemetry
    if (typeof navigator !== "undefined" && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          if (!sessionId) return;
          setDoc(doc(db, "active_sessions", sessionId), {
            batteryLevel: Math.round(battery.level * 100),
            isCharging: battery.charging,
            hasBattery: true
          }, { merge: true }).catch(() => {});
        };
        updateBattery();
        battery.addEventListener("levelchange", updateBattery);
        battery.addEventListener("chargingchange", updateBattery);
      }).catch(() => {});
    }

    // Online/Offline & Heartbeat Lifecycle
    const sendPresence = (online: boolean) => {
      if (!sessionId) return;
      setDoc(doc(db, "active_sessions", sessionId), {
        isOnline: online,
        lastActiveAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    };

    // Mark online immediately upon load
    sendPresence(true);

    // Heartbeat every 20 seconds
    const heartbeat = setInterval(() => {
      const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";
      sendPresence(isVisible);
    }, 20000);

    const handleVisibility = () => {
      sendPresence(document.visibilityState === "visible");
    };

    const handleOffline = () => {
      sendPresence(false);
    };

    const handleOnline = () => {
      sendPresence(true);
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleOffline);
    window.addEventListener("beforeunload", handleOffline);
    window.addEventListener("pageshow", handleOnline);
    window.addEventListener("focus", handleOnline);

    // Also update lastActiveAt on user interactions (throttled)
    let lastActivityUpdate = Date.now();
    const handleActivity = () => {
      if (!sessionId) return;
      const now = Date.now();
      if (now - lastActivityUpdate > 25000) {
        lastActivityUpdate = now;
        sendPresence(true);
      }
    };
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });

    return () => {
      if (unsubSession) unsubSession();
      unsubUser();
      clearInterval(heartbeat);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleOffline);
      window.removeEventListener("beforeunload", handleOffline);
      window.removeEventListener("pageshow", handleOnline);
      window.removeEventListener("focus", handleOnline);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [user]);

  // Set up Firebase real-time listeners for notifications
  useEffect(() => {
    let unsubscribeShifts: any = null;
    let unsubscribeVoids: any = null;
    let unsubscribeExpiries: any = null;
    let unsubscribeOos: any = null;
    let unsubscribeSystemNotifs: any = null;

    if (user && currentBranch) {
      const shiftQ = currentBranch === "all"
        ? query(collection(db, "shift_reports"), where("status", "in", ["pending", "pending_manager"]), limit(50))
        : query(collection(db, "shift_reports"), where("status", "in", ["pending", "pending_manager"]), where("branchId", "==", currentBranch), limit(50));

      unsubscribeShifts = onSnapshot(shiftQ, (snap) => {
        setPendingShiftCount(snap.docs.length);
        let aged = false;
        const now = Date.now();
        snap.docs.forEach(doc => {
          const d = doc.data();
          const submittedAt = d.createdAt || d.submittedAt;
          if (submittedAt) {
            let subTime = 0;
            if (typeof submittedAt === 'object' && submittedAt.seconds) {
              subTime = submittedAt.seconds * 1000;
            } else {
              subTime = new Date(submittedAt).getTime();
            }
            if (now - subTime > 4 * 60 * 60 * 1000) {
              aged = true; // older than 4 hours
            }
          }
        });
        setHasAgedShifts(aged);
      }, (err) => console.log("Shift badge err", err));

      const voidQ = currentBranch === "all"
        ? query(collection(db, "void_requests"), where("status", "==", "pending"), limit(50))
        : query(collection(db, "void_requests"), where("status", "==", "pending"), where("branchId", "==", currentBranch), limit(50));

      unsubscribeVoids = onSnapshot(voidQ, (snap) => {
        setPendingVoidCount(snap.docs.length);
      }, (err) => console.log("Void badge err", err));

      const expiriesQ = query(collection(db, "expiries"), where("status", "==", "pulled"), limit(50));
      unsubscribeExpiries = onSnapshot(expiriesQ, (snap) => {
        let count = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (currentBranch === "all") {
            count++;
          } else {
            const inferred = (d.storeId || "").toLowerCase().includes("ola") || (d.storeId || "").toLowerCase().includes("koronfol") ? "ola" : "alamein4";
            if ((d.branchId && d.branchId === currentBranch) || (!d.branchId && inferred === currentBranch)) {
              count++;
            }
          }
        });
        setPendingExpiriesCount(count);
      }, (err) => console.log("Expiries badge err", err));

      const returnsQ = query(
        collection(db, "supplier_returns"),
        where("status", "in", ["pending", "returned"]), 
        limit(50)
      );

      const unsubscribeReturns = onSnapshot(returnsQ, (snap) => {
        let count = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          const isPending = d.status === "pending" || (d.status === "returned" && d.isSettled === false);
          if (isPending) {
            if (currentBranch === "all") {
              count++;
            } else {
              const inferred = (d.storeId || "").toLowerCase().includes("ola") || (d.storeId || "").toLowerCase().includes("koronfol") ? "ola" : "alamein4";
              if ((d.branchId && d.branchId === currentBranch) || (!d.branchId && inferred === currentBranch)) {
                count++;
              }
            }
          }
        });
        setPendingReturnsCount(count);
      }, (err) => console.log("Returns badge err", err));

      const oosQ = query(collection(db, "out_of_stock_logs"), where("resolved", "==", false), limit(50));
      unsubscribeOos = onSnapshot(oosQ, (snap) => {
        let count = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (currentBranch === "all") {
            count++;
          } else {
            const inferred = (d.branchId || "alamein4").toLowerCase();
            if (inferred === currentBranch) count++;
          }
        });
        setPendingOosCount(count);
      }, (err) => console.log("OOS badge err", err));

      const notifQ = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(50));

      unsubscribeSystemNotifs = onSnapshot(notifQ, (snap) => {
        let notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        if (currentBranch !== "all") {
          notifs = notifs.filter((n: any) => {
            const sId = (n.storeId || n.branchId || "").toLowerCase();
            const inferred = sId.includes("ola") || sId.includes("koronfol") ? "ola" : "alamein4";
            return inferred === currentBranch;
          });
        }
        notifs = notifs.filter((n: any) => n.read === false);
        setSystemNotifications(notifs);
      }, (err) => console.log("System Notifs err", err));
    }

    return () => {
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeVoids) unsubscribeVoids();
      if (unsubscribeExpiries) unsubscribeExpiries();
      if (unsubscribeOos) unsubscribeOos();
      if (unsubscribeSystemNotifs) unsubscribeSystemNotifs();
    };
  }, [user, currentBranch]);

  useEffect(() => {
    // Dynamically inject the correct PWA manifest based on the portal
    let link = document.querySelector("link[rel~='manifest']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    const isCashierPortal = pathname?.startsWith('/cashier') || pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier') || pathname?.startsWith('/checklists/cashier') || pathname?.startsWith('/owner');
    link.href = isCashierPortal ? '/manifest-cashier.json' : '/manifest-manager.json';
  }, [pathname]);

  // Synchronize OS PWA App Icon Badge count
  useEffect(() => {
    const totalPending = pendingShiftCount + pendingVoidCount + pendingExpiriesCount;
    updateAppBadge(totalPending);
  }, [pendingShiftCount, pendingVoidCount, pendingExpiriesCount]);

  useEffect(() => {
    setTheme("dark");
    localStorage.setItem("circlek_theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  const toggleTheme = () => {
    setTheme("dark");
    localStorage.setItem("circlek_theme", "dark");
    document.documentElement.classList.add("dark");
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value;
    setRole(nextRole);
    localStorage.setItem("circlek_role", nextRole);
    // Dispatch custom event to notify components of role switch
    window.dispatchEvent(new CustomEvent("circlek_role_changed", { detail: nextRole }));
  };

  const navItems = [
    {
      name: language === "ar" ? "الرئيسية (المركز)" : "Command Center", 
      href: "/", 
      icon: LayoutDashboard 
    },
    {
      name: language === "ar" ? "إبراهيم (مساعد)" : "Ibrahim (AI)", href: "/ai-assistant", icon: Bot
    },
    {
      name: t("nav.financials"), icon: FileText, children: [
        { name: t("nav.financial_inputs"), href: "/financials/inputs", icon: Wallet },
        { name: t("nav.reports"), href: "/financial-reports", icon: FileText },
        { name: language === "ar" ? "تفاصيل المبيعات" : "Detailed Sales", href: "/financials/detailed-sales", icon: Activity },
        { name: language === "ar" ? "ملخص الشهر" : "Month Summary", href: "/financial-reports/month-summary", icon: CalendarDays },
        { name: language === "ar" ? "سجل النواقص" : "Out of Stock", href: "/financials/out-of-stock", icon: PackageMinus },
        { name: t("nav.voids_returns"), href: "/voids/manager", icon: Shield },
        { name: t("nav.shift_audit"), href: "/shift-reports/manager", icon: Shield },
        { name: t("nav.margin_strategy"), href: "/dashboard/margin-calculator", icon: Activity }
      ]
    },
    { name: t("nav.returns"), href: "/dashboard/supplier-returns", icon: Truck },
    {
      name: language === "ar" ? "المنتجات" : "Products", icon: PackageX, children: [
        { name: t("nav.expiries"), href: "/products/expiries-audit", icon: ClipboardList },
        { name: t("nav.product_lookup"), href: "/admin/product-lookup", icon: Search },
        { name: t("nav.blind_audit"), href: "/inventory-audit/manager", icon: Shield },
        { name: language === "ar" ? "طلب من المورد" : "Order with Supplier", href: "/products/supplier-orders", icon: ShoppingCart }
      ]
    },
    {
      name: language === "ar" ? "العمليات" : "Operation", icon: Briefcase, children: [
        { name: language === "ar" ? "المستندات والإيصالات الرسمية" : "Official Documents", href: "/manager/documents", icon: FileText },
        { name: t("nav.checklists"), href: "/checklists/manager", icon: ClipboardList },
        { name: language === "ar" ? "سجلات النظافة" : "Cleaning Logs", href: "/admin/cleaning", icon: Sparkles },
        { name: language === "ar" ? "المفقودات" : "Lost & Found", href: "/admin/lost-and-found", icon: Package },
        { name: language === "ar" ? "إدارة العروض" : "Manage Offers", href: "/admin/offers", icon: Tag },
        { name: language === "ar" ? "أكواد الفود" : "Food Codes", href: "/admin/food-codes", icon: Barcode }
      ]
    },
    {
      name: t("nav.hr"), icon: Users, children: [
        { name: t("nav.employees"), href: "/hr/employees", icon: Users },
        { name: t("nav.cashier_accounts"), href: "/settings/cashiers", icon: Users },
        { name: t("nav.payroll_system"), href: "/admin/payroll", icon: DollarSign },
        { name: t("nav.adjustments_loans"), href: "/admin/adjustments", icon: FileText },
        { name: t("nav.smart_scheduler"), href: "/admin/schedule", icon: CalendarDays }
      ]
    },
    {
      name: t("nav.admin"), icon: Shield, children: [
        { name: language === "ar" ? "إرسال مستند رسمي للمدير" : "Dispatch Document to Manager", href: "/admin/send-document", icon: FileText },
        { name: t("nav.user_management"), href: "/admin/users", icon: Shield },
        { name: t("nav.inventory_predict"), href: "/admin/inventory-predict", icon: Database },
        { name: t("nav.send_notifications"), href: "/settings/notifications", icon: Bell },
        { name: t("nav.security_audit_log"), href: "/settings/audit-log", icon: Shield },
        { name: language === "ar" ? "الأجهزة المتصلة" : "Device Sessions", href: "/admin/devices", icon: Monitor },
        { name: t("nav.data_import"), href: "/admin/import-csv", icon: Database }
      ]
    },


    { name: "", href: "/cashier", icon: User, isIconOnly: true }
  ].filter(item => {
    const isManager = userDoc?.role === "manager" || role === "manager";
    if (isManager && item.name === t("nav.admin")) {
      return false;
    }
    return true;
  });

  const handleEnterpriseLogin = async (identifier: string, pass: string, remember: boolean) => {
    setAuthError("");
    const trimmedId = identifier.trim();
    const cleanLower = trimmedId.toLowerCase();

    // Construct candidate emails to try
    const candidates: string[] = [];
    if (trimmedId.includes("@")) {
      candidates.push(trimmedId);
      if (trimmedId !== cleanLower) candidates.push(cleanLower);
      candidates.push(trimmedId.replace(/\s+/g, ''));
      candidates.push(cleanLower.replace(/\s+/g, ''));
    } else {
      // In this system, user accounts are registered with @ck.com, @circlek.com, and @ckk.com
      candidates.push(`${cleanLower}@ck.com`);
      candidates.push(`${cleanLower}@circlek.com`);
      candidates.push(`${cleanLower}@ckk.com`);

      // Known corporate domain accounts for shorthand usernames
      if (cleanLower.includes("youssef") || cleanLower.includes("halawany")) {
        candidates.push("youssef.elhalawany@gaf.ac");
        candidates.push("youssef@ck.com");
      }
      if (cleanLower.includes("mahmoud") || cleanLower.includes("ezzat")) {
        candidates.push("mahmoud.ezzat_2000@icloud.com");
        candidates.push("mahmoud@ck.com");
      }
      if (cleanLower.includes("yassin")) {
        candidates.push("yassinelhalawany17@gmail.com");
      }
      if (cleanLower.includes("mohamed")) {
        candidates.push("mohamedyehia@gmail.com");
        candidates.push("mohamed@ck.com");
      }
      if (cleanLower.includes("admin")) {
        candidates.push("admin@ck.com");
        candidates.push("admin@ckk.com");
        candidates.push("admin.editor@corp.com");
      }
      if (cleanLower.includes("alamein")) {
        candidates.push("alamein4@ck.com");
      }
      if (cleanLower.includes("aosman")) {
        candidates.push("aosman.nys@gmail.com");
        candidates.push("aosman@ahlimo.net");
      }
      candidates.push(trimmedId);
    }

    const uniqueCandidates = Array.from(new Set(candidates));

    let lastError: any = null;
    for (const emailToTry of uniqueCandidates) {
      try {
        if (typeof window !== "undefined") {
          await setPersistence(auth, indexedDBLocalPersistence).catch(() => {
            return setPersistence(auth, browserLocalPersistence);
          }).catch(() => {});
        }
        const cred = await signInWithEmailAndPassword(auth, emailToTry, pass);
        setUser(cred.user);
        setAuthLoading(false);
        if (typeof window !== "undefined") {
          localStorage.setItem("circlek_logged_in", "true");
          if (cred.user.email) {
            localStorage.setItem("circlek_user_email", cred.user.email);
          }
        }
        toast.success(language === "ar" ? "تم تسجيل الدخول بنجاح" : "Signed in successfully", { duration: 3000 });
        router.refresh();
        return;
      } catch (err: any) {
        lastError = err;
        // If exact email provided and failed with wrong password/credential, stop trying other variants
        if (trimmedId.includes("@")) {
          break;
        }
      }
    }

    const rawMsg = lastError?.message || "Failed to log in";
    setAuthError(rawMsg);
    const isInvalid = rawMsg.toLowerCase().includes("invalid-credential") || rawMsg.toLowerCase().includes("wrong-password") || rawMsg.toLowerCase().includes("user-not-found");
    toast.error(
      isInvalid
        ? (language === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة." : "Invalid username/email or password. Please verify your credentials.")
        : rawMsg,
      { duration: 5000 }
    );
    throw lastError;
  };

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      const sessionId = sessionStorage.getItem("device_session_id");
      if (sessionId) {
        deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
        sessionStorage.removeItem("device_session_id");
      }
      sessionStorage.removeItem("device_login_time");
      sessionStorage.removeItem("circlek_welcomed");
      localStorage.removeItem("circlek_logged_in");
      localStorage.removeItem("circlek_cached_user_doc");
      localStorage.removeItem("circlek_user_email");
      localStorage.removeItem("circlek_user_name");
      localStorage.removeItem("circlek_role");
      sessionStorage.clear();
    }
    try {
      await signOut(auth);
    } catch (e) {}
    setUser(null);
    setUserDoc(null);
    setAuthLoading(false);
  };

  const totalNotifications = systemNotifications.length + pendingShiftCount + pendingVoidCount + pendingExpiriesCount + pendingReturnsCount + pendingOosCount;

  // Completely isolate Cashier pages (No Enterprise Auth, No Sidebar)
  if (pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier') || pathname?.startsWith('/cashier') || pathname?.startsWith('/expiries') || pathname?.startsWith('/checklists/cashier') || pathname?.startsWith('/inventory-audit/cashier') || pathname?.startsWith('/owner')) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto custom-scrollbar bg-background text-foreground transition-colors duration-300">
        <CashierSessionGuard />
        <GlobalReminders />
        {children}
        <PwaInstallPrompt />
      </div>
    );
  }

  const isLocallyAuthenticated = typeof window !== "undefined" && (Boolean(user) || Boolean(auth?.currentUser) || localStorage.getItem("circlek_logged_in") === "true");

  if (authLoading && !isLocallyAuthenticated) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#09090B] text-foreground">
        <div className="relative h-12 w-12 rounded-full flex items-center justify-center font-black text-white text-xl bg-gradient-to-br from-red-600 to-rose-700 shadow-lg animate-pulse">
          K
        </div>
      </div>
    );
  }

  if (!user && !isLocallyAuthenticated) {
    return (
      <EnterpriseLoginScreen
        onLogin={handleEnterpriseLogin}
        authError={authError}
        clearAuthError={() => setAuthError("")}
        language={language}
        onToggleLanguage={() => setLanguage(language === "ar" ? "en" : "ar")}
        defaultIdentifier={email}
      />
    );
  }

  const handleClearAllNotifications = async () => {
    try {
      const batchPromises = systemNotifications.map(notif => 
        updateDoc(doc(db, "notifications", notif.id), { read: true })
      );
      await Promise.all(batchPromises);
      setNotificationsOpen(false);
    } catch (e) {
      console.error("Failed to clear notifications", e);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex bg-background text-foreground transition-colors duration-300 overflow-hidden print:overflow-visible print:h-auto">
      <CashierSessionGuard />
      <GlobalReminders />

      {/* Main Content Area - Full Desktop Width (No cramped left sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden print:max-h-none print:overflow-visible">
        {!pathname.startsWith('/cashier') && role !== 'cashier' && <MobileHeader />}

        {/* Global Top Header - Displayed across all sub-pages with Back-to-Hub navigation */}
        {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && pathname !== '/' && (
          <header
            className="flex-shrink-0 hidden md:flex items-center justify-between px-4 sm:px-8 z-40 print:hidden bg-card/90 backdrop-blur-xl border-b border-border transition-colors duration-300"
            style={{
              paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
              paddingBottom: '0.75rem',
              minHeight: 'calc(4rem + env(safe-area-inset-top))',
            }}
          >
            {/* Global Back to Hub Navigation Button */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                prefetch={true}
                className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600/15 via-rose-600/10 to-transparent border border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/20 text-white transition-all shadow-md hover:shadow-rose-500/20 active:scale-95 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-black text-white text-xs shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
                  CK
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowLeft className={`w-4 h-4 text-rose-400 group-hover:-translate-x-0.5 transition-transform flex-shrink-0 ${isAr ? "rotate-180" : ""}`} />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black tracking-wide text-white group-hover:text-rose-300 transition-colors whitespace-nowrap">
                      {isAr ? "العودة لبوابة العمليات (Hub)" : "Back to Operations Hub"}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {isAr ? "الرئيسية وكافة الأقسام" : "All 31 Tools & Departments"}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Current Route Breadcrumb Badge */}
              <div className="hidden xl:flex items-center gap-2 text-xs font-semibold text-slate-400 px-3 py-1.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">{isAr ? "المسار:" : "Route:"}</span>
                <span className="text-rose-400 font-mono text-[11px] font-bold">{pathname}</span>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {/* Branch Switcher */}
              {availableBranches.length > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/60 border border-border text-foreground">
                  <Store className="h-3.5 w-3.5 text-rose-500" />
                  <select
                    value={currentBranch}
                    onChange={(e) => setBranch(e.target.value as BranchId)}
                    className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer outline-none text-foreground"
                  >
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-card text-foreground">{language === "ar" && b.id === "alamein4" ? "العلمين 4" : language === "ar" && b.id === "ola" ? "علا القرنفل" : b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notification Bell */}
              <NotificationBell buttonClassName="p-2 rounded-xl transition-all bg-muted/60 border border-border text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center" />

              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === "en" ? "ar" : "en")}
                className="p-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer bg-muted/60 border border-border text-muted-foreground hover:text-foreground"
              >
                <Languages className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase">{language === "en" ? "عربي" : "EN"}</span>
              </button>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer flex items-center gap-1.5"
                title={t("nav.sign_out")}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("nav.sign_out")}</span>
              </button>

            </div>
          </header>
        )}

        {/* Mobile Dropdown Menu (Only shown on small screens) */}
        {mobileMenuOpen && !pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-card border-b border-border shadow-xl z-50 flex flex-col p-4 gap-2 h-[calc(100vh-4rem)] overflow-y-auto">
            {navItems.map((item) => {
              if (item.children) {
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center px-4 py-2 text-sm font-bold text-muted-foreground uppercase tracking-widest border-b border-border mt-2">
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </div>
                    </div>
                    {item.children.map(child => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex justify-between items-center px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <child.icon className="h-4 w-4" />
                            {child.name}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href || item.name}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${isActive
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name || "Cashier Portal"}
                </Link>
              );
            })}
            <div className="border-t border-border mt-2 pt-4">
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await handleSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
              >
                <LogOut className="h-4 w-4" /> {t("nav.sign_out")}
              </button>
            </div>
          </div>
        )}

        {/* Push Notification Authorization Banner for Manager Phone / Device */}
        {pushPermissionNeeded && (
          <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white text-xs font-bold px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm no-print z-50 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{isAr ? "قم بتفعيل إشعارات الشاشة الرئيسية والقفل لمتابعة التنبيهات!" : "Enable Lock Screen Push Notifications on this Manager Phone / PWA Device!"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => registerFcmPushToken(user)}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white border border-white/30 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm transition-all cursor-pointer"
              >
                {isAr ? "تفعيل الإشعارات 🔔" : "Enable Push Notifications 🔔"}
              </button>
              <button
                onClick={() => setPushPermissionNeeded(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title={isAr ? "إغلاق" : "Dismiss"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Content - Widescreen & Expansive Alignment */}
        <main className={`flex-grow overflow-y-auto custom-scrollbar flex flex-col bg-[#070709] text-foreground ${pathname === '/' ? 'p-0' : (pathname.startsWith('/cashier') || pathname.startsWith('/owner')) ? '' : 'p-3 sm:p-6 lg:p-8'}`}>
          <div
            className={`flex-grow w-full ${pathname === '/' ? 'max-w-full p-0 m-0' : (pathname.startsWith('/cashier') || pathname.startsWith('/owner')) ? 'h-full p-0 m-0 max-w-full' : 'max-w-[1720px] mx-auto'}`}
          >
            {children}
          </div>

          {/* Footer inside scrollable area */}
          {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
            <footer className="mt-8 border-t border-border/50 py-4 text-center text-xs text-muted-foreground no-print">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>© 2026 Circle K Franchise ANH Group. All rights reserved.</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowWelcomeModal(true)}
                    className="hover:text-cyan-400 font-bold transition-colors cursor-pointer"
                  >
                    ✨ Welcome Screen
                  </button>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" /> Created by Youssef Elhalawany
                  </span>
                </div>
              </div>
            </footer>
          )}
        </main>
      </div>

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => {
          localStorage.setItem("has_seen_welcome_anh_v2", "true");
          setShowWelcomeModal(false);
        }}
        userName={userDoc?.displayName || userDoc?.name || user?.displayName || (user?.email ? user.email.split("@")[0] : "Mr. Youssef Halawany")}
        userRole={userDoc?.role || role || "Executive Administrator"}
      />

      <RemoteMessageOverlay
        message={incomingRemoteMessage}
        onAcknowledge={async (replyText?: string) => {
          const sessionId = sessionStorage.getItem("device_session_id");
          if (sessionId) {
            updateDoc(doc(db, "active_sessions", sessionId), {
              remoteMessage: null,
              acknowledgedAt: new Date().toISOString(),
              lastReply: replyText ? {
                text: replyText,
                repliedAt: new Date().toISOString(),
                repliedBy: user?.displayName || user?.email?.split('@')[0] || "User"
              } : null
            }).catch(() => {});
          }
          setIncomingRemoteMessage(null);
        }}
      />

      <RemoteLockOverlay
        isLocked={isLocked}
        lockPin={lockPin}
        lockReason={lockReason}
        lockedAt={lockedAt}
        onUnlock={async () => {
          const sessionId = sessionStorage.getItem("device_session_id");
          if (sessionId) {
            await setDoc(doc(db, "active_sessions", sessionId), {
              isLocked: false,
              unlockedAt: new Date().toISOString(),
              unlockedBy: "PIN"
            }, { merge: true }).catch(() => {});
          }
          setIsLocked(false);
        }}
      />

      <PwaInstallPrompt />
      <IdleScreensaver pendingTasksCount={pendingShiftCount + pendingVoidCount + pendingExpiriesCount + pendingReturnsCount} />

      {!pathname.startsWith('/cashier') && role !== "cashier" && (
        <ManagerBottomNav
          pendingShiftsCount={pendingShiftCount}
          pendingVoidsCount={pendingVoidCount}
          pendingExpiriesCount={pendingExpiriesCount}
        />
      )}
    </div>
  );
}
