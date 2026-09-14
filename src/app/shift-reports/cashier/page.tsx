"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, dbService } from "@/lib/firebase";
import { collection, addDoc, getDocs, getDoc, query, where, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Calculator, Package, Banknote, Calendar, Clock, ArrowRight, ArrowLeft, Lock, User as UserIcon, Globe, WifiOff, RefreshCw, ChevronDown, Shield, ShieldCheck, ShieldAlert, Radar } from "lucide-react";
import { getOfflineQueue, addToOfflineQueue, removeFromOfflineQueue } from '@/lib/offlineDb';
import { useRouter } from "next/navigation";
import { PinPad } from "@/components/PinPad";
import { RadarOfflineScreen } from "@/components/RadarOfflineScreen";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { CameraScanner } from "@/components/ui/CameraScanner";
import { NumericFormat } from "react-number-format";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { SafeDropVault } from "@/components/SkeuomorphicUX/SafeDropVault";
import { motion, useScroll, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
const SignaturePad = dynamic(() => import("react-signature-canvas"), { ssr: false });
import { toast } from "sonner";
import { triggerSuccessOverlay } from "@/components/MobileUX/SuccessOverlay";
import { SkeletonList } from "@/components/MobileUX/SkeletonLoader";
import { dispatchNotificationSystem } from "@/lib/notifications";

// Translation Dictionary
const t = {
  en: {
    shiftAccess: "Shift Access",
    authorizedOnly: "Authorized Cashiers Only",
    cashierName: "Cashier Name",
    selectName: "-- Select your name --",
    pin: "4-Digit PIN",
    unlock: "Unlock Shift Input",
    dailyReport: "Daily Shift Report",
    rejectedTitle: "Report Rejected by Manager",
    rejectedSubtitle: "Please correct your numbers below and resubmit.",
    shiftInfo: "Shift Information",
    date: "Date",
    shift: "Shift",
    morning: "Morning",
    noon: "Noon",
    night: "Night",
    role: "Register Role",
    role1: "Cashier 1 (Full Register & Inventory)",
    role2: "Cashier 2 (Money Only)",
    storeId: "Assigned Store ID",
    drops: "Cashier Drops",
    actualCash: "Actual Cash Inside Drop",
    totalVisa: "Total Visa Slips Inside Drop",
    totalDrops: "Total Declared Drops:",
    inventory: "Inventory Checks",
    cigarettes: "Cigarettes (Packs)",
    lighters: "Lighters (Units)",
    start: "Start",
    delivery: "+ Delivery",
    end: "- End Count",
    soldPacks: "Sold Packs",
    soldUnits: "Sold Units",
    submitting: "Submitting...",
    resubmit: "Resubmit Corrected Report",
    submit: "Submit Shift Report",
    reasonLabel: "Manager's Reason",
    signYourReport: "Sign Your Report",
    signBelow: "Please sign below to verify this report.",
    clearSignature: "Clear Signature"
  },
  ar: {
    shiftAccess: "تسجيل الدخول للوردية",
    authorizedOnly: "للكاشير المصرح لهم فقط",
    cashierName: "اسم الكاشير",
    selectName: "-- اختر اسمك --",
    pin: "الرمز السري (٤ أرقام)",
    unlock: "الدخول للوردية",
    dailyReport: "تقرير الوردية اليومي",
    rejectedTitle: "تم رفض التقرير من المدير",
    rejectedSubtitle: "يرجى تصحيح الأرقام أدناه وإعادة الإرسال.",
    shiftInfo: "معلومات الوردية",
    date: "التاريخ",
    shift: "فترة الوردية",
    morning: "صباحي",
    noon: "مسائي",
    night: "ليلي",
    role: "نوع الكاشير",
    role1: "كاشير ١ (نقدية ومخزون)",
    role2: "كاشير ٢ (نقدية فقط)",
    storeId: "رقم الفرع",
    drops: "النقدية المسلمة",
    actualCash: "النقد الفعلي المسلم (كاش)",
    totalVisa: "إجمالي إيصالات الفيزا",
    totalDrops: "إجمالي النقدية المسلمة:",
    inventory: "جرد المخزون",
    cigarettes: "السجائر (علب)",
    lighters: "الولاعات (حبات)",
    start: "بداية الوردية",
    delivery: "+ استلام",
    end: "- نهاية الوردية",
    soldPacks: "المباع (علب)",
    soldUnits: "المباع (حبات)",
    submitting: "جاري الإرسال...",
    resubmit: "إعادة إرسال التقرير المصحح",
    submit: "إرسال تقرير الوردية",
    reasonLabel: "سبب الرفض",
    signYourReport: "توقيع التقرير",
    signBelow: "يرجى التوقيع داخل المربع أدناه لتأكيد التقرير.",
    clearSignature: "مسح التوقيع"
  }
};

export const CIGARETTE_TYPES = [
  { id: "Marlboro Purple Mix", en: "Marlboro Purple Mix", ar: "مارلبورو بيربل ميكس" },
  { id: "Marlboro Crafted Gold", en: "Marlboro Crafted Gold", ar: "مارلبورو كرافتد جولد" },
  { id: "Marlboro Crafted Red", en: "Marlboro Crafted Red", ar: "مارلبورو كرافتد أحمر" },
  { id: "Marlboro White Local", en: "Marlboro White Local", ar: "مارلبورو أبيض محلي" },
  { id: "Marlboro Red Local", en: "Marlboro Red Local", ar: "مارلبورو أحمر محلي" },
  { id: "L&M Forward", en: "L&M Forward", ar: "إل آند إم فوروارد" },
  { id: "L&M Ultra Lights", en: "L&M Ultra Lights", ar: "إل آند إم ألترا لايتس" },
  { id: "L&M Red", en: "L&M Red", ar: "إل آند إم أحمر" },
  { id: "L&M Blue", en: "L&M Blue", ar: "إل آند إم أزرق" },
  { id: "Merit Blue Local", en: "Merit Blue Local", ar: "ميريت أزرق محلي" },
  { id: "Merit Yellow Local", en: "Merit Yellow Local", ar: "ميريت أصفر محلي" },
  { id: "Terea Amber", en: "Terea Amber", ar: "تيريا عنبر" },
  { id: "Terea Silver", en: "Terea Silver", ar: "تيريا فضي" },
  { id: "Terea Sun Pearl", en: "Terea Sun Pearl", ar: "تيريا صن بيرل" },
  { id: "Terea Purple Wave", en: "Terea Purple Wave", ar: "تيريا بيربل ويف" },
  { id: "Terea Oasis Pearl", en: "Terea Oasis Pearl", ar: "تيريا أواسيس بيرل" },
  { id: "Terea Turquoise Mint", en: "Terea Turquoise Mint", ar: "تيريا تركواز منت" },
  { id: "Terea Sienna", en: "Terea Sienna", ar: "تيريا سيينا" },
  { id: "Terea Russet", en: "Terea Russet", ar: "تيريا روسيت" },
  { id: "Terea Summer Wave", en: "Terea Summer Wave", ar: "تيريا سمر ويف" },
  { id: "Terea Arbor Pearl", en: "Terea Arbor Pearl", ar: "تيريا أربور بيرل" },
  { id: "Terea Rigan", en: "Terea Rigan", ar: "تيريا ريجان" },
  { id: "Terea Khaki", en: "Terea Khaki", ar: "تيريا كاكي" }
];

export default function CashierShiftReportPage() {
  const router = useRouter();
  const sigPadRef = useRef<SignaturePad>(null);

  const [lang, setLang] = useState<"en" | "ar">("en");
  const dict = t[lang];

  const [cashiers, setCashiers] = useState<any[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(true);

  // Cashier Details
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("Morning");
  const [assignedShiftType, setAssignedShiftType] = useState("All");
  const [cashierRole, setCashierRole] = useState<number>(1);
  const [step, setStep] = useState<number>(1);
  
  // Cashier Money Counts
  const [denominations, setDenominations] = useState({
    '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': ""
  });
  const [visa, setVisa] = useState<string>("");

  // Inventory
  const [cigaretteCounts, setCigaretteCounts] = useState<Record<string, { start: string; delivery: string; end: string }>>({});
  const [lighters, setLighters] = useState({ start: "", delivery: "", end: "" });

  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [isDroppingSafe, setIsDroppingSafe] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState<string | null>(null);
  const [cashierWriteUp, setCashierWriteUp] = useState<string>("");
  const [originalData, setOriginalData] = useState<any>(null);

  const [cashierSignature, setCashierSignature] = useState("");
  const [hasSigned, setHasSigned] = useState(false);

  const [earlyDayRequest, setEarlyDayRequest] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  
  // Offline Mode States
  const [isOffline, setIsOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [showRadar, setShowRadar] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const { scrollY } = useScroll();
  const headerHeight = useTransform(scrollY, [0, 100], [90, 60]);
  const titleOpacity = useTransform(scrollY, [0, 60], [1, 0]);
  const titleScale = useTransform(scrollY, [0, 60], [1, 0.8]);
  const titleY = useTransform(scrollY, [0, 60], [0, -15]);
  const parallaxY = useTransform(scrollY, [0, 300], [0, 80]); // Parallax slower move
  
  useEffect(() => {
    // Check if authenticated from Cashier Hub
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        setSelectedCashierId(user.id);
        setUnlocked(true);
        // We simulate unlocking to trigger the data fetch logic
        setTimeout(() => triggerUnlockDataFetch(user), 500);
      } catch (e) {
        console.error("Invalid session");
      }
    }

    // Initial offline check
    setIsOffline(!navigator.onLine);
    checkOfflineQueue();

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineReports();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function checkOfflineQueue() {
    try {
      const q = await getOfflineQueue();
      setOfflineCount(q.length);
    } catch (e) {
      setOfflineCount(0);
    }
  }

  async function syncOfflineReports() {
    try {
      const queue = await getOfflineQueue();
      if (queue.length === 0) return;
      
      setSyncing(true);
      let remainingCount = queue.length;
      
      for (const item of queue) {
        try {
          if (item.payload.existingReportId) {
            await updateDoc(doc(db, "shift_reports", item.payload.existingReportId), item.payload.data);
          } else {
            await addDoc(collection(db, "shift_reports"), item.payload.data);
            try {
              await addDoc(collection(db, "notifications"), {
                type: "shift",
                message: `${item.payload.data.cashierName || "Unknown"} submitted a new Shift Report (Offline Sync)`,
                cashierName: item.payload.data.cashierName || "Unknown",
                storeId: item.payload.data.branchId || "Unknown",
                createdAt: serverTimestamp(),
                read: false,
                link: "/shift-reports/manager",
              });
            } catch (notifyErr: any) {
              console.error("Failed to push notification:", notifyErr);
              toast.error("Bell Notification failed: " + (notifyErr.message || "Unknown error"));
            }
          }
          await removeFromOfflineQueue(item.id);
          remainingCount--;
        } catch (e) {
          console.error("Failed to sync report", e);
        }
      }
      
      if (remainingCount === 0) {
        // Show success animation on radar if it's open
        setShowRadar(true);
        toast.success(lang === 'en' ? "Offline reports successfully synced to the server!" : "تم مزامنة التقارير المحفوظة بنجاح!");
      }
      checkOfflineQueue();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const snap = await getDocs(collection(db, "cashiers"));
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Inject Master Account so it works properly in Shift Reports
        fetched.push({
          id: "master_youssef",
          employeeId: "master_youssef",
          name: "Mr Youssef",
          pin: "4321",
          role: "master",
          storeId: "ALL"
        } as any);
        
        setCashiers(fetched);
      } catch (e) {
        console.error("Failed to load cashiers", e);
      } finally {
        setLoadingCashiers(false);
      }
    };
    fetchCashiers();
    setDate(new Date().toISOString().substring(0, 10));
  }, []);

  // Extracted unlock logic for auto-unlock support
  async function triggerUnlockDataFetch(c: any) {
    setLoading(true);
    
    let configuredShift = c.shiftType;
    if (configuredShift === undefined) {
      try {
        const q1 = query(collection(db, "cashiers"), where("employeeId", "==", c.id));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          configuredShift = snap1.docs[0].data().shiftType;
        } else {
          const docRef = doc(db, "cashiers", c.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            configuredShift = docSnap.data().shiftType;
          }
        }
      } catch (err) {
        console.error("Failed to fetch configured shift", err);
      }
    }
    
    configuredShift = configuredShift || "All";
    setAssignedShiftType(configuredShift);
    if (configuredShift !== "All") {
      setShift(configuredShift);
    }

    try {
      // 0. Check for Early Day requests
      const earlyDayQuery = query(
        collection(db, "early_day_requests"),
        where("cashierId", "==", c.id),
        where("status", "==", "pending")
      );
      const earlyDaySnap = await getDocs(earlyDayQuery);
      if (!earlyDaySnap.empty) {
        const earlyDayData: any = { id: earlyDaySnap.docs[0].id, ...earlyDaySnap.docs[0].data() };
        setEarlyDayRequest(earlyDayData);
        // Pre-fill date and shift from early day request
        if (earlyDayData.targetDate) setDate(earlyDayData.targetDate);
        if (earlyDayData.targetShift) {
          setShift(earlyDayData.targetShift);
          setAssignedShiftType(earlyDayData.targetShift);
        }
      }

      // 1. Check if there is a rejected or disputed report for this cashier today
      const todayStr = new Date().toISOString().substring(0, 10);
      const rejectQuery = query(
        collection(db, "shift_reports"),
        where("cashierDetails.name", "==", c.name),
        where("status", "in", ["rejected", "disputed"])
      );
      
      const rejectSnap = await getDocs(rejectQuery);
      // Filter strictly for reports from today
      const todayRejected = rejectSnap.docs.filter(d => {
        const rData = d.data();
        return rData.cashierDetails?.date === todayStr || rData.date === todayStr;
      });

      if (todayRejected.length > 0) {
        // Sort in memory to get the latest without needing a composite index
        const sortedDocs = todayRejected.sort((a, b) => 
          (b.data().createdAt || "").localeCompare(a.data().createdAt || "")
        );
        const rejectedReport = sortedDocs[0];
        const data = rejectedReport.data();
        
        setExistingReportId(rejectedReport.id);
        setReportStatus(data.status);
        if (data.status === "rejected") {
          setRejectReason(data.managerAudit?.rejectReason || "No reason provided by manager.");
        } else if (data.status === "disputed") {
          setDisputeReason(data.managerAudit?.disputeReason || "No reason provided by manager.");
        }
        setOriginalData({
          cash: data.cashierCounts.cash,
          visa: data.cashierCounts.visa,
          cigEnd: data.inventoryCounts?.cigarettes?.end || 0,
          lightEnd: data.inventoryCounts?.lighters?.end || 0
        });
        
        // Auto-fill their old inputs
        setShift(data.cashierDetails.shift);
        setCashierRole(data.cashierRole || 1);
        if (data.cashierCounts.denominations) {
          setDenominations({
            '200': data.cashierCounts.denominations['200'] ? String(data.cashierCounts.denominations['200']) : "",
            '100': data.cashierCounts.denominations['100'] ? String(data.cashierCounts.denominations['100']) : "",
            '50': data.cashierCounts.denominations['50'] ? String(data.cashierCounts.denominations['50']) : "",
            '20': data.cashierCounts.denominations['20'] ? String(data.cashierCounts.denominations['20']) : "",
            '10': data.cashierCounts.denominations['10'] ? String(data.cashierCounts.denominations['10']) : "",
            '5': data.cashierCounts.denominations['5'] ? String(data.cashierCounts.denominations['5']) : "",
            'coins': data.cashierCounts.denominations['coins'] ? String(data.cashierCounts.denominations['coins']) : ""
          });
        } else {
          setDenominations({ '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': String(data.cashierCounts.cash) });
        }
        setVisa(String(data.cashierCounts.visa));
        const prevCigCounts = data.inventoryCounts?.cigaretteCounts || {};
        const formattedCigCounts: Record<string, { start: string; delivery: string; end: string }> = {};
        for (const [key, val] of Object.entries(prevCigCounts)) {
          if (typeof val === 'object' && val !== null) {
            formattedCigCounts[key] = {
              start: String((val as any).start || ""),
              delivery: String((val as any).delivery || ""),
              end: String((val as any).end || "")
            };
          } else {
            formattedCigCounts[key] = { start: "", delivery: "", end: String(val || "") };
          }
        }
        setCigaretteCounts(formattedCigCounts);
        setLighters({
          start: String(data.inventoryCounts?.lighters?.start || ""),
          delivery: String(data.inventoryCounts?.lighters?.delivery || ""),
          end: String(data.inventoryCounts?.lighters?.end || "")
        });
        
        setLoading(false);
        return; // Skip the auto-fetch for a new report since we are editing a rejected one
      }

      // 2. If no rejected report, Auto-fetch previous shift's end inventory for this store
      const prevQuery = query(
        collection(db, "shift_reports"),
        where("cashierDetails.storeId", "==", c.storeId)
      );
      const prevSnap = await getDocs(prevQuery);
      if (!prevSnap.empty) {
        const sortedDocs = prevSnap.docs.sort((a,b) => b.data().createdAt.localeCompare(a.data().createdAt));
        const lastReport = sortedDocs[0].data();
        const lightEnd = lastReport.inventoryCounts?.lighters?.end || 0;
        setLighters(prev => ({ ...prev, start: String(lightEnd) }));

        const prevCigCounts = lastReport.inventoryCounts?.cigaretteCounts || {};
        const newCigStarts: Record<string, { start: string; delivery: string; end: string }> = {};
        for (const [key, val] of Object.entries(prevCigCounts)) {
          const endVal = typeof val === 'object' && val !== null ? (val as any).end : val;
          newCigStarts[key] = { start: String(endVal || ""), delivery: "", end: "" };
        }
        setCigaretteCounts(prev => ({ ...prev, ...newCigStarts }));
      }
    } catch (e) {
      console.error("Could not fetch data on unlock", e);
      // Fails silently if no previous records or missing composite index
    } finally {
      setLoading(false);
    }
  }

  const handleUnlock = async (e: React.FormEvent | string) => {
    if (typeof e !== "string") {
      e.preventDefault();
    }
    const c = cashiers.find(x => x.id === selectedCashierId);
    if (!c) return toast.error("Select your name");
    
    const pinToVerify = typeof e === "string" ? e : pinInput;
    if (c.pin !== pinToVerify) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      toast.error("Incorrect PIN");
      setPinInput("");
      return;
    }

    setUnlocked(true);
    triggerUnlockDataFetch(c);
  };

  const calculateSold = (start: string, delivery: string, end: string) => {
    const s = Number(start) || 0;
    const d = Number(delivery) || 0;
    const e = Number(end) || 0;
    return s + d - e;
  };

  const calculateTotalCash = () => {
    return (
      (Number(denominations['200']) * 200) +
      (Number(denominations['100']) * 100) +
      (Number(denominations['50']) * 50) +
      (Number(denominations['20']) * 20) +
      (Number(denominations['10']) * 10) +
      (Number(denominations['5']) * 5) +
      (Number(denominations['coins']) || 0)
    );
  };

  const calculateTotalMoney = () => {
    return calculateTotalCash() + (Number(visa) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sessionUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("active_cashier_session") || "null") : null;
    const c = cashiers.find(x => x.id === selectedCashierId) || (sessionUser?.id === selectedCashierId ? sessionUser : null) || sessionUser;

    if (!c) {
      vibrateError();
      toast.error(lang === 'en' ? "Cashier session expired. Please log in again." : "انتهت جلسة الكاشير. يرجى تسجيل الدخول مجدداً.");
      setLoading(false);
      return;
    }

    const signature = cashierSignature || (hasSigned && sigPadRef.current ? sigPadRef.current.toDataURL() : null);

    if (!signature) {
      vibrateError();
      toast.warning(lang === 'en' ? "Please sign your report before submitting." : "يرجى توقيع التقرير قبل الإرسال.");
      if (step === 2) setStep(1);
      return;
    }

    setLoading(true);

    const payload: any = {
      status: "pending_manager",
      createdAt: new Date().toISOString(),
      cashierDetails: {
        name: c?.name || "Cashier",
        date,
        shift: shift || c?.shift || "1",
        storeId: c?.storeId || "Unknown",
      },
      branchId: c?.branchId || "alamein4",
      isEarlyDay: !!earlyDayRequest,
      cashierRole,
      cashierCounts: {
        cash: calculateTotalCash(),
        denominations: {
          '200': Number(denominations['200']) || 0,
          '100': Number(denominations['100']) || 0,
          '50': Number(denominations['50']) || 0,
          '20': Number(denominations['20']) || 0,
          '10': Number(denominations['10']) || 0,
          '5': Number(denominations['5']) || 0,
          'coins': Number(denominations['coins']) || 0,
        },
        visa: Number(visa) || 0,
        total: calculateTotalMoney()
      },
      cashierSignature: signature,
      cashierWriteUp: reportStatus === "disputed" ? cashierWriteUp : null,
      inventoryCounts: {
        cigaretteCounts: cigaretteCounts,
        lighters: {
          start: Number(lighters.start) || 0,
          delivery: Number(lighters.delivery) || 0,
          end: Number(lighters.end) || 0,
          sold: calculateSold(lighters.start, lighters.delivery, lighters.end)
        }
      }
    };

    const cleanPayload = JSON.parse(JSON.stringify(payload, (key, val) => val === undefined ? null : val));

    const triggerPrint = () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const html = `
          <div style="text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
            <h2 style="margin:0; font-size: 18px; font-weight: bold;">CIRCLE K</h2>
            <p style="margin:5px 0 0; font-size: 14px; font-weight: bold;">End of Shift Report</p>
          </div>
          <div style="margin-bottom: 10px; font-size: 12px; line-height: 1.5;">
            <p style="margin:0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p style="margin:0;"><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
            <p style="margin:0;"><strong>Cashier:</strong> ${c?.name || 'Unknown'}</p>
            <p style="margin:0;"><strong>Store:</strong> ${c?.storeId || 'Unknown'}</p>
            <p style="margin:0;"><strong>Shift:</strong> ${c?.shift || 'Unknown'}</p>
          </div>
          <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 10px; font-size: 14px;">
            <p style="margin:4px 0; display:flex; justify-content:space-between;"><span>Cash Drops:</span> <span>${calculateTotalCash()} EGP</span></p>
            <p style="margin:4px 0; display:flex; justify-content:space-between;"><span>Visa Slips:</span> <span>${visa || 0} EGP</span></p>
            <p style="margin:8px 0 0; font-size: 16px; font-weight:bold; display:flex; justify-content:space-between;"><span>TOTAL:</span> <span>${calculateTotalMoney()} EGP</span></p>
          </div>
          ${cashierRole === 1 ? `
          <div style="margin-bottom: 10px; font-size: 12px;">
            <p style="margin:0; font-weight: bold;">Inventory</p>
            <p style="margin:0; display:flex; justify-content:space-between;"><span>Cigarettes (Packs):</span> <span>${Object.values(cigaretteCounts).reduce((a, b) => a + Number(b), 0)}</span></p>
            <p style="margin:0; display:flex; justify-content:space-between;"><span>Lighters (Units):</span> <span>${calculateSold(lighters.start, lighters.delivery, lighters.end)}</span></p>
          </div>
          ` : ''}
          <div style="text-align: center; margin-top: 30px;">
            <p style="margin:0; font-size: 10px;">*** END OF REPORT ***</p>
          </div>
        `;
        try {
          (window as any).electronAPI.printReceipt(html);
        } catch(e) { console.error("Printing failed:", e); }
      }
    };

    try {
      // Trigger native thermal print if running in Electron
      triggerPrint();

      if (isOffline) {
        throw new Error("OFFLINE_MODE");
      }

      let submittedId = "";
      if (existingReportId) {
        // Edit rejected report
        const updatePayload = {
          ...cleanPayload,
          previousSubmission: originalData || null
        };
        await updateDoc(doc(db, "shift_reports", existingReportId), updatePayload);
        submittedId = existingReportId;
      } else {
        const docRef = await addDoc(collection(db, "shift_reports"), cleanPayload);
        submittedId = docRef.id;

        dbService.logAction(
          c?.email || "Cashier",
          c?.name || "Cashier",
          "cashier",
          "Submit Shift Report",
          "N/A",
          `Shift: ${cleanPayload.shift || "N/A"}, Store: ${c?.branchId || c?.storeId || "alamein4"}, Cash: EGP ${cleanPayload.cashierCounts?.cash || 0}`
        ).catch(() => {});
        
        try {
          const shiftNumber = c?.shift || cleanPayload.shift || "1";
          const storeName = c?.branchId || c?.storeId || "Circle K";
          const totalAmt = calculateTotalMoney();
          const cashAmt = calculateTotalCash();
          const visaAmt = Number(visa) || 0;

          const notifTitle = `📊 Shift #${shiftNumber} Audit Submitted — ${c?.name || "Cashier"}`;
          const notifBody = `${c?.name || "Cashier"} submitted Shift #${shiftNumber} Audit for ${storeName} (Total: EGP ${totalAmt.toLocaleString()} | Cash: EGP ${cashAmt.toLocaleString()} | Visa: EGP ${visaAmt.toLocaleString()}).`;

          const activeShiftBranch = c?.branchId || c?.storeId || "alamein4";

          dispatchNotificationSystem({
            title: notifTitle,
            body: notifBody,
            type: "shift",
            url: "/shift-reports/manager",
            branchId: activeShiftBranch,
            metadata: { cashierName: c?.name, storeId: storeName, totalMoney: totalAmt }
          });
        } catch (notifyErr: any) {
          console.error("Failed to push notification:", notifyErr);
        }
      }
      
      // Complete early day request if it exists
      if (earlyDayRequest) {
        try {
          await updateDoc(doc(db, "early_day_requests", earlyDayRequest.id), {
            status: "completed",
            completedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to complete early day request", e);
        }
      }
      
      // Fire system-wide push and in-app notifications
      try {
        const activeShiftBranch = c?.branchId || c?.storeId || "alamein4";
        dispatchNotificationSystem({
          title: `📋 New Shift Report Submitted - ${c?.name || 'Cashier'}`,
          body: `Store: ${c?.storeId || 'eL-alamein-4'} • Shift: ${c?.shift || 'Standard'}\nTotal Money: EGP ${calculateTotalMoney().toLocaleString()} (Cash: EGP ${calculateTotalCash().toLocaleString()}, Visa: EGP ${visa || 0})`,
          type: "shift",
          url: `/shift-reports/view?id=${submittedId}`,
          branchId: activeShiftBranch,
          metadata: { cashierName: c?.name, storeId: c?.storeId, shiftId: submittedId }
        });
      } catch (notifErr) {
        console.warn("Shift notification dispatch warning:", notifErr);
      }
      
      setIsDroppingSafe(true);

    } catch (error: any) {
      console.error("Error submitting shift report:", error);
      
      // Save to offline queue if offline or network failure
      const isNetworkError = error.message === "OFFLINE_MODE" || error.code?.includes('network') || error.message?.includes('offline');
      
      if (isNetworkError) {
        vibrateSuccess(); // Still a success UX since it saved offline
        await addToOfflineQueue('shift_reports', {
          existingReportId: existingReportId || null,
          data: {
            ...payload,
            _offlineSavedAt: new Date().toISOString()
          }
        });
        checkOfflineQueue();
        
        // Show radar
        setShowRadar(true);
        
        // Reset form to let them continue or leave
        setDenominations({ '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': "" });
        setVisa("");
      } else {
        vibrateError();
        toast.error(lang === 'en' ? `Failed: ${(error as any)?.message || error}` : "فشل الإرسال. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingCashiers) {
    return (
    <div className="ck-shift-report flex justify-center items-center p-20 bg-background min-h-screen">
      <style>{`
        .ck-shift-report { background-color: #0B1121 !important; color: #f8fafc !important; color-scheme: dark !important; min-height: 100dvh; }
        .ck-shift-report .bg-white, .ck-shift-report .dark\\:bg-slate-800, .ck-shift-report .dark\\:bg-slate-800\\/80, .ck-shift-report .dark\\:bg-slate-900, .ck-shift-report .bg-slate-100 { background-color: #151E32 !important; border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-shift-report .bg-slate-50, .ck-shift-report .dark\\:bg-slate-950\\/20, .ck-shift-report .dark\\:bg-slate-950 { background-color: #0B1121 !important; }
        .ck-shift-report .text-slate-800, .ck-shift-report .text-slate-900, .ck-shift-report .dark\\:text-white, .ck-shift-report .dark\\:text-slate-100 { color: #f8fafc !important; }
        .ck-shift-report .text-slate-500, .ck-shift-report .text-slate-600, .ck-shift-report .dark\\:text-slate-400 { color: #94a3b8 !important; }
        .ck-shift-report .text-red-600, .ck-shift-report .dark\\:text-red-400 { color: #ef4444 !important; }
        .ck-shift-report .bg-red-600, .ck-shift-report .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
        .ck-shift-report .bg-green-600, .ck-shift-report .bg-green-500 { background-color: #34d399 !important; color: #0B1121 !important; font-weight: 800 !important; }
        .ck-shift-report .border-slate-200, .ck-shift-report .dark\\:border-slate-700, .ck-shift-report .border-slate-300 { border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-shift-report input, .ck-shift-report select { background-color: #1C2841 !important; color: #f8fafc !important; border: 1px solid rgba(34, 211, 238, 0.25) !important; border-radius: 12px !important; }
        .ck-shift-report input:focus, .ck-shift-report select:focus { border-color: #22d3ee !important; box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.2) !important; outline: none !important; }
        .ck-shift-report h2 { color: #22d3ee !important; }
        .ck-pinpad button { background-color: #1C2841 !important; color: #f8fafc !important; border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-pinpad button:active { background-color: rgba(34, 211, 238, 0.1) !important; border-color: rgba(34, 211, 238, 0.25) !important; color: #22d3ee !important; }
        .ck-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0B1121; border-top: 1px solid rgba(34,211,238,0.15); display: flex; align-items: center; justify-content: space-around; padding: 10px 8px 22px; z-index: 100; }
        .ck-bottom-nav > div { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; min-width: 60px; }
        .ck-bottom-nav > div.active { color: #22d3ee; }
        .ck-bottom-nav > div svg { flex-shrink: 0; }
      `}</style>

        <SkeletonList />
      </div>
    );
  }

  if (!unlocked) {
    return (
    <div className="ck-shift-report min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/40 flex flex-col items-center justify-center pt-8 pb-12 px-4 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
      <style>{`
        .ck-shift-report { background-color: #0B1121 !important; color: #f8fafc !important; color-scheme: dark !important; min-height: 100dvh; }
        .ck-shift-report .bg-white, .ck-shift-report .dark\\:bg-slate-800, .ck-shift-report .dark\\:bg-slate-800\\/80, .ck-shift-report .dark\\:bg-slate-900, .ck-shift-report .bg-slate-100 { background-color: #151E32 !important; border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-shift-report .bg-slate-50, .ck-shift-report .dark\\:bg-slate-950\\/20, .ck-shift-report .dark\\:bg-slate-950 { background-color: #0B1121 !important; }
        .ck-shift-report .text-slate-800, .ck-shift-report .text-slate-900, .ck-shift-report .dark\\:text-white, .ck-shift-report .dark\\:text-slate-100 { color: #f8fafc !important; }
        .ck-shift-report .text-slate-500, .ck-shift-report .text-slate-600, .ck-shift-report .dark\\:text-slate-400 { color: #94a3b8 !important; }
        .ck-shift-report .text-red-600, .ck-shift-report .dark\\:text-red-400 { color: #ef4444 !important; }
        .ck-shift-report .bg-red-600, .ck-shift-report .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
        .ck-shift-report .bg-green-600, .ck-shift-report .bg-green-500 { background-color: #34d399 !important; color: #0B1121 !important; font-weight: 800 !important; }
        .ck-shift-report .border-slate-200, .ck-shift-report .dark\\:border-slate-700, .ck-shift-report .border-slate-300 { border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-shift-report input, .ck-shift-report select { background-color: #1C2841 !important; color: #f8fafc !important; border: 1px solid rgba(34, 211, 238, 0.25) !important; border-radius: 12px !important; }
        .ck-shift-report input:focus, .ck-shift-report select:focus { border-color: #22d3ee !important; box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.2) !important; outline: none !important; }
        .ck-shift-report h2 { color: #22d3ee !important; }
        .ck-pinpad button { background-color: #1C2841 !important; color: #f8fafc !important; border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-pinpad button:active { background-color: rgba(34, 211, 238, 0.1) !important; border-color: rgba(34, 211, 238, 0.25) !important; color: #22d3ee !important; }
        .ck-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0B1121; border-top: 1px solid rgba(34,211,238,0.15); display: flex; align-items: center; justify-content: space-around; padding: 10px 8px 22px; z-index: 100; }
        .ck-bottom-nav > div { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; min-width: 60px; }
        .ck-bottom-nav > div.active { color: #22d3ee; }
        .ck-bottom-nav > div svg { flex-shrink: 0; }
      `}</style>

        <div className="w-full max-w-md space-y-6">
          
          {/* Language Toggle */}
          <div className="flex justify-end">
            <button 
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/50 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "English"}
            </button>
          </div>

          {/* Title */}
          <div className="text-center py-2 mb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4 shadow-xl shadow-red-500/30">
              <Lock className="h-8 w-8 text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {dict.shiftAccess}
            </h1>
            <p className="text-xs text-red-600 dark:text-red-400 font-bold tracking-widest mt-2 uppercase">
              {dict.authorizedOnly}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md p-6 sm:p-8 rounded-3xl space-y-6 border border-slate-200/70 dark:border-slate-800/60 shadow-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
                <UserIcon className="h-4 w-4 text-slate-400" /> {dict.cashierName}
              </label>
              <div className="relative">
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-805/50 text-slate-900 dark:text-white outline-none focus:border-red-500 text-base cursor-pointer flex justify-between items-center transition-all"
                >
                  <span className={!selectedCashierId ? "text-slate-400 dark:text-slate-505" : "font-bold"}>
                    {selectedCashierId 
                      ? (() => {
                          const c = cashiers.find(x => x.id === selectedCashierId);
                          return c ? `${c.name} (${lang === "en" ? "Store" : "فرع"}: ${c.storeId})` : dict.selectName;
                        })()
                      : dict.selectName}
                  </span>
                  <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-[100] top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in duration-200">
                    {cashiers.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedCashierId(c.id); setIsDropdownOpen(false); }}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex flex-col gap-1 transition-colors"
                      >
                        <span className="font-bold text-slate-900 dark:text-white text-base">{c.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900/50 px-2 py-0.5 rounded-md w-fit">
                          {lang === "en" ? "Store" : "فرع"}: {c.storeId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center justify-center gap-1">
                <Lock className="h-4 w-4 text-slate-400" /> {dict.pin}
              </label>
              <PinPad 
                onPinChange={(val) => setPinInput(val)}
                onSubmit={(val) => handleUnlock(val)}
                maxLength={4}
              />
            </div>
          </form>
        </div>
      </div>
    );
  }

  const activeCashier = cashiers.find(x => x.id === selectedCashierId);

  return (
    <div className="ck-shift-report min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-52" dir={lang === "ar" ? "rtl" : "ltr"}>
      <style>{`
        .ck-shift-report { background-color: #0B1121 !important; color: #f8fafc !important; color-scheme: dark !important; min-height: 100dvh; }
        .ck-shift-report .bg-white, .ck-shift-report .dark\\:bg-slate-800, .ck-shift-report .dark\\:bg-slate-800\\/80, .ck-shift-report .dark\\:bg-slate-900, .ck-shift-report .bg-slate-100 { background-color: #151E32 !important; border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-shift-report .bg-slate-50, .ck-shift-report .dark\\:bg-slate-950\\/20, .ck-shift-report .dark\\:bg-slate-950 { background-color: #0B1121 !important; }
        .ck-shift-report .text-slate-800, .ck-shift-report .text-slate-900, .ck-shift-report .dark\\:text-white, .ck-shift-report .dark\\:text-slate-100 { color: #f8fafc !important; }
        .ck-shift-report .text-slate-500, .ck-shift-report .text-slate-600, .ck-shift-report .dark\\:text-slate-400 { color: #94a3b8 !important; }
        .ck-shift-report .text-red-600, .ck-shift-report .dark\\:text-red-400 { color: #ef4444 !important; }
        .ck-shift-report .bg-red-600, .ck-shift-report .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
        .ck-shift-report .bg-green-600, .ck-shift-report .bg-green-500 { background-color: #34d399 !important; color: #0B1121 !important; font-weight: 800 !important; }
        .ck-shift-report .border-slate-200, .ck-shift-report .dark\\:border-slate-700, .ck-shift-report .border-slate-300 { border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-shift-report input, .ck-shift-report select { background-color: #1C2841 !important; color: #f8fafc !important; border: 1px solid rgba(34, 211, 238, 0.25) !important; border-radius: 12px !important; }
        .ck-shift-report input:focus, .ck-shift-report select:focus { border-color: #22d3ee !important; box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.2) !important; outline: none !important; }
        .ck-shift-report h2 { color: #22d3ee !important; }
        .ck-pinpad button { background-color: #1C2841 !important; color: #f8fafc !important; border-color: rgba(34, 211, 238, 0.15) !important; }
        .ck-pinpad button:active { background-color: rgba(34, 211, 238, 0.1) !important; border-color: rgba(34, 211, 238, 0.25) !important; color: #22d3ee !important; }
        .ck-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0B1121; border-top: 1px solid rgba(34,211,238,0.15); display: flex; align-items: center; justify-content: space-around; padding: 10px 8px 22px; z-index: 100; }
        .ck-bottom-nav > div { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; min-width: 60px; }
        .ck-bottom-nav > div.active { color: #22d3ee; }
        .ck-bottom-nav > div svg { flex-shrink: 0; }
      `}</style>

      
      {/* Header */}
      <motion.header 
        style={{ height: headerHeight }}
        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 px-4 sticky top-0 z-10 flex items-center overflow-hidden"
      >
        <motion.div style={{ y: parallaxY }} className="max-w-4xl mx-auto flex items-center justify-between w-full relative">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => router.push("/cashier")}
              className="flex items-center gap-1 text-slate-555 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <ArrowLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
              <span className="font-bold text-sm hidden sm:inline">{lang === "en" ? "Back" : "رجوع"}</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <motion.div style={{ opacity: titleOpacity, scale: titleScale, y: titleY }} className="absolute left-10 sm:static origin-left">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 dark:text-white leading-none whitespace-nowrap">{dict.dailyReport}</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1 whitespace-nowrap">{new Date().toLocaleDateString('en-GB')}</p>
            </motion.div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 z-10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full pl-2">
            <button 
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/60 cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5" /> {lang === "en" ? "عربي" : "EN"}
            </button>
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30 text-white font-black shadow-md shadow-red-500/10">
              K
            </div>
          </div>
        </motion.div>
      </motion.header>

      {showRadar && (
        <RadarOfflineScreen 
          isReconnecting={syncing} 
          onDismiss={() => setShowRadar(false)} 
          reportCount={offlineCount} 
        />
      )}

      {/* Offline Status Bar */}
      {(isOffline || offlineCount > 0) && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div 
            onClick={() => setShowRadar(true)}
            className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold text-white shadow-md cursor-pointer transition-all hover:scale-[1.01] ${isOffline ? 'bg-orange-500 shadow-orange-500/10' : 'bg-blue-600 shadow-blue-600/10'}`}
          >
            <div className="flex items-center gap-2">
              {isOffline ? <WifiOff className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
              <span>
                {isOffline 
                  ? (lang === 'en' ? "Offline Mode Active (Auto-saves locally)" : "وضع عدم الاتصال نشط (سيتم الحفظ محلياً)") 
                  : (syncing ? (lang === 'en' ? "Syncing offline reports..." : "جاري مزامنة التقارير...") : (lang === 'en' ? "Internet Restored" : "عاد الاتصال بالإنترنت"))
                }
              </span>
            </div>
            {offlineCount > 0 && (
              <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-[10px] font-black">
                {offlineCount} {lang === 'en' ? "pending" : "معلق"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {rejectReason && reportStatus === "rejected" && (
          <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 p-5 rounded-2xl shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl flex-shrink-0 text-red-600 dark:text-red-400">
                <Lock className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-red-900 dark:text-red-400 font-bold text-sm sm:text-base">{dict.rejectedTitle}</h3>
                <p className="text-red-750 dark:text-red-300 text-xs sm:text-sm mt-1 font-semibold leading-relaxed">
                  <span className="font-black text-red-900 dark:text-red-400">{dict.reasonLabel}:</span> "{rejectReason}"
                </p>
                <p className="text-red-600 dark:text-red-400 text-[10px] sm:text-xs mt-3 font-bold uppercase tracking-wider">
                  {dict.rejectedSubtitle}
                </p>
              </div>
            </div>
          </div>
        )}

        {disputeReason && reportStatus === "disputed" && (
          <div className="bg-purple-50 dark:bg-purple-950/10 border-2 border-purple-500 p-5 rounded-2xl shadow-lg animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-xl flex-shrink-0 text-purple-600 dark:text-purple-400">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </div>
              <div className="w-full">
                <h3 className="text-purple-900 dark:text-purple-400 font-black text-sm sm:text-base uppercase tracking-wider">Report Flagged For Investigation</h3>
                <p className="text-purple-800 dark:text-purple-300 text-xs sm:text-sm mt-2 font-medium leading-relaxed bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                  <span className="font-black text-purple-900 dark:text-purple-400">Manager's Note:</span> "{disputeReason}"
                </p>
                
                <div className="mt-4">
                  <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 uppercase mb-2">
                    Cashier Write-Up / Explanation (Required)
                  </label>
                  <textarea 
                    required
                    value={cashierWriteUp}
                    onChange={(e) => setCashierWriteUp(e.target.value)}
                    placeholder="Please explain the shortage/issue in detail..."
                    className="w-full p-4 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none min-h-[120px] font-medium resize-y"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {earlyDayRequest && (
          <div className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-500 p-5 rounded-2xl shadow-lg animate-pulse">
            <div className="flex items-start gap-3.5">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-xl flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-indigo-900 dark:text-indigo-400 font-black text-sm sm:text-base uppercase tracking-wider">Early Day Drop Requested</h3>
                <p className="text-indigo-750 dark:text-indigo-300 text-xs sm:text-sm mt-1 font-semibold leading-relaxed">
                  Your manager has requested an early shift report 
                  {earlyDayRequest.targetDate && ` for Date: ${earlyDayRequest.targetDate}`}
                  {earlyDayRequest.targetShift && ` and Shift: ${earlyDayRequest.targetShift}`}.
                  <br/>
                  <span className="font-black text-indigo-900 dark:text-indigo-300 mt-2 block">You must submit your report immediately.</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">{lang === "en" ? "Logged In Cashier" : "الكاشير المسجل"}</p>
              <p className="font-bold text-slate-800 dark:text-white text-base leading-none mt-1">{activeCashier?.name}</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={() => router.push('/voids/cashier')}
            className="w-full sm:w-auto flex items-center justify-between bg-slate-900 hover:bg-slate-800 dark:bg-slate-850 dark:hover:bg-slate-700 text-white px-5 py-3.5 rounded-2xl font-bold shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="text-left font-bold text-xs sm:text-sm">
                {lang === 'en' ? "Log a Void / Return" : "تسجيل مرتجع / إلغاء"}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-800 dark:bg-slate-700 px-2 py-0.5 rounded-md">NEW</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Shift Info & Cash breakdown */}
            <div className="space-y-6">
              
              {/* 1. Shift Info */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <Clock className="h-5 w-5 text-red-500" />
                  <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.shiftInfo}</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {dict.date}
                    </label>
                    <input required type="date" value={date} readOnly className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 outline-none cursor-not-allowed text-xs sm:text-sm font-semibold" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {dict.shift}
                    </label>
                    <div className="relative">
                      <select 
                        value={shift} 
                        onChange={(e) => setShift(e.target.value)} 
                        disabled={assignedShiftType !== "All"}
                        className={`w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-semibold outline-none appearance-none ${
                          assignedShiftType !== "All" 
                            ? "bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 cursor-not-allowed opacity-80" 
                            : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-red-500"
                        }`}
                      >
                        <option value="Morning">{dict.morning}</option>
                        <option value="Noon">{dict.noon}</option>
                        <option value="Night">{dict.night}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5" /> {dict.role}
                    </label>
                    <div className="relative">
                      <select value={cashierRole} onChange={(e) => setCashierRole(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none appearance-none font-bold focus:ring-2 focus:ring-red-500 text-xs sm:text-sm cursor-pointer">
                        <option value={1}>{dict.role1}</option>
                        <option value={2}>{dict.role2}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.storeId}</label>
                  <div className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 font-mono text-xs sm:text-sm font-semibold">
                    {activeCashier?.storeId}
                  </div>
                </div>
              </section>

              {/* 2. Cashier Money (Drops) */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <Banknote className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.drops}</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3.5 tracking-wider">{lang === "en" ? "Cash Breakdown (Quantities)" : "تفاصيل النقدية (العدد)"}</p>
                    
                    <div className="flex flex-col gap-3">
                      {[200, 100, 50, 20, 10, 5].map((bill) => (
                        <div key={bill} className="flex items-center justify-between gap-4">
                          <span className="w-16 text-sm font-bold text-slate-555 dark:text-slate-400 font-mono">x EGP {bill}</span>
                          <NumericFormat 
                            autoFocus={bill === 200}
                            value={denominations[String(bill) as keyof typeof denominations]} 
                            onValueChange={(values) => setDenominations({...denominations, [String(bill)]: values.value})}
                            thousandSeparator=","
                            allowNegative={false}
                            decimalScale={0}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 text-right text-base sm:text-lg font-bold transition-all"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      
                      <div className="flex items-center justify-between gap-4 mt-2 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                        <span className="w-16 text-sm font-bold text-slate-555 dark:text-slate-400 font-mono">{lang === "en" ? "Coins" : "قروش/فكة"}</span>
                        <NumericFormat 
                          value={denominations['coins']} 
                          onValueChange={(values) => setDenominations({...denominations, 'coins': values.value})}
                          thousandSeparator=","
                          allowNegative={false}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          inputMode="decimal"
                          className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 text-right text-base sm:text-lg font-bold transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <span className="font-bold text-sm text-emerald-800 dark:text-emerald-450 uppercase">{lang === "en" ? "Total Cash" : "إجمالي النقدية"}</span>
                    <span className="font-black text-xl text-emerald-600 dark:text-emerald-450 font-mono">EGP {calculateTotalCash().toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.totalVisa}</label>
                    <div className="relative">
                      <span className={`absolute ${lang === "ar" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs sm:text-sm`}>EGP</span>
                      <NumericFormat 
                        value={visa} 
                        onValueChange={(values) => setVisa(values.value)}
                        thousandSeparator=","
                        allowNegative={false}
                        decimalScale={2}
                        inputMode="decimal"
                        fixedDecimalScale={true}
                        className={`w-full ${lang === "ar" ? "pr-14" : "pl-14"} p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg font-mono font-bold text-blue-600 dark:text-blue-450 transition-all`} 
                        placeholder="0.00" 
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border-dashed">
                    <span className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dict.totalDrops}</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">EGP {calculateTotalMoney().toFixed(2)}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Inventory & Signature */}
            <div className="space-y-6">
              
              {/* 3. Inventory Checks */}
              {cashierRole === 1 && (
                <section className="glass-panel p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                    <Package className="h-5 w-5 text-orange-500" />
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.inventory}</h2>
                  </div>
                  
                  {/* Detailed Cigarettes moved to Step 2 */}



                  {/* Lighters */}
                  <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 animate-in fade-in">
                    <h3 className="font-bold text-slate-700 dark:text-slate-350 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest text-[10px]">{dict.lighters}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1">{dict.start}</label>
                        <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.start} onChange={(e) => setLighters({ ...lighters, start: e.target.value })} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono text-xs sm:text-sm font-bold" />
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1 text-emerald-500">{dict.delivery}</label>
                        <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.delivery} onChange={(e) => setLighters({ ...lighters, delivery: e.target.value })} className="w-full p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-455" />
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1 text-red-500">{dict.end}</label>
                        <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.end} onChange={(e) => setLighters({ ...lighters, end: e.target.value })} className="w-full p-2 rounded-lg border border-red-500/20 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-xs sm:text-sm font-bold text-red-600 dark:text-red-455" />
                      </div>
                      <div className="bg-slate-900 rounded-lg p-1.5 text-center border border-slate-800 flex flex-col justify-center">
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mb-0.5">{dict.soldUnits}</label>
                        <span className="font-black text-white text-xs sm:text-sm font-mono leading-none">{calculateSold(lighters.start, lighters.delivery, lighters.end)}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Signature Capture */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <UserIcon className="h-5 w-5 text-red-500" />
                  <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.signYourReport}</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{dict.signBelow}</p>
                <div className="border border-border rounded-xl overflow-hidden bg-white touch-none">
                  <SignaturePad 
                    // @ts-expect-error: dynamic import ref typing mismatch
                    ref={sigPadRef}
                    onBegin={() => setHasSigned(true)}
                    canvasProps={{ className: "w-full h-[150px] sm:h-[200px] cursor-crosshair touch-none" }} 
                  />
                </div>
                <button type="button" onClick={() => { sigPadRef.current?.clear(); setHasSigned(false); setCashierSignature(""); }} className="text-xs text-red-500 font-bold uppercase hover:underline">
                  {dict.clearSignature || "Clear Signature"}
                </button>
                <input type="text" value={cashierSignature} readOnly className="h-0 w-0 opacity-0 absolute pointer-events-none" tabIndex={-1} />
              </section>
            </div>
          </div>
          )}

          {step === 2 && cashierRole === 1 && (
            <div className="max-w-3xl mx-auto space-y-6">
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-500" />
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.cigarettes}</h2>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-orange-500/10 text-orange-600 rounded">Step 2 of 2</span>
                </div>
                
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Please enter the start, delivery, and end quantities for all cigarettes accurately.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CIGARETTE_TYPES.map((type) => {
                      const counts = cigaretteCounts[type.id] || { start: "", delivery: "", end: "" };
                      return (
                        <div key={type.id} className="bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 transition-all hover:border-orange-500/30">
                          <label className="text-sm font-black text-slate-800 dark:text-slate-200 block mb-3 border-b border-slate-100 dark:border-slate-800 pb-2" title={type[lang]}>
                            {type[lang]}
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{dict.start}</label>
                              <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={counts.start} onChange={(e) => setCigaretteCounts({ ...cigaretteCounts, [type.id]: { ...counts, start: e.target.value } })} className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono text-sm font-bold" />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-emerald-500 uppercase mb-1">{dict.delivery}</label>
                              <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={counts.delivery} onChange={(e) => setCigaretteCounts({ ...cigaretteCounts, [type.id]: { ...counts, delivery: e.target.value } })} className="w-full p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-sm font-bold text-emerald-600" />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-red-500 uppercase mb-1">{dict.end}</label>
                              <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={counts.end} onChange={(e) => setCigaretteCounts({ ...cigaretteCounts, [type.id]: { ...counts, end: e.target.value } })} className="w-full p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-sm font-bold text-red-600" />
                            </div>
                            <div className="bg-slate-900 dark:bg-black rounded-lg p-2 text-center border border-slate-800 flex flex-col justify-center">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">{dict.soldUnits}</label>
                              <span className="font-black text-white text-base font-mono leading-none">{calculateSold(counts.start, counts.delivery, counts.end)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Footer inside the form to allow submit trigger */}
          <div className="fixed left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]" style={{ bottom: "74px", zIndex: 90 }}>
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="hidden sm:block">
                <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider leading-none">{lang === "en" ? "Ready Status" : "حالة التقرير"}</p>
                <p className="text-xs font-bold text-emerald-650 dark:text-emerald-450 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" /> {lang === "en" ? "Ready to Submit" : "جاهز للإرسال"}
                </p>
              </div>
              
              {step === 1 && cashierRole === 1 ? (
                <button type="button" onClick={() => {
                  if (hasSigned && sigPadRef.current) {
                    setCashierSignature(sigPadRef.current.toDataURL());
                    setStep(2);
                  } else {
                    vibrateError();
                    toast.warning(lang === 'en' ? "Please sign your report before continuing." : "يرجى توقيع التقرير قبل المتابعة.");
                  }
                }} className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2">
                  Next Step: Cigarettes <ArrowRight className="h-4.5 w-4.5" />
                </button>
              ) : (
                <div className="flex gap-3 w-full sm:w-auto">
                  {step === 2 && (
                    <button type="button" onClick={() => setStep(1)} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition-all">
                      Back
                    </button>
                  )}
                  <button type="submit" disabled={loading} className={`w-full sm:w-auto px-8 py-3.5 ${loading ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98] cursor-pointer'} text-white rounded-xl font-bold text-base shadow-lg shadow-red-500/15 transition-all flex items-center justify-center gap-2`}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        {dict.submitting}
                      </>
                    ) : (
                      <>
                        {existingReportId ? dict.resubmit : dict.submit}
                        <ArrowRight className={`h-4.5 w-4.5 ${lang === "ar" ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </main>
      
      <SafeDropVault 
        isDropping={isDroppingSafe} 
        onComplete={() => {
          router.push("/cashier");
        }}
      />
    
      {/* Bottom Navigation */}
      <CashierBottomNav lang={lang} />

    </div>
  );
}
