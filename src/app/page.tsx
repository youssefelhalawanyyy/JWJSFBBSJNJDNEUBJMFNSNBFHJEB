"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useLiveSafeBalance } from "@/lib/financial-sync";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Activity, 
  CalendarDays, 
  PackageMinus, 
  Shield, 
  Truck, 
  ClipboardList, 
  Search, 
  ShoppingCart, 
  Sparkles, 
  Package, 
  Tag, 
  Barcode, 
  Users, 
  DollarSign, 
  Landmark,
  Clock, 
  Bot, 
  Monitor, 
  Database, 
  Bell, 
  ArrowRight, 
  ArrowLeft, 
  Briefcase, 
  SendHorizontal, 
  Lock, 
  Sparkle, 
  UserCheck, 
  ArrowUpRight,
  Crown,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Layers,
  Building2,
  Check,
  Zap,
  Radio,
  LogOut
} from "lucide-react";
import { useBranch, BRANCHES } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, limit, deleteDoc } from "firebase/firestore";
import NotificationBell from "@/components/NotificationBell";

interface ToolItem {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeType?: "danger" | "warning" | "success" | "neutral" | "admin";
  color: string;
}

interface Department {
  id: "financials" | "operations" | "products" | "hr" | "admin";
  nameAr: string;
  nameEn: string;
  headlineAr: string;
  headlineEn: string;
  descAr: string;
  descEn: string;
  accentColor: string; // emerald, amber, purple, sky, rose
  gradient: string;
  borderGlow: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  tools: ToolItem[];
}

const BRANCH_NAMES_AR: Record<string, string> = {
  alamein4: "العلمين 4",
  ola: "علا القرنفل",
  all: "كافة الفروع",
};

interface DayTrendPoint {
  date: string;
  dayName: string;
  dayNameAr: string;
  displayDate: string;
  total: number;
  cash: number;
  visa: number;
}

const matchesBranch = (docData: any, targetBranch: string): boolean => {
  if (!targetBranch || targetBranch === "all") return true;
  const docBranch = (docData.storeId || docData.branchId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = targetBranch.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!docBranch) return true;
  return docBranch.includes(target) || target.includes(docBranch);
};

export default function VIPBentoEnterprisePortal() {
  const { currentBranch, setBranch } = useBranch();
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";
  
  const [time, setTime] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState<string>("admin"); // Default to admin
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("all");

  // Live real-time stats from Firestore
  const [pendingVoids, setPendingVoids] = useState<number>(0);
  const [pendingExpiries, setPendingExpiries] = useState<number>(0);
  const [pendingReturns, setPendingReturns] = useState<number>(0);
  const [outOfStockCount, setOutOfStockCount] = useState<number>(0);
  const [activeStaffCount, setActiveStaffCount] = useState<number>(0);
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [offStaff, setOffStaff] = useState<any[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<number>(3);
  const { safeBalance, bankBalance } = useLiveSafeBalance(currentBranch);

  // Real 7-Day Sales Telemetry State
  const [weeklySales, setWeeklySales] = useState<DayTrendPoint[]>([]);
  const [weeklyTotalSales, setWeeklyTotalSales] = useState<number>(0);
  const [weeklyAvgSales, setWeeklyAvgSales] = useState<number>(0);
  const [weeklyTrendPct, setWeeklyTrendPct] = useState<number>(0);
  const [salesLoading, setSalesLoading] = useState<boolean>(true);
  const [hoveredDay, setHoveredDay] = useState<DayTrendPoint | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);

  // Live clock
  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auth & Admin check
  useEffect(() => {
    const savedRole = localStorage.getItem("circlek_role");
    const savedName = localStorage.getItem("circlek_user_name");
    if (savedRole) setUserRole(savedRole);
    if (savedName) setUserName(savedName);

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserEmail(u.email || "");
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            const r = data.role || data.features?.role || savedRole || "admin";
            setUserRole(r);
            localStorage.setItem("circlek_role", r);
            const n = data.displayName || data.name || u.displayName || "Manager";
            setUserName(n);
          } else {
            const r = (u.email?.includes("admin") || u.email?.includes("halawany") || u.email?.includes("youssef")) ? "admin" : (savedRole || "admin");
            setUserRole(r);
          }
        } catch (e) {
          console.warn("Could not fetch user role", e);
        }
      }
    });

    const handleRoleChanged = (e: any) => {
      if (e.detail) setUserRole(e.detail);
    };
    window.addEventListener("circlek_role_changed", handleRoleChanged);

    return () => {
      unsubAuth();
      window.removeEventListener("circlek_role_changed", handleRoleChanged);
    };
  }, []);

  // Live Firestore counters & Real Telemetry
  useEffect(() => {
    // 0. Hydrate weekly sales from cache
    if (typeof window !== "undefined") {
      try {
        const cachedSales = localStorage.getItem(`cached_weekly_sales_${currentBranch}`);
        if (cachedSales) {
          const parsed = JSON.parse(cachedSales);
          if (parsed.points && Array.isArray(parsed.points)) {
            setWeeklySales(parsed.points);
            setWeeklyTotalSales(parsed.sumTotal || 0);
            setWeeklyAvgSales(parsed.avg || 0);
            setWeeklyTrendPct(parsed.pct || 0);
            setSalesLoading(false);
          }
        }
      } catch (e) {}
    }

    // 1. Pending Voids
    const voidQ = currentBranch === "all"
      ? query(collection(db, "void_requests"), where("status", "==", "pending"), limit(50))
      : query(collection(db, "void_requests"), where("status", "==", "pending"), where("branchId", "==", currentBranch), limit(50));

    const unsubVoids = onSnapshot(voidQ, (snap) => {
      setPendingVoids(snap.docs.length);
    }, () => {});

    // 2. Expiries (Total Expired & Near-Expiry)
    const expQ = query(collection(db, "expiries"), limit(100));
    const unsubExp = onSnapshot(expQ, (snap) => {
      let count = 0;
      const todayStr = new Date().toISOString().split("T")[0];
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.status === "pulled" || data.status === "expired" || data.status === "near") {
          count++;
        } else if (data.expiryDate && data.expiryDate <= todayStr) {
          count++;
        }
      });
      setPendingExpiries(count);
    }, () => {});

    // 3. Returns
    const retQ = query(collection(db, "supplier_returns"), where("status", "in", ["pending", "returned"]), limit(20));
    const unsubRet = onSnapshot(retQ, (snap) => {
      setPendingReturns(snap.docs.length);
    }, () => {});

    // 4. Out of Stock
    const oosQ = query(collection(db, "out_of_stock_logs"), where("resolved", "==", false), limit(20));
    const unsubOos = onSnapshot(oosQ, (snap) => {
      setOutOfStockCount(snap.docs.length);
    }, () => {});

    // 5. Employees count & real off staff tracking
    const empQ = query(collection(db, "employees"), limit(100));
    const unsubEmp = onSnapshot(empQ, (snap) => {
      const emps: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const branchEmps = currentBranch === "all" ? emps : emps.filter(e => {
        const sid = (e.storeId || e.branchId || "").toLowerCase();
        const inferred = sid.includes("ola") || sid.includes("koronfol") ? "ola" : "alamein4";
        return inferred === currentBranch;
      });

      const active = branchEmps.filter(e => {
        const st = (e.status || "active").toLowerCase().trim();
        return st === "active";
      });

      const off = branchEmps.filter(e => {
        const st = (e.status || "").toLowerCase().trim();
        const sft = (e.shiftTime || "").toLowerCase().trim();
        return st === "off" || st === "vacation" || sft === "off";
      });

      setActiveStaff(active);
      setOffStaff(off);
      setActiveStaffCount(active.length);
    }, () => {});

    // 6. Active sessions
    const devQ = query(collection(db, "active_sessions"), limit(20));
    const unsubDev = onSnapshot(devQ, (snap) => {
      if (snap.docs.length > 0) setConnectedDevices(snap.docs.length);
    }, () => {});

    // 7. Real 7-Day Sales Telemetry
    const salesQ = query(collection(db, "sales"), limit(250));
    const unsubSales = onSnapshot(salesQ, (snap) => {
      const rawSales = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const branchSales = rawSales.filter(s => matchesBranch(s, currentBranch));

      const salesByDate = new Map<string, { cash: number; visa: number; total: number }>();
      branchSales.forEach(s => {
        let sDate = s.date;
        if (!sDate && s.createdAt?.toDate) {
          sDate = s.createdAt.toDate().toISOString().split("T")[0];
        }
        if (!sDate || typeof sDate !== "string") return;
        sDate = sDate.trim().substring(0, 10);

        if (!salesByDate.has(sDate)) {
          salesByDate.set(sDate, { cash: 0, visa: 0, total: 0 });
        }
        const rec = salesByDate.get(sDate)!;
        const c = Number(s.cash || 0);
        const v = Number(s.visa || 0);
        rec.cash += c;
        rec.visa += v;
        rec.total += c + v;
      });

      const today = new Date();
      const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayNamesAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

      // Check if any sales exist in the last 7 calendar days
      let anchorDate = new Date(today);
      const recordedDates = Array.from(salesByDate.keys()).sort();
      let hasRecentSales = false;
      for (let i = 0; i < 7; i++) {
        const testD = new Date(today);
        testD.setDate(today.getDate() - i);
        const y = testD.getFullYear();
        const m = String(testD.getMonth() + 1).padStart(2, "0");
        const d = String(testD.getDate()).padStart(2, "0");
        if (salesByDate.has(`${y}-${m}-${d}`)) {
          hasRecentSales = true;
          break;
        }
      }

      // If no sales in current calendar week, anchor to latest recorded shift date
      if (!hasRecentSales && recordedDates.length > 0) {
        const latestStr = recordedDates[recordedDates.length - 1];
        const parts = latestStr.split("-").map(Number);
        if (parts.length === 3 && !isNaN(parts[0])) {
          anchorDate = new Date(parts[0], parts[1] - 1, parts[2]);
        }
      }

      const points: DayTrendPoint[] = [];
      let sumTotal = 0;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchorDate);
        d.setDate(anchorDate.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dayNum = String(d.getDate()).padStart(2, "0");
        const dStr = `${y}-${m}-${dayNum}`;

        const dayData = salesByDate.get(dStr) || { cash: 0, visa: 0, total: 0 };
        sumTotal += dayData.total;
        points.push({
          date: dStr,
          dayName: dayNamesEn[d.getDay()],
          dayNameAr: dayNamesAr[d.getDay()],
          displayDate: `${dayNum}/${m}`,
          total: dayData.total,
          cash: dayData.cash,
          visa: dayData.visa
        });
      }

      // Trend %: compare second half of week to first half
      const firstHalf = (points[0].total + points[1].total + points[2].total) / 3;
      const secondHalf = (points[3].total + points[4].total + points[5].total + points[6].total) / 4;
      let pct = 0;
      if (firstHalf > 0) {
        pct = ((secondHalf - firstHalf) / firstHalf) * 100;
      } else if (secondHalf > 0) {
        pct = 100;
      }

      const avg = sumTotal > 0 ? Math.round(sumTotal / 7) : 0;
      const roundedPct = Math.round(pct * 10) / 10;

      setWeeklySales(points);
      setWeeklyTotalSales(sumTotal);
      setWeeklyAvgSales(avg);
      setWeeklyTrendPct(roundedPct);
      setSalesLoading(false);

      try {
        localStorage.setItem(`cached_weekly_sales_${currentBranch}`, JSON.stringify({
          points,
          sumTotal,
          avg,
          pct: roundedPct
        }));
      } catch (e) {}
    }, (err) => {
      console.warn("Weekly sales listener error:", err);
      setSalesLoading(false);
    });

    return () => {
      unsubVoids();
      unsubExp();
      unsubRet();
      unsubOos();
      unsubEmp();
      unsubDev();
      unsubSales();
    };
  }, [currentBranch]);

  // Real 7-Day Sales SVG Curve & Telemetry Math
  const { svgCurve, svgArea, chartPoints } = useMemo(() => {
    if (weeklySales.length === 0) {
      return { svgCurve: "", svgArea: "", chartPoints: [] };
    }

    const values = weeklySales.map(p => p.total);
    const max = Math.max(...values, 1);
    const width = 500;
    const height = 75;
    const paddingX = 20;
    const paddingY = 14;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;

    const pts = weeklySales.map((p, i) => {
      const x = paddingX + (i / (weeklySales.length - 1)) * usableW;
      const ratio = max > 0 ? p.total / max : 0;
      const y = (height - paddingY) - ratio * usableH;
      return { x, y, ...p };
    });

    let curve = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cpX = ((curr.x + next.x) / 2).toFixed(1);
      curve += ` C ${cpX},${curr.y.toFixed(1)} ${cpX},${next.y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
    }

    const lastPt = pts[pts.length - 1];
    const firstPt = pts[0];
    const area = `${curve} L ${lastPt.x.toFixed(1)},${height} L ${firstPt.x.toFixed(1)},${height} Z`;

    return { svgCurve: curve, svgArea: area, chartPoints: pts };
  }, [weeklySales]);

  // Is Admin/Owner: True unless explicitly and strictly a non-admin role
  const isAdmin = useMemo(() => {
    const r = (userRole || "").toLowerCase();
    const e = (userEmail || "").toLowerCase();
    if (r === "owner" || r === "admin" || r === "admin_editor" || r === "admin_viewer") return true;
    if (e.includes("admin") || e.includes("halawany") || e.includes("youssef")) return true;
    return r !== "manager";
  }, [userRole, userEmail]);

  const branchObj = BRANCHES.find((b) => b.id === currentBranch) || BRANCHES[0];

  // 5 CORE DEPARTMENTS DEFINITION WITH ALL 31 TOOLS
  const departments: Department[] = useMemo(() => [
    {
      id: "financials",
      nameAr: "الماليات والخزائن",
      nameEn: "Financials & Vault",
      headlineAr: "تقفيل الخزائن ومتابعة المبيعات اليومية",
      headlineEn: "Safe Balancing & Daily Revenue Telemetry",
      descAr: "تسجيل عهد الكاشير، تدقيق الخزائن، تفاصيل الفواتير، وحساب الأرباح",
      descEn: "Cashier float inputs, safe balance, sales reports, and margin strategy",
      accentColor: "emerald",
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      borderGlow: "border-emerald-500/30 hover:border-emerald-400/60",
      icon: Wallet,
      tools: [
        {
          id: "inputs",
          nameAr: "مدخلات الخزينة اليومية",
          nameEn: "Daily Safe Inputs",
          descAr: "تسجيل جرد الخزينة وتقفيل شيفتات الكاشير",
          descEn: "Record daily safe float & cashier shift drops",
          href: "/financials/inputs",
          icon: Wallet,
          color: "text-emerald-400",
        },
        {
          id: "fin-reports",
          nameAr: "التقارير المالية المعتمدة",
          nameEn: "Financial Reports",
          descAr: "كشوفات الحسابات المعتمدة وتقارير الأداء",
          descEn: "Audited financial statements and P&L logs",
          href: "/financial-reports",
          icon: FileText,
          color: "text-emerald-400",
        },
        {
          id: "detailed-sales",
          nameAr: "تفاصيل المبيعات بالساعة",
          nameEn: "Detailed Sales",
          descAr: "تحليل حركة المبيعات وطرق الدفع (كاش/فيزا)",
          descEn: "Hourly sales analysis, payment split & volume",
          href: "/financials/detailed-sales",
          icon: Activity,
          color: "text-emerald-400",
        },
        {
          id: "month-summary",
          nameAr: "ملخص مبيعات الشهر",
          nameEn: "Month Summary",
          descAr: "مقارنات شهرية للأهداف والمبيعات التراكمية",
          descEn: "Month-to-date target vs actual sales breakdown",
          href: "/financial-reports/month-summary",
          icon: CalendarDays,
          color: "text-emerald-400",
        },
        {
          id: "out-of-stock",
          nameAr: "سجل النواقص المفقودة",
          nameEn: "Out of Stock Logs",
          descAr: "حصر الأصناف غير المتوفرة لتعويضها فوراً",
          descEn: "Zero-stock inventory tracker & alert system",
          href: "/financials/out-of-stock",
          icon: PackageMinus,
          badge: outOfStockCount > 0 ? `${outOfStockCount} OOS` : undefined,
          badgeType: "warning",
          color: "text-amber-400",
        },
        {
          id: "voids",
          nameAr: "الفواتير الملغاة والمرتجعات",
          nameEn: "Voids & Return Approvals",
          descAr: "اعتماد ومراقبة عمليات إلغاء الفواتير",
          descEn: "Cashier void requests & refund approvals",
          href: "/voids/manager",
          icon: Shield,
          badge: pendingVoids > 0 ? `${pendingVoids} Pending` : undefined,
          badgeType: "danger",
          color: "text-red-400",
        },
        {
          id: "shift-audit",
          nameAr: "تدقيق واعتماد الشيفتات",
          nameEn: "Shift Audit & Review",
          descAr: "مراجعة تقارير شيفتات الكاشير وعجز النقدية",
          descEn: "Cashier shift reconciliation & cash variance",
          href: "/shift-reports/manager",
          icon: CheckCircle2,
          color: "text-emerald-400",
        },
        {
          id: "margin-calc",
          nameAr: "حاسبة هوامش الربح",
          nameEn: "Margin Strategy Calculator",
          descAr: "تسعير المنتجات وتحليل نسبة الربح الإجمالي",
          descEn: "Gross margin optimization & retail pricing",
          href: "/dashboard/margin-calculator",
          icon: TrendingUp,
          color: "text-teal-400",
        },
      ],
    },
    {
      id: "operations",
      nameAr: "التشغيل وإدارة الفرع",
      nameEn: "Store Operations",
      headlineAr: "الفحص اليومي، النظافة، والمستندات",
      headlineEn: "Daily Audits, Food Safety & Checklists",
      descAr: "متابعة معايير النظافة وسرعة التشغيل وجودة الخدمة بالفرع",
      descEn: "Opening/closing checklists, cleaning protocols & store docs",
      accentColor: "amber",
      gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
      borderGlow: "border-amber-500/30 hover:border-amber-400/60",
      icon: Briefcase,
      tools: [
        {
          id: "checklists",
          nameAr: "التشيك لست اليومية للفرع",
          nameEn: "Store Checklists",
          descAr: "فحص الصباح، المساء، واشتراطات الجودة",
          descEn: "Opening, midday and handover operational checklists",
          href: "/checklists/manager",
          icon: ClipboardList,
          color: "text-amber-400",
        },
        {
          id: "manager-docs",
          nameAr: "المستندات الرسمية والتعاميم",
          nameEn: "Official Documents",
          descAr: "الخطابات المعتمدة من الإدارة وتراخيص الفرع",
          descEn: "Store licenses, official circulars & notices",
          href: "/manager/documents",
          icon: FileText,
          color: "text-amber-400",
        },
        {
          id: "cleaning",
          nameAr: "سجلات وجدول النظافة",
          nameEn: "Cleaning Schedules",
          descAr: "متابعة دورية لنظافة المكن والثلاجات والساحة",
          descEn: "Coffee machine, food contact & premise sanitation",
          href: "/admin/cleaning",
          icon: Sparkles,
          color: "text-amber-400",
        },
        {
          id: "lost-found",
          nameAr: "سجل المفقودات والأمانات",
          nameEn: "Lost & Found Log",
          descAr: "حفظ وتوثيق متعلقات العملاء وتسليمها",
          descEn: "Customer left-behind items logging & handover",
          href: "/admin/lost-and-found",
          icon: Package,
          color: "text-amber-400",
        },
        {
          id: "offers",
          nameAr: "إدارة وتفعيل العروض",
          nameEn: "Promotions & Offers",
          descAr: "ضبط فترات الحملات التسويقية والخصومات",
          descEn: "Promotional campaigns, combo deals & banners",
          href: "/admin/offers",
          icon: Tag,
          color: "text-amber-400",
        },
        {
          id: "food-codes",
          nameAr: "أكواد وباركود الفود كورت",
          nameEn: "Food Service Codes",
          descAr: "أكواد الكافيه، المخبوزات، والوجبات السريعة",
          descEn: "Bakery, beverage PLU quick lookup codes",
          href: "/admin/food-codes",
          icon: Barcode,
          color: "text-amber-400",
        },
      ],
    },
    {
      id: "products",
      nameAr: "المنتجات والمخزون",
      nameEn: "Products & Stock",
      headlineAr: "الصلاحيات، الجرد الأعمى، والتوريدات",
      headlineEn: "Near-Expiries, Blind Audits & Supply",
      descAr: "حماية هوامش الربح من الهوالك وتدقيق المخزون والموردين",
      descEn: "Expiry prevention, shrinkage control & vendor logistics",
      accentColor: "purple",
      gradient: "from-purple-500/20 via-indigo-500/10 to-transparent",
      borderGlow: "border-purple-500/30 hover:border-purple-400/60",
      icon: Package,
      tools: [
        {
          id: "expiries",
          nameAr: "فحص وتدقيق الصلاحيات",
          nameEn: "Expiries Audit Tracker",
          descAr: "متابعة تواريخ انتهاء الأصناف وتصريفها مبكراً",
          descEn: "Near-expiry tracking, write-offs & rotation",
          href: "/products/expiries-audit",
          icon: ClipboardList,
          badge: pendingExpiries > 0 ? `${pendingExpiries} Near` : undefined,
          badgeType: "warning",
          color: "text-purple-400",
        },
        {
          id: "product-lookup",
          nameAr: "البحث الفوري بالباركود",
          nameEn: "Barcode & Product Lookup",
          descAr: "كشف الأسعار والتفاصيل بمسح الباركود",
          descEn: "Instant price check & category verification",
          href: "/admin/product-lookup",
          icon: Search,
          color: "text-purple-400",
        },
        {
          id: "inventory-audit",
          nameAr: "الجرد الأعمى للمخزون",
          nameEn: "Blind Inventory Audit",
          descAr: "حصر ومطابقة الفعلي بالسيستم بدون معرفة الرصيد",
          descEn: "Blind stock counting to prevent shrinkage",
          href: "/inventory-audit/manager",
          icon: Shield,
          color: "text-purple-400",
        },
        {
          id: "supplier-orders",
          nameAr: "طلبيات بضاعة الموردين",
          nameEn: "Supplier Purchase Orders",
          descAr: "إنشاء ومتابعة أوامر الشراء من الشركات المعتمدة",
          descEn: "Direct purchase order dispatch to vendors",
          href: "/products/supplier-orders",
          icon: ShoppingCart,
          color: "text-purple-400",
        },
        {
          id: "supplier-returns",
          nameAr: "مرتجعات بضاعة الموردين",
          nameEn: "Supplier Returns (RTV)",
          descAr: "توثيق البضائع المرتجعة والمسترجعة للموردين",
          descEn: "Damaged/expired goods return to vendor tracking",
          href: "/dashboard/supplier-returns",
          icon: Truck,
          badge: pendingReturns > 0 ? `${pendingReturns} RTV` : undefined,
          badgeType: "neutral",
          color: "text-purple-400",
        },
      ],
    },
    {
      id: "hr",
      nameAr: "الموارد البشرية والرواتب",
      nameEn: "Human Resources",
      headlineAr: "ملفات الموظفين، المرتبات، والجدول",
      headlineEn: "Staff Files, Payroll & Shift Scheduling",
      descAr: "إدارة العقود، الحضور، السلف، مسير الرواتب الشهري، وطباعة المخالصات",
      descEn: "Employee master files, contracts, biometric schedules & payroll",
      accentColor: "sky",
      gradient: "from-sky-500/20 via-blue-500/10 to-transparent",
      borderGlow: "border-sky-500/30 hover:border-sky-400/60",
      icon: Users,
      adminOnly: false,
      tools: [
        {
          id: "employees",
          nameAr: "سجل الموظفين والعقود الرسمية",
          nameEn: "Employee Directory & Contracts",
          descAr: "بيانات الكادر، طباعة العقود، ونماذج المخالصات (A4)",
          descEn: "Full staff roster, contracts & 1-page A4 clearance forms",
          href: "/hr/employees",
          icon: Users,
          badge: "Full Access",
          badgeType: "admin",
          color: "text-sky-400",
        },
        {
          id: "cashier-pins",
          nameAr: "حسابات وبن كود الكاشير",
          nameEn: "Cashier Terminals & PINs",
          descAr: "تعيين وتحديث أرقام الدخول السرية لشاشات البيع",
          descEn: "Manage 4-digit POS PINs and shift permissions",
          href: "/settings/cashiers",
          icon: UserCheck,
          color: "text-sky-400",
        },
        {
          id: "payroll",
          nameAr: "مسير المرتبات والمستحقات",
          nameEn: "Payroll & Salary Distribution",
          descAr: "احتساب الرواتب الشهرية والبدلات والخصومات تلقائياً",
          descEn: "Automated monthly salary calculation & slips",
          href: "/admin/payroll",
          icon: DollarSign,
          color: "text-sky-400",
        },
        {
          id: "adjustments",
          nameAr: "السلف والخصومات والمكافآت",
          nameEn: "Staff Adjustments & Loans",
          descAr: "توثيق الخصومات المالية والسلف النقدية المعتمدة",
          descEn: "Cash advances, disciplinary deductions & bonuses",
          href: "/admin/adjustments",
          icon: FileText,
          color: "text-sky-400",
        },
        {
          id: "schedule",
          nameAr: "الجدول الذكي وتوزيع الشيفتات",
          nameEn: "Smart Shift Scheduler",
          descAr: "توزيع نوبات العمل الصباحية والمسائية وتفادي العجز",
          descEn: "Weekly roster planner & shift rotation engine",
          href: "/admin/schedule",
          icon: CalendarDays,
          color: "text-sky-400",
        },
      ],
    },
    {
      id: "admin",
      nameAr: "التحكم بالنظام والإدارة",
      nameEn: "System Admin & Security",
      headlineAr: "الصلاحيات، الأجهزة، والأمان السيبراني",
      headlineEn: "Roles, Active Sessions & Security Log",
      descAr: "إدارة الحسابات، الذكاء الاصطناعي، جلسات الكاشير، والتعاميم المباشرة",
      descEn: "User privileges, AI predictive stock, POS hardware & telemetry",
      accentColor: "rose",
      gradient: "from-rose-500/20 via-red-500/10 to-transparent",
      borderGlow: "border-rose-500/30 hover:border-rose-400/60",
      icon: Shield,
      adminOnly: true,
      tools: [
        {
          id: "send-doc",
          nameAr: "إرسال مستند رسمي للمدير",
          nameEn: "Dispatch Official Document",
          descAr: "إرسال ملفات وتعاميم فورية إلى شاشة مدير الفرع",
          descEn: "Direct push document delivery to branch managers",
          href: "/admin/send-document",
          icon: SendHorizontal,
          color: "text-rose-400",
        },
        {
          id: "user-roles",
          nameAr: "إدارة المستخدمين والصلاحيات",
          nameEn: "User Access & Permissions",
          descAr: "تعيين أدوار المشرفين والمديرين وصلاحيات الأقسام",
          descEn: "Role matrix, RBAC levels & account provisioning",
          href: "/admin/users",
          icon: Shield,
          badge: "Executive",
          badgeType: "admin",
          color: "text-rose-400",
        },
        {
          id: "ai-predict",
          nameAr: "التنبؤ الذكي بالمخزون (AI)",
          nameEn: "AI Predictive Stock Engine",
          descAr: "تحليلات الذكاء الاصطناعي للتنبؤ بنفاذ السلع مسبقاً",
          descEn: "Forecast stockouts based on historical run-rates",
          href: "/admin/inventory-predict",
          icon: Database,
          color: "text-purple-400",
        },
        {
          id: "notifications",
          nameAr: "إرسال الإشعارات والتعاميم",
          nameEn: "Broadcast System Alerts",
          descAr: "بث تنبيهات فورية لجميع طاقم العمل بالفرع",
          descEn: "Send high-priority alerts to store terminals",
          href: "/settings/notifications",
          icon: Bell,
          color: "text-rose-400",
        },
        {
          id: "audit-log",
          nameAr: "سجل العمليات والأمان (Audit)",
          nameEn: "Security & Action Audit Log",
          descAr: "سجل رقمي مشفر لجميع التعديلات والعمليات الحساسة",
          descEn: "Immutable audit trail of all sensitive operations",
          href: "/settings/audit-log",
          icon: Shield,
          color: "text-rose-400",
        },
        {
          id: "devices",
          nameAr: "شاشات الكاشير والأجهزة المتصلة",
          nameEn: "Connected POS Devices",
          descAr: "مراقبة حالة أجهزة التابلت ونقاط البيع المتصلة بالفرع",
          descEn: "Live ping, battery, and app version for all POS",
          href: "/admin/devices",
          icon: Monitor,
          badge: `${connectedDevices} Online`,
          badgeType: "success",
          color: "text-emerald-400",
        },
        {
          id: "import-csv",
          nameAr: "استيراد البيانات وقوائم الأسعار",
          nameEn: "CSV Bulk Data Import",
          descAr: "رفع قوائم الباركود والأسعار وتحديثات السيستم",
          descEn: "Bulk catalog & pricing import via spreadsheets",
          href: "/admin/import-csv",
          icon: Database,
          color: "text-rose-400",
        },
      ],
    },
  ], [outOfStockCount, pendingVoids, pendingExpiries, pendingReturns, connectedDevices]);

  // Filter visible departments based on Admin permission
  const visibleDepartments = useMemo(() => {
    return departments.filter((d) => !d.adminOnly || isAdmin);
  }, [departments, isAdmin]);

  // Total tools count
  const totalToolsCount = useMemo(() => {
    return visibleDepartments.reduce((acc, d) => acc + d.tools.length, 0);
  }, [visibleDepartments]);

  // Flattened tools for search
  const searchedTools = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const matches: { deptName: string; tool: ToolItem }[] = [];
    visibleDepartments.forEach((dept) => {
      dept.tools.forEach((tool) => {
        if (
          tool.nameAr.toLowerCase().includes(q) ||
          tool.nameEn.toLowerCase().includes(q) ||
          tool.descAr.toLowerCase().includes(q) ||
          tool.descEn.toLowerCase().includes(q)
        ) {
          matches.push({
            deptName: isAr ? dept.nameAr : dept.nameEn,
            tool,
          });
        }
      });
    });
    return matches;
  }, [searchQuery, visibleDepartments, isAr]);

  // Departments to display based on tab filter
  const displayedDepartments = useMemo(() => {
    if (selectedDept === "all") return visibleDepartments;
    return visibleDepartments.filter((d) => d.id === selectedDept);
  }, [selectedDept, visibleDepartments]);

  return (
    <div 
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-[#070709] text-white font-sans selection:bg-rose-500 selection:text-white relative overflow-x-hidden"
    >
      {/* LUXURY RADIAL AMBIENT BACKGROUND GLOWS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[650px] h-[650px] bg-gradient-to-br from-rose-600/15 via-red-600/5 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[30%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-purple-600/10 via-indigo-600/5 to-transparent rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[700px] h-[700px] bg-gradient-to-tr from-emerald-600/10 via-teal-600/5 to-transparent rounded-full blur-[160px]" />
        {/* Subtle VIP Grid Mesh Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.025]" 
          style={{ 
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`, 
            backgroundSize: "24px 24px" 
          }} 
        />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

        {/* TOP VIP STATUS STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
          
          {/* Brand & Branch */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-red-600/30 border border-white/20">
              K
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wider text-white">
                  CIRCLE K ENTERPRISE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/10 text-slate-300 border border-white/10">
                  v2.8 PRO
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Building2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{isAr ? (BRANCH_NAMES_AR[branchObj.id] || branchObj.name) : branchObj.name}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {isAr ? "متصل بالنظام السحابي" : "Live Firestore Sync"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick HUD Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Clock */}
            <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>
                {time ? time.toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
              </span>
            </div>

            {/* Branch Switcher Pill */}
            <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/[0.08] p-1 text-xs">
              {BRANCHES.map((b) => {
                const isSelected = currentBranch === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBranch(b.id)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      isSelected
                        ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isAr ? (BRANCH_NAMES_AR[b.id] || b.name) : b.name.replace("El ", "")}
                  </button>
                );
              })}
            </div>

            {/* Role Badge */}
            <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-2 text-xs">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold text-slate-300 capitalize">{userRole}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(isAr ? "en" : "ar")}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {isAr ? "English" : "العربية"}
            </button>

            {/* Sign Out Button */}
            <button
              onClick={async () => {
                if (typeof window !== "undefined") {
                  const sessionId = sessionStorage.getItem("device_session_id");
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
                }
                await signOut(auth);
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold text-rose-400 hover:text-rose-300 transition-all cursor-pointer flex items-center gap-1.5"
              title={isAr ? "تسجيل الخروج" : "Sign Out"}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isAr ? "خروج" : "Logout"}</span>
            </button>
          </div>

        </div>

        {/* 2-COLUMN VIP KEYNOTE LAYOUT (MIRRORING FIGMA BENTO GRID TEMPLATE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: PRESENTATION KEYNOTE COLUMN (VIP GRAPHICS STYLE) */}
          {/* ======================================================== */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            
            {/* Keynote Title Block / Personalized Executive Welcome */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-red-500/10 via-rose-500/10 to-amber-500/10 border border-rose-500/20 text-rose-400 text-xs font-black tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>
                  {time 
                    ? (time.getHours() < 12 
                        ? (isAr ? "صباح الخير" : "Good Morning") 
                        : time.getHours() < 17 
                          ? (isAr ? "مساء الخير" : "Good Afternoon") 
                          : (isAr ? "مساء الخير" : "Good Evening"))
                    : (isAr ? "أهلاً بك" : "Welcome Back")}
                </span>
                <span className="w-1 h-1 rounded-full bg-rose-400" />
                <span className="text-[10px] text-slate-400 font-mono capitalize">{userRole}</span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {isAr ? (
                    <>
                      أهلاً بك،{" "}
                      <span className="bg-gradient-to-r from-rose-400 via-red-300 to-amber-300 bg-clip-text text-transparent">
                        {userName || "القائد"}
                      </span>{" "}
                      👋
                    </>
                  ) : (
                    <>
                      Welcome,{" "}
                      <span className="bg-gradient-to-r from-rose-400 via-red-300 to-amber-300 bg-clip-text text-transparent">
                        {userName || "Commander"}
                      </span>{" "}
                      👋
                    </>
                  )}
                </h1>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal mt-2">
                  {isAr 
                    ? "مركز القيادة التنفيذي • كافة عمليات ومبيعات الفرع، تدقيق الخزائن، والمخزون متزامنة وتعمل بكفاءة تامة." 
                    : "Executive Command Hub • All franchise operations, safe vault balances, inventory alerts, and team rosters are live."
                  }
                </p>
              </div>
            </div>

            {/* REAL OPERATIONAL TELEMETRY CARDS (EXPIRED, VOIDS, ACTIVE STAFF, OFF TODAY) */}
            <div className="space-y-3 pt-2">
              {[
                {
                  count: `${pendingExpiries}`,
                  titleEn: "Total Expired & Near",
                  titleAr: "الصلاحيات المنتهية والقريبة",
                  subEn: pendingExpiries > 0 ? `${pendingExpiries} flagged for removal` : "All shelf products safe & fresh",
                  subAr: pendingExpiries > 0 ? "أصناف تستوجب السحب فوراً" : "جميع الأصناف سليمة ومحدثة",
                  color: pendingExpiries > 0 ? "text-amber-400" : "text-emerald-400",
                  href: "/products/expiries-audit",
                  icon: AlertTriangle,
                },
                {
                  count: `${pendingVoids}`,
                  titleEn: "Pending Voids",
                  titleAr: "الفواتير الملغاة المعلقة",
                  subEn: pendingVoids > 0 ? "Awaiting manager approval" : "All cashier voids audited & cleared",
                  subAr: pendingVoids > 0 ? "بانتظار اعتماد وموافقة المدير" : "تم تدقيق كافة الفواتير الملغاة",
                  color: pendingVoids > 0 ? "text-rose-400" : "text-emerald-400",
                  href: "/voids/manager",
                  icon: Shield,
                },
                {
                  count: `${activeStaffCount}`,
                  titleEn: "Active Staff on Duty",
                  titleAr: "طاقم العمل على الوردية",
                  subEn: `${activeStaffCount} ${isAr ? "موظف نشط بالفرع" : "staff registered on active duty"}`,
                  subAr: `${activeStaffCount} موظف مسجل على رأس العمل`,
                  color: "text-sky-400",
                  href: "/hr/employees?status=active",
                  icon: Users,
                },
                {
                  count: `${offStaff.length} ${isAr ? "في راحة" : "Off"}`,
                  titleEn: "Staff Off Today",
                  titleAr: "إجازات وراحات اليوم",
                  subEn: offStaff.length > 0 
                    ? offStaff.map(e => e.name?.split(" ")[0] || e.name).slice(0, 2).join(", ") + (offStaff.length > 2 ? ` +${offStaff.length - 2}` : "")
                    : "Full roster on duty today",
                  subAr: offStaff.length > 0 
                    ? offStaff.map(e => e.name?.split(" ")[0] || e.name).slice(0, 2).join("، ") + (offStaff.length > 2 ? ` +${offStaff.length - 2}` : "")
                    : "الكل على رأس العمل اليوم",
                  color: offStaff.length > 0 ? "text-indigo-400" : "text-slate-400",
                  href: "/admin/schedule",
                  icon: CalendarDays,
                },
              ].map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <Link 
                    key={idx}
                    href={item.href}
                    prefetch={true}
                    className="p-3.5 rounded-2xl bg-[#111116] border border-white/[0.06] hover:border-white/[0.15] hover:bg-[#16161d] transition-all flex items-center justify-between group/bullet block"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 group-hover/bullet:scale-105 transition-transform">
                        <ItemIcon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block group-hover/bullet:text-rose-300 transition-colors truncate">
                          {isAr ? item.titleAr : item.titleEn}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium block truncate">
                          {isAr ? item.subAr : item.subEn}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-base sm:text-lg font-black font-mono ${item.color}`}>
                        {item.count}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover/bullet:text-white group-hover/bullet:translate-x-0.5 group-hover/bullet:-translate-y-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Department Navigation Filter Pills */}
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {isAr ? "تصفية الأقسام (Filter View)" : "Department Navigator"}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedDept("all")}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    selectedDept === "all"
                      ? "bg-white text-black font-black shadow-lg shadow-white/10"
                      : "bg-[#111116] text-slate-300 hover:text-white border border-white/[0.06] hover:border-white/20"
                  }`}
                >
                  <span>{isAr ? "كافة الأقسام" : "All Departments"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${selectedDept === "all" ? "bg-black/10 text-black font-black" : "bg-white/10 text-slate-400"}`}>
                    {totalToolsCount}
                  </span>
                </button>

                {visibleDepartments.map((dept) => {
                  const isSelected = selectedDept === dept.id;
                  const DeptIcon = dept.icon;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => setSelectedDept(dept.id)}
                      className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-rose-600 text-white font-black shadow-lg shadow-rose-600/30 border border-rose-400/40"
                          : "bg-[#111116] text-slate-300 hover:text-white border border-white/[0.06] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <DeptIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{isAr ? dept.nameAr : dept.nameEn}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/20 text-white font-black" : "bg-white/10 text-slate-400"}`}>
                        {dept.tools.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Search Widget */}
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isAr ? "right-3.5" : "left-3.5"}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "ابحث عن أي أداة أو صفحة..." : "Quick search all tools..."}
                className={`w-full py-2.5 rounded-xl bg-[#111116] border border-white/[0.08] focus:border-rose-500 text-xs font-medium text-white placeholder:text-slate-500 outline-none transition-all ${
                  isAr ? "pr-10 pl-3" : "pl-10 pr-3"
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className={`absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white ${isAr ? "left-3" : "right-3"}`}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Built for Circle K Badge (Mirroring Built for Figma in Reference) */}
            <div className="pt-4 flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xs">
                  CK
                </div>
                <div>
                  <span className="text-[11px] font-bold text-white block">Circle K Franchise OS</span>
                  <span className="text-[10px] text-slate-400">Enterprise Production Edition</span>
                </div>
              </div>
              <span className="text-emerald-400 text-xs font-mono font-bold">● Active</span>
            </div>

          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: FIGMA KEYNOTE BENTO GRID (VIP GRAPHICS STYLE) */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            
            {/* SEARCH RESULTS OVERLAY (IF TYPING) */}
            {searchQuery.trim() !== "" ? (
              <div className="p-6 rounded-[28px] bg-[#111116] border border-rose-500/40 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-rose-400" />
                    <span>
                      {isAr ? `نتائج البحث عن "${searchQuery}"` : `Search Results for "${searchQuery}"`}
                    </span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {searchedTools.length} {isAr ? "مطابقة" : "matches"}
                  </span>
                </div>

                {searchedTools.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    {isAr ? "لا توجد صفحات أو أدوات مطابقة للبحث" : "No matching tools found."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {searchedTools.map((item, idx) => {
                      const Icon = item.tool.icon;
                      return (
                        <Link
                          key={idx}
                          href={item.tool.href}
                          prefetch={true}
                          className="p-3.5 rounded-2xl bg-[#16161d] hover:bg-[#1f1f29] border border-white/[0.08] hover:border-rose-500/40 transition-all flex items-start gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Icon className={`w-4 h-4 ${item.tool.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-white group-hover:text-rose-400 truncate">
                                {isAr ? item.tool.nameAr : item.tool.nameEn}
                              </span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 transition-colors flex-shrink-0" />
                            </div>
                            <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {isAr ? item.tool.descAr : item.tool.descEn}
                            </span>
                            <span className="text-[9px] font-bold text-rose-400 mt-1 inline-block">
                              {item.deptName}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ROW 1: THE SIGNATURE FIGMA KEYNOTE HERO PAIR */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* CARD 1 (8 COLS): WIDE PRESENTATION CARD WITH NEON GRADIENT ORB & CHART */}
                  <div className="md:col-span-7 xl:col-span-8 rounded-[30px] p-6 sm:p-7 bg-[#111116] border border-white/[0.08] hover:border-emerald-500/40 transition-all relative overflow-hidden flex flex-col justify-between group shadow-2xl">
                    {/* Keynote Radiant Gradient Orb in top-right */}
                    <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-gradient-to-br from-rose-500 via-purple-600 to-indigo-600 rounded-full blur-[80px] opacity-40 group-hover:opacity-70 transition-opacity pointer-events-none" />

                    <div>
                      {/* Card Header & Avatars */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {isAr ? "الخزينة المباشرة" : "Safe Vault Live"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {isAr ? "الفرع المعتمد" : "Active Branch"}
                          </span>
                        </div>

                        <Link
                          href="/financials/inputs"
                          prefetch={true}
                          className="text-xs font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors group/link"
                        >
                          <span>{isAr ? "تسجيل العهدة" : "Open Safe"}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </Link>
                      </div>

                      {/* Headline & Subtitle */}
                      <div className="space-y-1 mb-6">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                          {isAr ? "تقفيل الخزائن ومراقبة المبيعات" : "Financial Operations & Cashier Floats"}
                        </h2>
                        <p className="text-xs text-slate-400 max-w-xl">
                          {isAr 
                            ? "متابعة العجز والزيادة، تدقيق الفواتير الملغاة، وتسجيل التقفيلات اليومية للفرع." 
                            : "Daily safe drop reconciliation, cashier float balance, and real-time shift verification."
                          }
                        </p>
                      </div>

                      {/* Live Money in Safe & Money in Bank (Like Overview) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                        
                        {/* 1. Money in Safe */}
                        <Link
                          href="/financials/inputs/safe-report"
                          prefetch={true}
                          className={`p-4 sm:p-5 rounded-2xl transition-all group/safe relative overflow-hidden flex flex-col justify-between shadow-lg ${
                            safeBalance < 0
                              ? "bg-gradient-to-br from-amber-950/40 via-[#18130e] to-[#0f0c08] border border-amber-500/35 hover:border-amber-400/70"
                              : "bg-gradient-to-br from-emerald-950/50 via-[#0d1612] to-[#0a0f0d] border border-emerald-500/30 hover:border-emerald-400/70"
                          }`}
                        >
                          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
                            safeBalance < 0 ? "bg-amber-500/10" : "bg-emerald-500/10"
                          }`} />
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                                safeBalance < 0
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                  : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              }`}>
                                <Wallet className="w-4 h-4" />
                              </div>
                              <span className={`text-xs font-bold uppercase tracking-wider ${
                                safeBalance < 0 ? "text-amber-300" : "text-emerald-300"
                              }`}>
                                {isAr ? (safeBalance < 0 ? "رصيد الخزنة (صافي العهدة)" : "رصيد الخزنة الفعلي") : (safeBalance < 0 ? "Vault Net Float" : "Money in Safe")}
                              </span>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                              safeBalance < 0
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                safeBalance < 0 ? "bg-amber-400" : "bg-emerald-400"
                              }`} />
                              {safeBalance < 0 
                                ? (isAr ? "سلفة عهدة منصرفة" : "Advance Outflow")
                                : (isAr ? "مباشر" : "Live Vault")}
                            </span>
                          </div>

                          <div className="my-1">
                            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
                              <span className={`text-sm font-bold ${
                                safeBalance < 0 ? "text-amber-400/90" : "text-emerald-400/80"
                              }`}>EGP</span>
                              <span>{fmt(safeBalance)}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              {safeBalance < 0
                                ? (isAr ? "مخصوم سلفة موظف معتمدة من الخزينة لحين توريد الوردية" : "Verified staff loan outflow pending cashier shift drop")
                                : (isAr ? "العهدة النقدية وجرد الخزنة المعتمد" : "Cash float & verified safe closure")}
                            </span>
                          </div>

                          <div className={`pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold transition-colors ${
                            safeBalance < 0
                              ? "text-amber-400 group-hover/safe:text-amber-300"
                              : "text-emerald-400 group-hover/safe:text-emerald-300"
                          }`}>
                            <span>{isAr ? "تقرير الخزنة بالتفصيل" : "Open Safe Report"}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover/safe:translate-x-0.5 group-hover/safe:-translate-y-0.5 transition-transform" />
                          </div>
                        </Link>

                        {/* 2. Money in Bank */}
                        <Link
                          href="/financials/inputs"
                          prefetch={true}
                          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/50 via-[#0f1426] to-[#0a0d1a] border border-indigo-500/30 hover:border-indigo-400/70 transition-all group/bank relative overflow-hidden flex flex-col justify-between shadow-lg"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                                <Landmark className="w-4 h-4 text-indigo-400" />
                              </div>
                              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                {isAr ? "رصيد البنك والفيزا" : "Money in Bank"}
                              </span>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {isAr ? "معتمد" : "Verified"}
                            </span>
                          </div>

                          <div className="my-1">
                            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
                              <span className="text-sm font-bold text-indigo-400/80">EGP</span>
                              <span>{fmt(bankBalance)}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              {isAr ? "مبيعات الفيزا والتحويلات البنكية" : "Visa settlements & bank deposits"}
                            </span>
                          </div>

                          <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-indigo-400 group-hover/bank:text-indigo-300">
                            <span>{isAr ? "نظرة عامة والمدفوعات" : "View Bank Overview"}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover/bank:translate-x-0.5 group-hover/bank:-translate-y-0.5 transition-transform" />
                          </div>
                        </Link>

                      </div>

                      {/* Real 7-Day Sales Trend Telemetry */}
                      <div className="p-4 rounded-2xl bg-[#0b0b0e] border border-white/[0.08] mb-5 relative overflow-hidden group/chart">
                        {/* Radiant subtle glow */}
                        <div className="absolute top-0 right-1/4 w-40 h-20 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Telemetry Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                              {weeklyTrendPct >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                                  {isAr ? "مؤشر مبيعات آخر 7 أيام" : "7-Day Sales Revenue Trend"}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                    weeklyTrendPct >= 0
                                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                                      : "text-rose-400 bg-rose-500/10 border-rose-500/30"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                      weeklyTrendPct >= 0 ? "bg-emerald-400" : "bg-rose-400"
                                    }`}
                                  />
                                  {weeklyTrendPct >= 0 ? `+${weeklyTrendPct}% Flow` : `${weeklyTrendPct}% Flow`}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {isAr ? "بيانات حية مباشرة من تقفيلات الوردية والـ POS" : "Live telemetry computed from verified shift sales"}
                              </span>
                            </div>
                          </div>

                          {/* 7-Day Volume & Average */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                                {isAr ? "إجمالي الأسبوع" : "7-Day Total"}
                              </span>
                              <span className="text-xs font-black text-emerald-400 font-mono">
                                {salesLoading && weeklySales.length === 0 ? "..." : `${fmt(weeklyTotalSales)} EGP`}
                              </span>
                            </div>
                            <div className="h-6 w-px bg-white/[0.08]" />
                            <Link
                              href="/financials/inputs/sales"
                              prefetch={true}
                              className="text-[11px] font-bold text-slate-300 hover:text-emerald-400 flex items-center gap-1 transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
                              title={isAr ? "عرض جدول المبيعات التفصيلي" : "View detailed sales register"}
                            >
                              <span>{isAr ? "المبيعات" : "Sales"}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                            </Link>
                          </div>
                        </div>

                        {/* Interactive Real SVG Waveform */}
                        <div className="relative h-20 w-full mb-3">
                          {salesLoading && weeklySales.length === 0 ? (
                            <div className="h-full w-full flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 75" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="realSalesHeroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.40" />
                                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.10" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                                <filter id="salesGlow" x="-20%" y="-20%" width="140%" height="140%">
                                  <feGaussianBlur stdDeviation="2" result="blur" />
                                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                              </defs>

                              {/* Baseline grid line */}
                              <line x1="15" y1="61" x2="485" y2="61" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

                              {/* Real Area Fill */}
                              {svgArea && (
                                <path
                                  d={svgArea}
                                  fill="url(#realSalesHeroGrad)"
                                  className="transition-all duration-700 ease-out"
                                />
                              )}

                              {/* Real Curve Stroke */}
                              {svgCurve && (
                                <path
                                  d={svgCurve}
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="2.8"
                                  strokeLinecap="round"
                                  filter="url(#salesGlow)"
                                  className="transition-all duration-700 ease-out"
                                />
                              )}

                              {/* Real Interactive Data Points */}
                              {chartPoints.map((pt, idx) => {
                                const isHovered = hoveredDay?.date === pt.date;
                                const isLatest = idx === chartPoints.length - 1;
                                return (
                                  <g key={pt.date} className="cursor-pointer" onMouseEnter={() => setHoveredDay(pt)} onMouseLeave={() => setHoveredDay(null)}>
                                    {/* Invisible larger hit target */}
                                    <circle cx={pt.x} cy={pt.y} r="12" fill="transparent" />
                                    
                                    {/* Pulse ring on latest day */}
                                    {isLatest && (
                                      <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r="7"
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="1.5"
                                        className="animate-ping opacity-75"
                                      />
                                    )}

                                    {/* Solid node */}
                                    <circle
                                      cx={pt.x}
                                      cy={pt.y}
                                      r={isHovered ? 5.5 : 3.5}
                                      fill={isHovered ? "#34d399" : "#10b981"}
                                      stroke="#0b0b0e"
                                      strokeWidth="2"
                                      className="transition-all duration-200"
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                          )}

                          {/* Hover Tooltip Overlay */}
                          {hoveredDay && (
                            <div className="absolute top-0 right-2 pointer-events-none bg-[#16161d] border border-emerald-500/40 rounded-xl px-3 py-1.5 shadow-2xl z-20 flex items-center gap-3 text-xs animate-in fade-in duration-150">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {isAr ? hoveredDay.dayNameAr : hoveredDay.dayName} ({hoveredDay.displayDate})
                                </span>
                                <span className="font-black text-emerald-400 font-mono">
                                  {fmt(hoveredDay.total)} EGP
                                </span>
                              </div>
                              <div className="h-5 w-px bg-white/10" />
                              <div className="text-[10px] text-slate-400 space-y-0.5">
                                <div><span className="text-slate-500">Cash:</span> {fmt(hoveredDay.cash)}</div>
                                <div><span className="text-slate-500">Visa:</span> {fmt(hoveredDay.visa)}</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 7 Days Labels & Values Grid */}
                        <div className="grid grid-cols-7 gap-1 pt-2 border-t border-white/[0.05]">
                          {weeklySales.map((item, idx) => {
                            const isHovered = hoveredDay?.date === item.date;
                            const isToday = idx === weeklySales.length - 1;
                            return (
                              <button
                                key={item.date}
                                onMouseEnter={() => setHoveredDay(item)}
                                onMouseLeave={() => setHoveredDay(null)}
                                onClick={() => setHoveredDay(isHovered ? null : item)}
                                className={`flex flex-col items-center py-1 px-0.5 rounded-lg transition-all text-center ${
                                  isHovered
                                    ? "bg-emerald-500/20 border border-emerald-500/40 scale-105"
                                    : isToday
                                    ? "bg-white/[0.04] border border-emerald-500/20"
                                    : "hover:bg-white/[0.03]"
                                }`}
                              >
                                <span className={`text-[10px] font-bold ${isToday ? "text-emerald-400" : "text-slate-400"}`}>
                                  {isAr ? item.dayNameAr : item.dayName}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                  {item.displayDate}
                                </span>
                                <span className="text-[10px] font-black text-white font-mono mt-0.5 truncate w-full px-0.5">
                                  {item.total > 0
                                    ? item.total >= 1000
                                      ? `${(item.total / 1000).toFixed(1)}k`
                                      : `${Math.round(item.total)}`
                                    : "0"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Fast Action Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { nameAr: "مدخلات الخزينة", nameEn: "Safe Inputs", href: "/financials/inputs", icon: Wallet },
                          { nameAr: "التقارير المالية", nameEn: "Fin Reports", href: "/financial-reports", icon: FileText },
                          { nameAr: "تفاصيل المبيعات", nameEn: "Detailed Sales", href: "/financials/detailed-sales", icon: Activity },
                          { nameAr: "الفواتير الملغاة", nameEn: "Voids", href: "/voids/manager", icon: Shield, badge: pendingVoids > 0 ? `${pendingVoids}` : undefined },
                        ].map((btn, idx) => {
                          const Icon = btn.icon;
                          return (
                            <Link
                              key={idx}
                              href={btn.href}
                              prefetch={true}
                              className="p-2.5 rounded-xl bg-[#16161d] hover:bg-[#20202a] border border-white/[0.06] hover:border-emerald-500/40 transition-all flex items-center justify-between group/b"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Icon className="w-3.5 h-3.5 text-emerald-400 group-hover/b:scale-110 transition-transform" />
                                <span className="text-[11px] font-bold text-slate-200 group-hover/b:text-white truncate">
                                  {isAr ? btn.nameAr : btn.nameEn}
                                </span>
                              </div>
                              {btn.badge && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                  {btn.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* CARD 2 (4 COLS): VIBRANT NEON GRADIENT CARD (MIRRORING THE "SHIP FASTER WITH AI" CARD) */}
                  <div className="md:col-span-5 xl:col-span-4 rounded-[30px] p-6 sm:p-7 bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl group">
                    {/* Ambient Glow & Star Graphic */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <Bot className="absolute bottom-[-15px] right-[-15px] w-36 h-36 text-black/10 group-hover:scale-110 group-hover:rotate-6 transition-all pointer-events-none" />

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-black/20 text-white border border-white/20 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          {isAr ? "الذكاء الاصطناعي" : "Copilot Engine"}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-white/80">
                          v3.2 GPT
                        </span>
                      </div>

                      <span className="text-3xl sm:text-4xl font-black tracking-tight block text-white">
                        {isAr ? "مساعد إبراهيم" : "Ibrahim AI"}
                      </span>

                      <p className="text-xs text-white/90 font-medium mt-2 leading-relaxed">
                        {isAr 
                          ? "اسأل الذكاء الاصطناعي فوراً عن مبيعات الفرع، هوامش الربح، التنبؤ بنفاذ السلع، ومراجعة المعايير." 
                          : "Ask anything about retail numbers, margin simulations, inventory forecasting, and staff policies."
                        }
                      </p>
                    </div>

                    <div className="pt-6">
                      <Link
                        href="/ai-assistant"
                        prefetch={true}
                        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <span>{isAr ? "بدء المحادثة مع إبراهيم" : "Launch AI Copilot"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                </div>

                {/* ROW 2: DEPARTMENT BENTO CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {displayedDepartments.map((dept) => {
                    const DeptIcon = dept.icon;
                    return (
                      <div
                        key={dept.id}
                        className={`rounded-[28px] p-6 bg-[#111116] border ${dept.borderGlow} transition-all relative overflow-hidden flex flex-col justify-between group shadow-xl`}
                      >
                        {/* Ambient corner glow */}
                        <div className={`absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br ${dept.gradient} rounded-full blur-3xl pointer-events-none group-hover:opacity-100 transition-opacity`} />

                        <div>
                          {/* Card Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                <DeptIcon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-base font-black text-white">
                                  {isAr ? dept.nameAr : dept.nameEn}
                                </h3>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {dept.tools.length} {isAr ? "أدوات متوفرة" : "Tools Available"}
                                </span>
                              </div>
                            </div>

                            {dept.adminOnly && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                Admin
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 mb-5 line-clamp-2">
                            {isAr ? dept.descAr : dept.descEn}
                          </p>

                          {/* List of tools in this department */}
                          <div className="space-y-2">
                            {dept.tools.map((tool) => {
                              const ToolIcon = tool.icon;
                              return (
                                <Link
                                  key={tool.id}
                                  href={tool.href}
                                  prefetch={true}
                                  className="p-2.5 rounded-xl bg-[#16161d] hover:bg-[#20202a] border border-white/[0.05] hover:border-white/20 transition-all flex items-center justify-between group/tool"
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    <ToolIcon className={`w-4 h-4 ${tool.color} group-hover/tool:scale-110 transition-transform flex-shrink-0`} />
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-slate-200 group-hover/tool:text-white block truncate">
                                        {isAr ? tool.nameAr : tool.nameEn}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {tool.badge && (
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                        tool.badgeType === "danger"
                                          ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                                          : tool.badgeType === "warning"
                                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                          : tool.badgeType === "success"
                                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                          : "bg-white/10 text-slate-300 border border-white/10"
                                      }`}>
                                        {tool.badge}
                                      </span>
                                    )}
                                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover/tool:text-white group-hover/tool:translate-x-0.5 group-hover/tool:-translate-y-0.5 transition-transform" />
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>

                        {/* Card Bottom Direct Launcher */}
                        <div className="pt-5 mt-4 border-t border-white/[0.06]">
                          <Link
                            href={dept.tools[0]?.href || "#"}
                            prefetch={true}
                            className="text-xs font-bold text-slate-400 hover:text-white flex items-center justify-between group/enter"
                          >
                            <span>
                              {isAr ? `فتح ${dept.nameAr}` : `Launch ${dept.nameEn}`}
                            </span>
                            <ChevronRight className={`w-4 h-4 group-hover/enter:translate-x-1 transition-transform ${isAr ? "rotate-180 group-hover/enter:-translate-x-1" : ""}`} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </div>

        </div>

        {/* BOTTOM METRIC FOOTER STRIP */}
        <div className="pt-6 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Circle K Retail Ecosystem</span>
            </span>
            <span>•</span>
            <span>{isAr ? "نظام إدارة الامتياز التجاري" : "Franchise Management Suite"}</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/cashier" prefetch={true} className="hover:text-white transition-colors">
              {isAr ? "نقطة البيع (الكاشير)" : "Cashier POS"}
            </Link>
            <span>•</span>
            <Link href="/hr/employees" prefetch={true} className="hover:text-white transition-colors">
              {isAr ? "الموظفين (HR)" : "HR Roster"}
            </Link>
            <span>•</span>
            <Link href="/admin/users" prefetch={true} className="hover:text-white transition-colors">
              {isAr ? "إدارة الصلاحيات" : "Security & Users"}
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
