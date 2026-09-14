"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "firebase/firestore";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Store, 
  Clock, 
  Building2, 
  Dices, 
  Search, 
  Filter, 
  Shield, 
  ShieldCheck, 
  Activity, 
  Sparkles, 
  Smartphone, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sunrise, 
  Sun, 
  Moon, 
  Zap, 
  RefreshCw, 
  LayoutGrid, 
  List,
  ChevronRight,
  UserCheck,
  Power,
  MessageSquare,
  QrCode,
  Printer,
  Share2,
  ExternalLink,
  KeyRound
} from "lucide-react";

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";

interface CashierProfile {
  id: string;
  name: string;
  storeId: string;
  pin: string;
  status?: "active" | "inactive";
  shiftType?: string;
  branchId?: string;
  employeeId?: string;
  requirePinChange?: boolean;
  resetPinToken?: string;
  resetPinRequestedAt?: string;
  pinChangedAt?: string;
  isFirstTimeSetup?: boolean;
  features?: {
    canUseMasterScanner?: boolean;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

export default function CashierManagementPage() {
  const { currentBranch, availableBranches } = useBranch();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  const isManager = useMemo(() => {
    if (typeof window === "undefined") return false;
    const role = localStorage.getItem("circlek_role");
    const email = currentUser?.email?.toLowerCase() || "";
    if (email.includes("halawany") || email.includes("admin") || email.includes("youssef")) return false;
    return role === "manager";
  }, [currentUser]);

  // Data States
  const [cashiers, setCashiers] = useState<CashierProfile[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // PIN Reveal States (map cashierId -> boolean)
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal / Drawer State for Add & Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [submitting, setSubmitting] = useState(false);

  // Badge Print Modal State
  const [selectedBadgeCashier, setSelectedBadgeCashier] = useState<CashierProfile | null>(null);

  // Post-Creation Success Modal State
  const [justSavedCashier, setJustSavedCashier] = useState<CashierProfile | null>(null);

  // Form Fields
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    branchId: "alamein4",
    storeId: "eL-alamein-4",
    pin: "",
    status: "active" as "active" | "inactive",
    shiftType: "All",
    employeeId: "",
    canUseMasterScanner: false,
    pinMode: "self_service" as "self_service" | "manual"
  });

  // Keep branch filter in sync with global branch if changed
  useEffect(() => {
    if (currentBranch !== "all") {
      setSelectedBranchFilter(currentBranch);
    }
  }, [currentBranch]);

  // Real-time Firestore Cashiers Listener
  useEffect(() => {
    const unsubCashiers = onSnapshot(collection(db, "cashiers"), (snapshot) => {
      const docs: CashierProfile[] = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as any)
      }));
      setCashiers(docs);
      setLoading(false);
    }, (err) => {
      console.error("Cashiers snapshot error:", err);
      setLoading(false);
    });

    // Real-time Active Sessions Listener (to see who is live on POS)
    const unsubSessions = onSnapshot(collection(db, "active_sessions"), (snapshot) => {
      const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setActiveSessions(sessions);
    }, (err) => {
      console.warn("Active sessions snapshot notice:", err);
    });

    // Fetch Employees list once for autofill
    const fetchEmployees = async () => {
      try {
        const snap = await getDocs(collection(db, "employees"));
        const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEmployeesList(emps.filter((e: any) => e.status === "active" || !e.status));
      } catch (e) {
        console.warn("Employees fetch notice:", e);
      }
    };
    fetchEmployees();

    return () => {
      unsubCashiers();
      unsubSessions();
    };
  }, []);

  // Compute live active status for each cashier
  const isCashierActiveOnTerminal = (cashier: CashierProfile) => {
    return activeSessions.some(
      s => (s.cashierId === cashier.id || s.userId === cashier.id || s.userName === cashier.name) && !s.forceLogout
    );
  };

  // 1-Click WhatsApp Onboarding Dispatch
  const handleShareWhatsApp = (cashier: CashierProfile) => {
    triggerHapticFeedback([15, 30]);
    playPopSound();

    // If cashier hasn't set a PIN yet, or has pending PIN setup/change, send the PIN setup link!
    if (!cashier.pin || cashier.isFirstTimeSetup || (cashier.requirePinChange && cashier.resetPinToken)) {
      handleSendPinReset(cashier);
      return;
    }

    const isOla = cashier.branchId === "ola" || cashier.storeId?.toLowerCase().includes("ola");
    const branchName = isOla ? "Circle K - Ola El Koronfol" : "Circle K - El Alamein 4";

    let shiftName = "جميع الورديات (All Shifts)";
    if (cashier.shiftType === "Morning") shiftName = "وردية صباحية (Morning Shift)";
    else if (cashier.shiftType === "Noon") shiftName = "وردية مسائية (Noon Shift)";
    else if (cashier.shiftType === "Night") shiftName = "وردية ليلية (Night Shift)";

    const lines = [
      `مرحباً ${cashier.name}،`,
      `تم تجهيز حسابك لنظام كاشير Circle K:`,
      ``,
      `🏢 الفرع: ${branchName}`,
      `🔒 الرمز السري (PIN): ${cashier.pin}`,
      `⏱️ الوردية المسموحة: ${shiftName}`,
      ``,
      `🔗 رابط تسجيل الدخول:`,
      `https://anh-zeta.vercel.app/cashier`,
      ``,
      `*يرجى الحفاظ على سرية هذا الرمز وعدم مشاركته.*`
    ];
    const message = lines.join("\n");

    // Copy to clipboard so manager has full text ready to paste in all cases
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).catch(() => {});
    }

    // Resolve employee phone if present in directory
    const selectedEmp = employeesList.find(
      emp => emp.id === cashier.employeeId || emp.name?.trim() === cashier.name?.trim()
    );
    let phoneParam = "";
    if (selectedEmp?.phone) {
      const digits = String(selectedEmp.phone).replace(/[^0-9]/g, "");
      if (digits.length >= 9) {
        const cleanPhone = digits.startsWith("20") ? digits : (digits.startsWith("0") ? "2" + digits : "20" + digits);
        phoneParam = `phone=${cleanPhone}&`;
      }
    }

    // Use direct api.whatsapp.com/send to prevent wa.me 302 redirect from mangling UTF-8 emojis/text
    const encoded = encodeURIComponent(message);
    const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success(`Opening WhatsApp & copied full credentials for ${cashier.name}!`);
  };

  // 1-Click WhatsApp PIN Setup / Reset Request Dispatch
  const handleSendPinReset = async (cashier: CashierProfile) => {
    triggerHapticFeedback([20, 35]);
    playPopSound();

    const isFirstTime = Boolean(cashier.isFirstTimeSetup || !cashier.pin);
    const toastId = toast.loading(
      isFirstTime 
        ? `Generating first-time PIN setup link for ${cashier.name}...` 
        : `Generating secure PIN reset link for ${cashier.name}...`
    );

    try {
      // 1. Generate unique alphanumeric token
      const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const nowIso = new Date().toISOString();

      // 2. Update cashier document in Firestore
      await updateDoc(doc(db, "cashiers", cashier.id), {
        requirePinChange: true,
        resetPinToken: token,
        resetPinRequestedAt: nowIso,
        isFirstTimeSetup: isFirstTime,
        updatedAt: nowIso
      });

      // 3. Format official bilingual WhatsApp dispatch message
      const isOla = cashier.branchId === "ola" || cashier.storeId?.toLowerCase().includes("ola");
      const branchName = isOla ? "Circle K - Ola El Koronfol" : "Circle K - El Alamein 4";
      let shiftName = "جميع الورديات (All Shifts)";
      if (cashier.shiftType === "Morning") shiftName = "وردية صباحية (Morning Shift)";
      else if (cashier.shiftType === "Noon") shiftName = "وردية مسائية (Noon Shift)";
      else if (cashier.shiftType === "Night") shiftName = "وردية ليلية (Night Shift)";

      const resetUrl = `https://anh-zeta.vercel.app/cashier/reset-pin?id=${cashier.id}&token=${token}`;

      const lines = isFirstTime ? [
        `مرحباً ${cashier.name}،`,
        `تم إنشاء وتجهيز حسابك لنظام كاشير Circle K:`,
        ``,
        `🏢 الفرع: ${branchName}`,
        `⏱️ الوردية: ${shiftName}`,
        ``,
        `🔐 يرجى تعيين الرمز السري (PIN) الخاص بك لأول مرة عبر الرابط التالي:`,
        `${resetUrl}`,
        ``,
        `يرجى الضغط على الرابط واختيار 4 أرقام لتسجيل الدخول للورديات.`,
        `*الرابط صالح ومخصص لحسابك فقط - يرجى عدم مشاركته.*`
      ] : [
        `مرحباً ${cashier.name}،`,
        `طلبت إدارة Circle K منك تعيين رمز سري جديد (PIN) لحسابك:`,
        ``,
        `🏢 الفرع: ${branchName}`,
        `🔐 رابط تعيين الرمز السري الجديد:`,
        `${resetUrl}`,
        ``,
        `يرجى الضغط على الرابط وتعيين رمزك السري المكون من 4 أرقام.`,
        `*الرابط صالح ومخصص لحسابك فقط - يرجى عدم مشاركته.*`
      ];
      const message = lines.join("\n");

      // 4. Copy to clipboard
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).catch(() => {});
      }

      // 5. Check if employee has phone number
      const selectedEmp = employeesList.find(
        emp => emp.id === cashier.employeeId || emp.name?.trim() === cashier.name?.trim()
      );
      let phoneParam = "";
      if (selectedEmp?.phone) {
        const digits = String(selectedEmp.phone).replace(/[^0-9]/g, "");
        if (digits.length >= 9) {
          const cleanPhone = digits.startsWith("20") ? digits : (digits.startsWith("0") ? "2" + digits : "20" + digits);
          phoneParam = `phone=${cleanPhone}&`;
        }
      }

      // 6. Open WhatsApp
      const encoded = encodeURIComponent(message);
      const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encoded}`;
      window.open(waUrl, "_blank");

      toast.dismiss(toastId);
      toast.success(
        isFirstTime 
          ? `First-time PIN setup link created & WhatsApp opened for ${cashier.name}!` 
          : `PIN reset link created & WhatsApp opened for ${cashier.name}!`
      );
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to generate PIN setup link: ${err.message || "Unknown error"}`);
    }
  };

  // Unique PIN Generator
  const generateUniquePin = () => {
    triggerHapticFeedback([10, 20]);
    playPopSound();
    let newPin = "";
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 100) {
      newPin = Math.floor(1000 + Math.random() * 9000).toString();
      isUnique = !cashiers.some(c => c.pin === newPin && c.id !== editTargetId);
      attempts++;
    }
    setFormData(prev => ({ ...prev, pin: newPin }));
    toast.success(`Generated Secure PIN: ${newPin}`);
  };

  // Toggle PIN visibility
  const togglePinReveal = (cashierId: string) => {
    triggerHapticFeedback(10);
    setRevealedPins(prev => {
      const next = { ...prev, [cashierId]: !prev[cashierId] };
      // Auto-hide after 8 seconds for security
      if (next[cashierId]) {
        setTimeout(() => {
          setRevealedPins(p => ({ ...p, [cashierId]: false }));
        }, 8000);
      }
      return next;
    });
  };

  // Copy PIN to clipboard
  const handleCopyPin = (pinValue: string, cashierId: string) => {
    navigator.clipboard.writeText(pinValue);
    setCopiedId(cashierId);
    triggerHapticFeedback(15);
    playPopSound();
    toast.success(`PIN ${pinValue} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Modal for New Cashier
  const handleOpenAddModal = () => {
    if (isManager) {
      toast.error("Managers are not authorized to create cashier accounts.");
      return;
    }
    triggerHapticFeedback(10);
    playPopSound();
    setModalMode("add");
    setEditTargetId(null);
    const initialBranch = currentBranch !== "all" ? currentBranch : "alamein4";
    setFormData({
      name: "",
      branchId: initialBranch,
      storeId: initialBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4",
      pin: "",
      status: "active",
      shiftType: "All",
      employeeId: "",
      canUseMasterScanner: true,
      pinMode: "self_service"
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit Cashier
  const handleOpenEditModal = (cashier: CashierProfile) => {
    if (isManager) {
      toast.error("Managers are not authorized to edit cashier credentials.");
      return;
    }
    triggerHapticFeedback(10);
    playPopSound();
    setModalMode("edit");
    setEditTargetId(cashier.id);
    setFormData({
      name: cashier.name || "",
      branchId: cashier.branchId || (cashier.storeId?.includes("ola") ? "ola" : "alamein4"),
      storeId: cashier.storeId || "eL-alamein-4",
      pin: cashier.pin || "",
      status: cashier.status || "active",
      shiftType: cashier.shiftType || "All",
      employeeId: cashier.employeeId || "",
      canUseMasterScanner: Boolean(cashier.features?.canUseMasterScanner),
      pinMode: "manual"
    });
    setIsModalOpen(true);
  };

  // Form Submission
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isManager) {
      toast.error("Permission denied.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter the cashier's full name.");
      return;
    }

    const isSelfService = modalMode === "add" && formData.pinMode === "self_service";

    if (!isSelfService) {
      if (!formData.pin || formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
        toast.error("PIN must be exactly 4 numeric digits.");
        return;
      }

      // Check PIN uniqueness
      const duplicatePin = cashiers.find(c => c.pin === formData.pin && c.id !== editTargetId);
      if (duplicatePin) {
        toast.error(`PIN ${formData.pin} is already assigned to ${duplicatePin.name}. Please roll a unique PIN.`);
        return;
      }
    }

    setSubmitting(true);
    triggerHapticFeedback([15, 30]);

    try {
      const selectedEmp = employeesList.find(emp => emp.name === formData.name);
      const resolvedEmpId = selectedEmp ? selectedEmp.id : formData.employeeId;
      const nameSlug = formData.name.trim().toLowerCase().replace(/\s+/g, "_");
      const nowIso = new Date().toISOString();
      const setupToken = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

      const payload: any = {
        name: formData.name.trim(),
        branchId: formData.branchId,
        storeId: formData.storeId.trim(),
        status: formData.status || "active",
        shiftType: formData.shiftType,
        employeeId: resolvedEmpId || "",
        features: {
          canUseMasterScanner: formData.canUseMasterScanner
        },
        updatedAt: nowIso
      };

      if (isSelfService) {
        payload.pin = "";
        payload.requirePinChange = true;
        payload.resetPinToken = setupToken;
        payload.resetPinRequestedAt = nowIso;
        payload.isFirstTimeSetup = true;
      } else {
        payload.pin = formData.pin;
      }

      let savedRecord: CashierProfile;

      if (modalMode === "edit" && editTargetId) {
        await updateDoc(doc(db, "cashiers", editTargetId), payload);
        savedRecord = { id: editTargetId, ...payload };
        // If active, purge any revoked sessions
        if (payload.status === "active") {
          await Promise.all([
            deleteDoc(doc(db, "revoked_cashier_sessions", editTargetId)).catch(() => {}),
            deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {})
          ]);
        }
        toast.success(`Updated credentials for ${formData.name}`);
      } else {
        const docRef = await addDoc(collection(db, "cashiers"), {
          ...payload,
          createdAt: nowIso
        });
        savedRecord = { id: docRef.id, ...payload };
        // Clean any old revoked session tombstones for this name and ID!
        await Promise.all([
          deleteDoc(doc(db, "revoked_cashier_sessions", docRef.id)).catch(() => {}),
          deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {})
        ]);
        toast.success(`Cashier ${formData.name} created successfully!`);
      }

      setIsModalOpen(false);
      // Open post-save dispatch prompt
      setJustSavedCashier(savedRecord);
    } catch (err: any) {
      console.error("Save cashier error:", err);
      toast.error(`Failed to save cashier: ${err.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Click Activate / Deactivate Toggle for Cashier Portal
  const handleToggleCashierStatus = async (cashier: CashierProfile) => {
    if (isManager) {
      toast.error("Managers are not authorized to modify cashier status.");
      return;
    }
    triggerHapticFeedback([20, 35]);
    playPopSound();

    const isCurrentlyActive = cashier.status !== "inactive";
    const nextStatus: "active" | "inactive" = isCurrentlyActive ? "inactive" : "active";
    const nameSlug = cashier.name.trim().toLowerCase().replace(/\s+/g, "_");

    const toastId = toast.loading(
      isCurrentlyActive 
        ? `Deactivating ${cashier.name} and revoking portal access...` 
        : `Activating ${cashier.name} and granting portal access...`
    );

    try {
      // 1. Update status in cashiers collection
      await updateDoc(doc(db, "cashiers", cashier.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });

      if (nextStatus === "inactive") {
        // Immediate remote logout signal
        await Promise.all([
          setDoc(doc(db, "revoked_cashier_sessions", cashier.id), {
            cashierId: cashier.id,
            name: cashier.name,
            revokedAt: new Date().toISOString(),
            status: "inactive",
            forceLogout: true
          }, { merge: true }).catch(() => {}),
          setDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`), {
            cashierId: cashier.id,
            name: cashier.name,
            revokedAt: new Date().toISOString(),
            status: "inactive",
            forceLogout: true
          }, { merge: true }).catch(() => {})
        ]);

        // Terminate matching active_sessions
        const sessionsSnap = await getDocs(
          query(collection(db, "active_sessions"), where("cashierId", "==", cashier.id))
        ).catch(() => null);
        if (sessionsSnap && !sessionsSnap.empty) {
          await Promise.all(sessionsSnap.docs.map(d => updateDoc(d.ref, { forceLogout: true }).catch(() => {})));
        }

        toast.dismiss(toastId);
        toast.success(`Cashier ${cashier.name} deactivated. Portal access disabled.`);
      } else {
        // Purge any revoked session records
        await Promise.all([
          deleteDoc(doc(db, "revoked_cashier_sessions", cashier.id)).catch(() => {}),
          deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {})
        ]);

        // Clean up any stale active_sessions so new session starts completely fresh
        const sessionsSnap = await getDocs(
          query(collection(db, "active_sessions"), where("cashierId", "==", cashier.id))
        ).catch(() => null);
        if (sessionsSnap && !sessionsSnap.empty) {
          await Promise.all(sessionsSnap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
        }

        toast.dismiss(toastId);
        toast.success(`Cashier ${cashier.name} activated! Ready to use cashier portal.`);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to update status: ${err.message || "Unknown error"}`);
    }
  };

  // Remote Force Logout for a single cashier
  const handleForceLogoutSession = async (cashier: CashierProfile) => {
    triggerHapticFeedback([20, 40]);
    const toastId = toast.loading(`Sending instant remote logout signal to ${cashier.name}...`);

    try {
      // 1. Write to revoked_cashier_sessions
      await setDoc(doc(db, "revoked_cashier_sessions", cashier.id), {
        cashierId: cashier.id,
        name: cashier.name,
        revokedAt: new Date().toISOString(),
        deletedBy: currentUser?.email || "admin",
        forceLogout: true
      }, { merge: true });

      if (cashier.name) {
        const nameSlug = cashier.name.trim().toLowerCase().replace(/\s+/g, "_");
        await setDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`), {
          cashierId: cashier.id,
          name: cashier.name,
          revokedAt: new Date().toISOString(),
          forceLogout: true
        }, { merge: true }).catch(() => {});
      }

      // 2. Terminate matching active_sessions
      const sessionsSnap = await getDocs(
        query(collection(db, "active_sessions"), where("cashierId", "==", cashier.id))
      );
      await Promise.all(sessionsSnap.docs.map(d => updateDoc(d.ref, { forceLogout: true })));

      toast.dismiss(toastId);
      toast.success(`Logged out all active devices for ${cashier.name}`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to force logout: ${err.message}`);
    }
  };

  // Delete Cashier & Revoke All Sessions
  const handleDeleteCashier = async (cashier: CashierProfile) => {
    if (isManager) {
      toast.error("Managers are not authorized to delete cashiers.");
      return;
    }

    triggerHapticFeedback([25, 50, 25]);
    toast.warning(`Permanently delete ${cashier.name}?`, {
      description: "This will revoke all active POS credentials and force-logout all devices immediately.",
      duration: 8000,
      action: {
        label: "Confirm Delete",
        onClick: async () => {
          const toastId = toast.loading(`Deleting ${cashier.name} and revoking credentials...`);

          try {
            // Try API first
            let apiSuccess = false;
            try {
              const token = await currentUser?.getIdToken().catch(() => null);
              const userRole = localStorage.getItem("circlek_role") || "admin";
              const queryParams = new URLSearchParams({
                id: cashier.id,
                name: cashier.name || "",
                employeeId: cashier.employeeId || ""
              });

              const res = await fetch(`/api/admin/cashiers?${queryParams.toString()}`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                  "x-user-role": userRole
                }
              });

              if (res.ok) apiSuccess = true;
            } catch (apiErr) {
              console.warn("API delete fallback to client Firestore:", apiErr);
            }

            // Direct Firestore deletion fallback
            if (!apiSuccess) {
              await setDoc(doc(db, "revoked_cashier_sessions", cashier.id), {
                cashierId: cashier.id,
                name: cashier.name,
                revokedAt: new Date().toISOString(),
                deletedBy: currentUser?.email || "admin",
                forceLogout: true
              });

              if (cashier.name) {
                const nameSlug = cashier.name.trim().toLowerCase().replace(/\s+/g, "_");
                await setDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`), {
                  cashierId: cashier.id,
                  name: cashier.name,
                  revokedAt: new Date().toISOString(),
                  forceLogout: true
                }).catch(() => {});
              }

              await deleteDoc(doc(db, "cashiers", cashier.id));
            }

            // Purge local storage if current machine is logged in as this cashier
            if (typeof window !== "undefined") {
              const currentLocal = localStorage.getItem("active_cashier_session");
              if (currentLocal) {
                try {
                  const parsed = JSON.parse(currentLocal);
                  if (parsed.id === cashier.id || parsed.name === cashier.name) {
                    localStorage.removeItem("active_cashier_session");
                    sessionStorage.removeItem("active_cashier_session");
                  }
                } catch (e) {}
              }
            }

            toast.dismiss(toastId);
            toast.success(`Removed ${cashier.name} and purged active sessions.`);
          } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(`Delete failed: ${e.message}`);
          }
        }
      }
    });
  };

  // Filtered Cashiers List
  const filteredCashiers = useMemo(() => {
    return cashiers.filter(c => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesName = c.name?.toLowerCase().includes(queryLower);
        const matchesStore = c.storeId?.toLowerCase().includes(queryLower);
        const matchesPin = c.pin?.includes(queryLower);
        if (!matchesName && !matchesStore && !matchesPin) return false;
      }

      // 2. Branch filter
      if (selectedBranchFilter !== "all") {
        if (c.branchId) {
          if (c.branchId !== selectedBranchFilter) return false;
        } else {
          const store = (c.storeId || "").toLowerCase();
          if (selectedBranchFilter === "alamein4" && !store.includes("alamein") && store.includes("ola")) return false;
          if (selectedBranchFilter === "ola" && !store.includes("ola")) return false;
        }
      }

      // 3. Shift filter
      if (selectedShiftFilter !== "all") {
        const cShift = c.shiftType || "All";
        if (cShift !== selectedShiftFilter && cShift !== "All") return false;
      }

      // 4. Status filter
      if (selectedStatusFilter !== "all") {
        const isActive = c.status !== "inactive";
        if (selectedStatusFilter === "active" && !isActive) return false;
        if (selectedStatusFilter === "inactive" && isActive) return false;
      }

      return true;
    });
  }, [cashiers, searchQuery, selectedBranchFilter, selectedShiftFilter, selectedStatusFilter]);

  // Executive Metrics
  const stats = useMemo(() => {
    const total = cashiers.length;
    const activeCount = cashiers.filter(c => c.status !== "inactive").length;
    const inactiveCount = cashiers.filter(c => c.status === "inactive").length;
    const onlineCount = cashiers.filter(c => isCashierActiveOnTerminal(c)).length;
    const scannerCount = cashiers.filter(c => Boolean(c.features?.canUseMasterScanner)).length;
    const alameinCount = cashiers.filter(c => c.branchId === "alamein4" || (c.storeId || "").toLowerCase().includes("alamein")).length;
    const olaCount = cashiers.filter(c => c.branchId === "ola" || (c.storeId || "").toLowerCase().includes("ola")).length;

    return { total, activeCount, inactiveCount, onlineCount, scannerCount, alameinCount, olaCount };
  }, [cashiers, activeSessions]);

  // Helper for Shift Styling
  const getShiftBadge = (shift?: string) => {
    switch (shift) {
      case "Morning":
        return {
          icon: <Sunrise className="w-3.5 h-3.5" />,
          label: "Morning Shift",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/25"
        };
      case "Noon":
        return {
          icon: <Sun className="w-3.5 h-3.5" />,
          label: "Noon Shift",
          color: "bg-orange-500/10 text-orange-400 border-orange-500/25"
        };
      case "Night":
        return {
          icon: <Moon className="w-3.5 h-3.5" />,
          label: "Night Shift",
          color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5" />,
          label: "All Shifts",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
        };
    }
  };

  // Helper for Branch Display Name
  const getBranchBadge = (branchId?: string, storeId?: string) => {
    const isOla = branchId === "ola" || (storeId || "").toLowerCase().includes("ola");
    return {
      name: isOla ? "Ola El Koronfol" : "El Alamein 4",
      color: isOla ? "text-purple-400 border-purple-500/20 bg-purple-500/10" : "text-cyan-400 border-cyan-500/20 bg-cyan-500/10"
    };
  };

  // Handle Badge Printing
  const handlePrintBadge = () => {
    triggerHapticFeedback([20, 30]);
    playPopSound();
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="h-16 w-1/3 bg-slate-800/60 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-800/40 animate-pulse rounded-2xl border border-white/5" />
          ))}
        </div>
        <div className="h-96 bg-slate-800/30 animate-pulse rounded-3xl border border-white/5" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 pb-28">
      
      {/* =========================================================================
          1. EXECUTIVE COMMAND HEADER
         ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#121829] via-[#0e1424] to-[#151c33] border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Circle K POS Security & Access Fleet
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Cashier Management</span>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 font-mono font-medium border border-white/10">
                {cashiers.length} Active
              </span>
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Configure front-line cashier credentials, store assignments, allowed operational shift windows, and 4-digit security PIN tokens with real-time session revocation and WhatsApp onboarding.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {!isManager && (
              <button
                onClick={handleOpenAddModal}
                className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-sm shadow-[0_0_30px_rgba(225,29,72,0.35)] hover:shadow-[0_0_40px_rgba(225,29,72,0.5)] transition-all transform active:scale-95 border border-red-400/30"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                <span>Add New Cashier</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. KPI STAT TILES
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Cashiers */}
        <div className="bg-[#0f1629]/80 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-red-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Fleet</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{stats.total}</span>
            <span className="text-xs text-slate-400">Cashiers</span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="font-semibold text-emerald-400">{stats.activeCount} Active</span>
            <span>•</span>
            <span className="font-semibold text-amber-400">{stats.inactiveCount} Deactivated</span>
          </p>
        </div>

        {/* Live on POS Terminals */}
        <div className="bg-[#0f1629]/80 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live On Register</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">{stats.onlineCount}</span>
            <span className="text-xs text-slate-400">Terminals Active</span>
          </div>
          <p className="mt-2 text-xs text-emerald-400/80 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span>Real-time POS Session Sync</span>
          </p>
        </div>

        {/* Master Scanner Privileges */}
        <div className="bg-[#0f1629]/80 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scanner Authority</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-cyan-400">{stats.scannerCount}</span>
            <span className="text-xs text-slate-400">Enabled</span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span>Special Master Barcode Lookup</span>
          </p>
        </div>

        {/* Security & 4-Digit Tokens */}
        <div className="bg-[#0f1629]/80 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Portal Security</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-400">100%</span>
            <span className="text-xs text-slate-400">Encrypted</span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Zero PIN Collisions Verified</span>
          </p>
        </div>

      </div>

      {/* =========================================================================
          3. CONTROL TOOLBAR (Search, Branch Pills, Shift Tabs, Status Filter, View Toggle)
         ========================================================================= */}
      <div className="bg-[#0e1424]/90 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Box */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cashiers by name, store, PIN..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141b30] border border-white/10 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Branch Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-[#13192c] rounded-xl border border-white/5 text-xs font-semibold">
          <button
            onClick={() => setSelectedBranchFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedBranchFilter === "all"
                ? "bg-red-600 text-white shadow-md font-bold"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            All Stores ({cashiers.length})
          </button>
          <button
            onClick={() => setSelectedBranchFilter("alamein4")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedBranchFilter === "alamein4"
                ? "bg-cyan-600 text-white shadow-md font-bold"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Alamein ({stats.alameinCount})
          </button>
          <button
            onClick={() => setSelectedBranchFilter("ola")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedBranchFilter === "ola"
                ? "bg-purple-600 text-white shadow-md font-bold"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Koronfol ({stats.olaCount})
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#13192c] p-1 rounded-xl border border-white/5 text-xs font-medium">
          <button
            onClick={() => setSelectedStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              selectedStatusFilter === "all"
                ? "bg-white/10 text-white font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedStatusFilter("active")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              selectedStatusFilter === "active"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Active ({stats.activeCount})
          </button>
          <button
            onClick={() => setSelectedStatusFilter("inactive")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              selectedStatusFilter === "inactive"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Deactivated ({stats.inactiveCount})
          </button>
        </div>

        {/* Shift Filter Pills */}
        <div className="flex items-center gap-1 bg-[#13192c] p-1 rounded-xl border border-white/5 text-xs font-medium">
          {["all", "Morning", "Noon", "Night"].map((shift) => (
            <button
              key={shift}
              onClick={() => setSelectedShiftFilter(shift)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                selectedShiftFilter === shift
                  ? "bg-white/10 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {shift === "all" ? "All Shifts" : shift}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-[#13192c] p-1 rounded-xl border border-white/5 self-end md:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-all ${
              viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Grid Card View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-lg transition-all ${
              viewMode === "table" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Executive Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* =========================================================================
          4. MAIN CASHIER FLEET PRESENTATION (Grid or Table)
         ========================================================================= */}
      {filteredCashiers.length === 0 ? (
        <div className="text-center py-20 bg-[#0d1322]/60 border border-dashed border-white/10 rounded-3xl p-8 space-y-4 backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">No cashiers matched your criteria</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {searchQuery 
              ? `No cashiers found matching "${searchQuery}". Try clearing your search query.` 
              : "There are no cashiers assigned to this store branch yet."}
          </p>
          {!isManager && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Add New Cashier
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCashiers.map((cashier) => {
            const isOnline = isCashierActiveOnTerminal(cashier);
            const shiftStyle = getShiftBadge(cashier.shiftType);
            const branchStyle = getBranchBadge(cashier.branchId, cashier.storeId);
            const isRevealed = Boolean(revealedPins[cashier.id]);
            const isCopied = copiedId === cashier.id;

            return (
              <motion.div
                key={cashier.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group relative rounded-3xl bg-gradient-to-b from-[#12182c]/90 to-[#0b101f]/95 border border-white/10 hover:border-red-500/40 p-6 shadow-xl hover:shadow-[0_15px_35px_rgba(225,29,72,0.12)] transition-all duration-300 flex flex-col justify-between backdrop-blur-xl"
              >
                {/* Subtle top accent bar */}
                <div className={`absolute top-0 left-8 right-8 h-0.5 rounded-full transition-all duration-300 ${
                  isOnline 
                    ? "bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80" 
                    : "bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-40 group-hover:opacity-100"
                }`} />

                {/* Card Body */}
                <div className="space-y-5">
                  
                  {/* Top Row: Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {/* Avatar with dynamic initials */}
                      <div className="relative">
                        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/15 flex items-center justify-center text-white font-black text-lg shadow-inner group-hover:border-red-500/50 transition-colors">
                          {cashier.name.slice(0, 2)}
                        </div>
                        {/* Status Ping */}
                        <div 
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0e1424] flex items-center justify-center ${
                            isOnline ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-slate-600"
                          }`}
                          title={isOnline ? "Active session connected on POS" : "Offline"}
                        >
                          {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-white group-hover:text-red-400 transition-colors leading-tight">
                          {cashier.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-500" />
                          <span>{cashier.storeId || "Default Register"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status Toggle & POS State */}
                    <div className="flex flex-col items-end gap-1.5">
                      {!isManager ? (
                        <button
                          type="button"
                          onClick={() => handleToggleCashierStatus(cashier)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 ${
                            cashier.status !== "inactive"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                          }`}
                          title={cashier.status !== "inactive" ? "Account Active — Click to Deactivate" : "Account Deactivated — Click to Activate"}
                        >
                          <span className={`w-2 h-2 rounded-full ${cashier.status !== "inactive" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                          <span>{cashier.status !== "inactive" ? "Active" : "Deactivated"}</span>
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          cashier.status !== "inactive"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${cashier.status !== "inactive" ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span>{cashier.status !== "inactive" ? "Active" : "Deactivated"}</span>
                        </span>
                      )}

                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400/90">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Live POS
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-500">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips: Branch & Shift & Features */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Branch Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${branchStyle.color}`}>
                      <Building2 className="w-3.5 h-3.5" />
                      {branchStyle.name}
                    </span>

                    {/* Shift Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${shiftStyle.color}`}>
                      {shiftStyle.icon}
                      {shiftStyle.label}
                    </span>

                    {/* Scanner Privilege Badge */}
                    {cashier.features?.canUseMasterScanner && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                        <Zap className="w-3.5 h-3.5" />
                        Scanner Enabled
                      </span>
                    )}
                  </div>

                  {/* Security PIN Vault Box */}
                  <div className="p-3.5 rounded-2xl bg-[#090d18]/90 border border-white/10 flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Security PIN
                          </p>
                          {cashier.requirePinChange && cashier.pin && !cashier.isFirstTimeSetup && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                              <KeyRound className="w-2.5 h-2.5" />
                              Reset Sent
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          {!cashier.pin || cashier.isFirstTimeSetup ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-xl border border-amber-500/30">
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Pending PIN Setup</span>
                            </span>
                          ) : isRevealed ? (
                            <span className="text-red-400 font-mono font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 text-base tracking-widest">
                              {cashier.pin}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono font-black select-none text-base tracking-widest">••••</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PIN Actions (Reveal & Copy) */}
                    <div className="flex items-center gap-1.5">
                      {cashier.pin && !cashier.isFirstTimeSetup ? (
                        <>
                          <button
                            onClick={() => togglePinReveal(cashier.id)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-colors"
                            title={isRevealed ? "Hide PIN" : "Reveal PIN"}
                          >
                            {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleCopyPin(cashier.pin, cashier.id)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-colors"
                            title="Copy PIN to clipboard"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSendPinReset(cashier)}
                          className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
                          title="Send WhatsApp Link for Cashier to set their PIN"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* Footer Action Buttons with WhatsApp & Badge */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 1-Click WhatsApp Dispatch */}
                    <button
                      onClick={() => handleShareWhatsApp(cashier)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold text-xs border border-emerald-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
                      title="Share credentials via WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    {/* 1-Click Send PIN Change Request */}
                    <button
                      onClick={() => handleSendPinReset(cashier)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
                      title="Send WhatsApp link for cashier to change their PIN"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset PIN</span>
                    </button>

                    {/* Printable POS QR Badge */}
                    <button
                      onClick={() => setSelectedBadgeCashier(cashier)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-bold text-xs border border-purple-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
                      title="Print POS Quick-Login Badge"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Badge</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Toggle Active / Inactive */}
                    {!isManager && (
                      <button
                        onClick={() => handleToggleCashierStatus(cashier)}
                        className={`p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                          cashier.status !== "inactive"
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                        }`}
                        title={cashier.status !== "inactive" ? "Deactivate Cashier (Revoke Portal Access)" : "Activate Cashier (Grant Portal Access)"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}

                    {/* Force Remote Logout */}
                    {isOnline && (
                      <button
                        onClick={() => handleForceLogoutSession(cashier)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
                        title="Force Remote Logout on connected POS"
                      >
                        <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                      </button>
                    )}

                    {!isManager && (
                      <button
                        onClick={() => handleOpenEditModal(cashier)}
                        className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all hover:scale-105 active:scale-95"
                        title="Edit Cashier Profile"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {!isManager && (
                      <button
                        onClick={() => handleDeleteCashier(cashier)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105 active:scale-95"
                        title="Delete Cashier Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>

      ) : (

        /* HIGH-DENSITY TABLE VIEW */
        <div className="overflow-hidden rounded-3xl bg-[#0f1527]/90 border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#141b30] text-slate-400 font-bold uppercase text-[11px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-4">Cashier Name</th>
                  <th className="p-4">Branch & Store</th>
                  <th className="p-4">Shift Window</th>
                  <th className="p-4">Security PIN</th>
                  <th className="p-4">Account Status</th>
                  <th className="p-4">POS Live</th>
                  <th className="p-4">Dispatch & Badges</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {filteredCashiers.map((cashier) => {
                  const isOnline = isCashierActiveOnTerminal(cashier);
                  const shiftStyle = getShiftBadge(cashier.shiftType);
                  const branchStyle = getBranchBadge(cashier.branchId, cashier.storeId);
                  const isRevealed = Boolean(revealedPins[cashier.id]);

                  return (
                    <tr key={cashier.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-white text-xs">
                            {cashier.name.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-white">{cashier.name}</p>
                            <p className="text-xs text-slate-400">{cashier.storeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${branchStyle.color}`}>
                          {branchStyle.name}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${shiftStyle.color}`}>
                          {shiftStyle.icon}
                          {shiftStyle.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {!cashier.pin || cashier.isFirstTimeSetup ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/30">
                              <KeyRound className="w-3 h-3" />
                              <span>Pending Setup</span>
                            </span>
                          ) : (
                            <>
                              <span className="font-mono font-bold text-slate-300">
                                {isRevealed ? cashier.pin : "••••"}
                              </span>
                              <button
                                onClick={() => togglePinReveal(cashier.id)}
                                className="text-slate-400 hover:text-white"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleCopyPin(cashier.pin, cashier.id)}
                                className="text-slate-400 hover:text-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {cashier.requirePinChange && cashier.pin && !cashier.isFirstTimeSetup && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                              Reset Sent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {!isManager ? (
                          <button
                            type="button"
                            onClick={() => handleToggleCashierStatus(cashier)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${
                              cashier.status !== "inactive"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                            }`}
                            title={cashier.status !== "inactive" ? "Active — Click to Deactivate" : "Deactivated — Click to Activate"}
                          >
                            <span className={`w-2 h-2 rounded-full ${cashier.status !== "inactive" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                            <span>{cashier.status !== "inactive" ? "Active" : "Deactivated"}</span>
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            cashier.status !== "inactive"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${cashier.status !== "inactive" ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <span>{cashier.status !== "inactive" ? "Active" : "Deactivated"}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Live on Terminal
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Offline</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleShareWhatsApp(cashier)}
                            className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all hover:scale-105"
                            title="Share credentials on WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendPinReset(cashier)}
                            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-all hover:scale-105"
                            title="Send WhatsApp Link for Cashier to change their PIN"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedBadgeCashier(cashier)}
                            className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all hover:scale-105"
                            title="Print POS Quick-Login Badge"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {!isManager && (
                          <button
                            onClick={() => handleToggleCashierStatus(cashier)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              cashier.status !== "inactive"
                                ? "text-amber-400 hover:bg-amber-500/10"
                                : "text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                            title={cashier.status !== "inactive" ? "Deactivate Account" : "Activate Account"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                        {!isManager && (
                          <button
                            onClick={() => handleOpenEditModal(cashier)}
                            className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {!isManager && (
                          <button
                            onClick={() => handleDeleteCashier(cashier)}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* =========================================================================
          5. SLIDE-OVER MODAL / DRAWER FOR ADD & EDIT CASHIER
         ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative w-full max-w-xl bg-gradient-to-b from-[#141b30] to-[#0c1120] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(225,29,72,0.2)] text-white space-y-6 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    modalMode === "add" ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                  }`}>
                    {modalMode === "add" ? <Plus className="w-6 h-6" /> : <Edit3 className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {modalMode === "add" ? "Register New Cashier" : "Update Cashier Profile"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {modalMode === "add" ? "Create secure POS credentials & shift permissions" : `Editing credentials for ${formData.name}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitForm} className="space-y-5">
                
                {/* 1. Full Name (with HR Employee Autocomplete) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                    <span>Full Name (Arabic / English)</span>
                    <span className="text-[10px] text-slate-400">Synced with HR Employees</span>
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      list="employee-names-list"
                      value={formData.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = employeesList.find(emp => emp.name === val);
                        setFormData(prev => ({
                          ...prev,
                          name: val,
                          employeeId: match ? match.id : prev.employeeId,
                          storeId: match?.storeId ? match.storeId : prev.storeId
                        }));
                      }}
                      placeholder="e.g. عبدالرحمن محمود or Ahmed Mohamed..."
                      className="w-full px-4 py-3 rounded-xl bg-[#090d18] border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 text-sm font-semibold transition-all"
                    />
                    <datalist id="employee-names-list">
                      {employeesList.map(emp => (
                        <option key={emp.id} value={emp.name}>
                          {emp.position || "Employee"} • {emp.storeId || "Branch"}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 2. Branch & Store ID Allocation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      Branch Assignment
                    </label>
                    <select
                      value={formData.branchId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          branchId: bId,
                          storeId: bId === "ola" ? "ola-el-koronfol" : "eL-alamein-4"
                        }));
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-[#090d18] border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-red-500/60 transition-all"
                    >
                      <option value="alamein4">Circle K - El Alamein 4</option>
                      <option value="ola">Circle K - Ola El Koronfol</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-purple-400" />
                      Store Terminal ID
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.storeId}
                      onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                      placeholder="e.g. eL-alamein-4"
                      className="w-full px-4 py-3 rounded-xl bg-[#090d18] border border-white/15 text-white text-sm font-mono focus:outline-none focus:border-red-500/60 transition-all"
                    />
                  </div>
                </div>

                {/* 3. Shift Window Permission */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Allowed Shift Schedule
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "All", label: "Flexible (All)", icon: Sparkles, color: "hover:border-emerald-500" },
                      { id: "Morning", label: "Morning", icon: Sunrise, color: "hover:border-amber-500" },
                      { id: "Noon", label: "Noon", icon: Sun, color: "hover:border-orange-500" },
                      { id: "Night", label: "Night", icon: Moon, color: "hover:border-indigo-500" }
                    ].map((shift) => {
                      const Icon = shift.icon;
                      const isSelected = formData.shiftType === shift.id;

                      return (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, shiftType: shift.id })}
                          className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                            isSelected
                              ? "bg-red-600/20 border-red-500 text-white font-bold shadow-lg shadow-red-600/20"
                              : "bg-[#090d18] border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? "text-red-400" : "text-slate-400"}`} />
                          <span className="text-xs">{shift.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Special Features: Master Scanner Toggle */}
                <div className="p-4 rounded-2xl bg-[#090d18] border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Master Item Scanner Authority
                    </p>
                    <p className="text-xs text-slate-400">
                      Enables camera barcode scanner to inspect secret unit costs and inventory price history.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.canUseMasterScanner}
                      onChange={(e) => setFormData({ ...formData, canUseMasterScanner: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>

                {/* 5. Security PIN: Self-Service vs Manual */}
                {modalMode === "add" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        Security PIN Setup
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = formData.pinMode === "self_service" ? "manual" : "self_service";
                          setFormData({
                            ...formData,
                            pinMode: nextMode,
                            pin: nextMode === "manual" ? Math.floor(1000 + Math.random() * 9000).toString() : ""
                          });
                        }}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        {formData.pinMode === "self_service" ? "Or set PIN manually" : "Switch to self-service PIN"}
                      </button>
                    </div>

                    {formData.pinMode === "self_service" ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/30 space-y-2 text-right" dir="rtl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">الرمز السري: يحدده الكاشير بنفسه</p>
                            <p className="text-[10px] text-cyan-300">Self-Service PIN Creation via WhatsApp</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          لن تحتاج لكتابة رمز سري. سيقوم النظام بإنشاء الحساب وإعداد رابط تفعيل خاص بالكاشير لإرساله عبر واتساب، ليقوم باختيار رمزه السري وتأكيده بنفسه لأول مرة.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-3">
                          <input
                            required
                            type="text"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            value={formData.pin}
                            onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                            placeholder="1234"
                            className="flex-1 px-4 py-3 rounded-xl bg-[#090d18] border border-white/15 text-white font-mono font-black text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                          />
                          <button
                            type="button"
                            onClick={generateUniquePin}
                            className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-md"
                            title="Generate Unique Random PIN"
                          >
                            <Dices className="w-4 h-4 text-purple-400" />
                            <span>Roll PIN</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Edit Mode */
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-red-400" />
                        4-Digit Security PIN
                      </span>
                      <span className="text-[10px] text-slate-400">Unique identifier for shift entry</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        required
                        type="text"
                        pattern="[0-9]{4}"
                        maxLength={4}
                        value={formData.pin}
                        onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        placeholder="1234"
                        className="flex-1 px-4 py-3 rounded-xl bg-[#090d18] border border-white/15 text-white font-mono font-black text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                      />
                      <button
                        type="button"
                        onClick={generateUniquePin}
                        className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-md"
                        title="Generate Unique Random PIN"
                      >
                        <Dices className="w-4 h-4 text-purple-400" />
                        <span>Roll PIN</span>
                      </button>
                      {editTargetId && (
                        <button
                          type="button"
                          onClick={() => {
                            const c = cashiers.find(x => x.id === editTargetId);
                            if (c) handleSendPinReset(c);
                          }}
                          className="px-3.5 py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md whitespace-nowrap"
                          title="Send WhatsApp Link for Cashier to change their PIN"
                        >
                          <KeyRound className="w-4 h-4 text-amber-400" />
                          <span>Reset Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Account Status (Portal Access) */}
                <div className="p-4 rounded-2xl bg-[#090d18] border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <Power className="w-4 h-4 text-emerald-400" />
                      Account Status (Portal Access)
                    </p>
                    <p className="text-xs text-slate-400">
                      Active cashiers can log into the cashier hub and submit shift reports. When deactivated, portal access is locked.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      status: prev.status === "inactive" ? "active" : "inactive"
                    }))}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-all active:scale-95 ${
                      formData.status !== "inactive"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${formData.status !== "inactive" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    <span>{formData.status !== "inactive" ? "Active (Enabled)" : "Deactivated (Locked)"}</span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className={`px-7 py-3 rounded-xl font-bold text-sm text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ${
                      modalMode === "add"
                        ? "bg-red-600 hover:bg-red-500 shadow-red-600/30"
                        : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{modalMode === "add" ? "Create Cashier Account" : "Save Changes"}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          6. POST-CREATION SUCCESS ONBOARDING PROMPT
         ========================================================================= */}
      <AnimatePresence>
        {justSavedCashier && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setJustSavedCashier(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#141d33] to-[#0c1221] border border-emerald-500/30 p-6 sm:p-8 shadow-[0_0_60px_rgba(16,185,129,0.25)] text-center text-white space-y-6"
            >
              {justSavedCashier.isFirstTimeSetup || !justSavedCashier.pin ? (
                <>
                  <div className="w-16 h-16 rounded-3xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
                    <KeyRound className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-white">تم إنشاء حساب الكاشير!</h3>
                    <p className="text-sm text-slate-300 mt-1 font-semibold">
                      {justSavedCashier.name}
                    </p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>الكاشير سيقوم بتعيين الرمز السري بنفسه</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* 1-Click WhatsApp Setup Link */}
                    <button
                      onClick={() => {
                        handleSendPinReset(justSavedCashier);
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>إرسال رابط التفعيل عبر واتساب</span>
                    </button>

                    {/* Copy Setup Link */}
                    <button
                      onClick={() => {
                        const resetUrl = `https://anh-zeta.vercel.app/cashier/reset-pin?id=${justSavedCashier.id}&token=${justSavedCashier.resetPinToken}`;
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          navigator.clipboard.writeText(resetUrl);
                        }
                        toast.success("Setup link copied to clipboard!");
                      }}
                      className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>نسخ رابط التفعيل</span>
                    </button>

                    {/* Print Badge */}
                    <button
                      onClick={() => {
                        const c = justSavedCashier;
                        setJustSavedCashier(null);
                        setSelectedBadgeCashier(c);
                      }}
                      className="w-full py-3 px-4 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>طباعة شارة الكاشير (Badge)</span>
                    </button>

                    <button
                      onClick={() => setJustSavedCashier(null)}
                      className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      إغلاق
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-white">Cashier Account Ready!</h3>
                    <p className="text-sm text-slate-300 mt-1 font-semibold">
                      {justSavedCashier.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Security PIN: <span className="font-mono font-bold text-red-400 tracking-widest">{justSavedCashier.pin}</span>
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {/* 1-Click WhatsApp Send */}
                    <button
                      onClick={() => {
                        handleShareWhatsApp(justSavedCashier);
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Send Credentials via WhatsApp</span>
                    </button>

                    {/* Copy Formatted Credentials Button */}
                    <button
                      onClick={() => {
                        const isOla = justSavedCashier.branchId === "ola" || justSavedCashier.storeId?.toLowerCase().includes("ola");
                        const branchName = isOla ? "Circle K - Ola El Koronfol" : "Circle K - El Alamein 4";
                        let shiftName = "جميع الورديات (All Shifts)";
                        if (justSavedCashier.shiftType === "Morning") shiftName = "وردية صباحية (Morning Shift)";
                        else if (justSavedCashier.shiftType === "Noon") shiftName = "وردية مسائية (Noon Shift)";
                        else if (justSavedCashier.shiftType === "Night") shiftName = "وردية ليلية (Night Shift)";

                        const msg = [
                          `مرحباً ${justSavedCashier.name}،`,
                          `تم تجهيز حسابك لنظام كاشير Circle K:`,
                          ``,
                          `🏢 الفرع: ${branchName}`,
                          `🔒 الرمز السري (PIN): ${justSavedCashier.pin}`,
                          `⏱️ الوردية المسموحة: ${shiftName}`,
                          ``,
                          `🔗 رابط تسجيل الدخول:`,
                          `https://anh-zeta.vercel.app/cashier`,
                          ``,
                          `*يرجى الحفاظ على سرية هذا الرمز وعدم مشاركته.*`
                        ].join("\n");
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          navigator.clipboard.writeText(msg);
                        }
                        toast.success("Full credentials copied to clipboard!");
                      }}
                      className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copy Credentials Message</span>
                    </button>

                    {/* Print Badge Button */}
                    <button
                      onClick={() => {
                        const c = justSavedCashier;
                        setJustSavedCashier(null);
                        setSelectedBadgeCashier(c);
                      }}
                      className="w-full py-3 px-4 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Print POS Login Badge</span>
                    </button>

                    <button
                      onClick={() => setJustSavedCashier(null)}
                      className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          7. PRINTABLE POS QUICK-LOGIN BADGE MODAL
         ========================================================================= */}
      <AnimatePresence>
        {selectedBadgeCashier && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBadgeCashier(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />

            {/* Badge Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-[#0d1222] border border-white/15 p-6 shadow-2xl text-white space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                  <QrCode className="w-4 h-4" />
                  <span>POS Access Pass</span>
                </div>
                <button
                  onClick={() => setSelectedBadgeCashier(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* The Physical Badge Card Layout (Printable) */}
              <div 
                id="printable-cashier-badge"
                className="relative rounded-2xl bg-white text-slate-900 p-6 shadow-xl border border-slate-200 overflow-hidden flex flex-col items-center text-center space-y-4"
              >
                {/* Circle K Red Top Header */}
                <div className="w-full bg-gradient-to-r from-red-600 via-red-600 to-red-700 text-white py-3 px-4 -mx-6 -mt-6 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-red-600 font-black text-base shadow">
                      K
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black tracking-widest uppercase leading-none">Circle K</p>
                      <p className="text-[9px] text-red-100 font-medium leading-none mt-0.5">
                        {selectedBadgeCashier.branchId === "ola" || selectedBadgeCashier.storeId?.toLowerCase().includes("ola")
                          ? "Ola El Koronfol"
                          : "El Alamein 4"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-white border border-white/30">
                    POS Pass
                  </span>
                </div>

                {/* Cashier Photo / Initials */}
                <div className="pt-2">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white font-black text-xl flex items-center justify-center mx-auto shadow-md border-2 border-red-500">
                    {selectedBadgeCashier.name.slice(0, 2)}
                  </div>
                  <h4 className="text-base font-black text-slate-900 mt-2 leading-tight">
                    {selectedBadgeCashier.name}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 font-bold">
                    ID: {selectedBadgeCashier.storeId}
                  </p>
                </div>

                {/* Encrypted QR Code for Instant Camera Login */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner inline-block">
                  <QRCode
                    value={`https://anh-zeta.vercel.app/cashier?auto_name=${encodeURIComponent(selectedBadgeCashier.name)}&auto_pin=${selectedBadgeCashier.pin}`}
                    size={130}
                    level="M"
                  />
                </div>

                <div className="w-full bg-slate-100 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Allowed Shift</span>
                    <span className="font-bold text-slate-800">
                      {selectedBadgeCashier.shiftType || "All Shifts"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Security PIN</span>
                    <span className="font-mono font-black text-red-600 text-sm tracking-wider">
                      {selectedBadgeCashier.pin}
                    </span>
                  </div>
                </div>

                <p className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold">
                  Official Circle K Operational Access Token
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handlePrintBadge}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Pass (Thermal / Paper)</span>
                </button>

                <button
                  onClick={() => handleShareWhatsApp(selectedBadgeCashier)}
                  className="w-full py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Credentials on WhatsApp</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global CSS for Print Mode to print ONLY the badge */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-cashier-badge,
          #printable-cashier-badge * {
            visibility: visible !important;
          }
          #printable-cashier-badge {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            margin: 0 auto !important;
          }
        }
      `}</style>

    </div>
  );
}
