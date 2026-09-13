"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { safeSetLocalStorage, sanitizeDepositForCache } from "@/lib/storageUtils";
import { dispatchNotificationSystem } from "@/lib/notifications";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Banknote, 
  User, 
  Building2, 
  Vault, 
  ArrowRight,
  Download,
  Activity,
  AlertTriangle,
  Loader2,
  X,
  Printer,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  Coins,
  ShieldCheck,
  Sparkles,
  Layers,
  Calendar,
  Filter,
  CheckCircle2,
  CreditCard,
  Crown,
  FileSpreadsheet,
  ArrowDownRight,
  RefreshCw
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import ExportFinancialsModal from "@/components/ExportFinancialsModal";

export default function DepositsPage() {
  const { currentBranch } = useBranch();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "all">("month");
  const [filterValue, setFilterValue] = useState(new Date().toISOString().substring(0, 10));
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDeposit, setNewDeposit] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    from: "safe",
    to: "bank",
    note: "",
    ownerName: ""
  });
  
  const [selectedDepositForPrint, setSelectedDepositForPrint] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!filterValue && filterType !== "all") return;
    setLoading(true);
    let q = collection(db, "deposits") as any;

    if (filterType === "day" && filterValue) {
      q = query(q, where("date", "==", filterValue));
    } else if (filterType === "month" && filterValue) {
      const monthPrefix = filterValue.substring(0, 7);
      const startOfMonth = monthPrefix + "-01";
      const endOfMonth = monthPrefix + "-31";
      q = query(q, where("date", ">=", startOfMonth), where("date", "<=", endOfMonth));
    } else if (filterType === "year" && filterValue) {
      const year = filterValue.substring(0, 4);
      const startOfYear = year + "-01-01";
      const endOfYear = year + "-12-31";
      q = query(q, where("date", ">=", startOfYear), where("date", "<=", endOfYear));
    }

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      let data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      // Client-side filtering for branch (handling older records fallback)
      if (currentBranch && currentBranch !== "all") {
        data = data.filter((item: any) => {
          const bId = (item as any).storeId?.toLowerCase() || "";
          let itemBranch = "alamein4"; 
          if (bId.includes("ola") || bId.includes("koronfol")) itemBranch = "ola";
          return itemBranch === currentBranch;
        });
      }

      // Client-side sorting because we removed orderBy from query to avoid missing composite index
      data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setDeposits(data);
      const cleanData = data.slice(0, 50).map(sanitizeDepositForCache);
      safeSetLocalStorage('cached_detailed_deposits', JSON.stringify(cleanData));
      setLoading(false);
    }, (err: any) => {
      console.error(err);
      toast.error("Failed to load deposits");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterType, filterValue, currentBranch]);

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeposit.amount || isNaN(Number(newDeposit.amount)) || Number(newDeposit.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (newDeposit.from === newDeposit.to) {
      toast.error("Origin and destination cannot be the same");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4"; // map back to db format

      const depositData = {
        amount: Number(newDeposit.amount),
        date: newDeposit.date,
        from: newDeposit.from,
        to: newDeposit.to,
        note: newDeposit.note,
        ownerName: (newDeposit.from === "owner" || newDeposit.to === "owner") ? newDeposit.ownerName : "",
        storeId,
        createdAt: serverTimestamp(),
        createdBy: user?.email || "unknown"
      };

      const docRef = await addDoc(collection(db, "deposits"), depositData);

      // Dispatch Universal System Notification
      dispatchNotificationSystem({
        title: `🏦 Bank / Safe Deposit Logged`,
        body: `Deposit of EGP ${Number(newDeposit.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} logged by ${auth.currentUser?.displayName || 'User'}.\nDate: ${newDeposit.date || new Date().toISOString().split('T')[0]}${newDeposit.note ? ` • Note: ${newDeposit.note}` : ''}`,
        type: "deposit",
        url: "/financials/inputs/deposits",
        branchId: currentBranch,
        metadata: { amount: newDeposit.amount, date: newDeposit.date, depositor: auth.currentUser?.displayName, storeId: currentBranch }
      });

      toast.success("Deposit added & notification sent!");
      setShowAddModal(false);
      
      const savedDeposit = { id: docRef.id, ...depositData, createdAt: new Date() };
      
      setNewDeposit({
        date: new Date().toISOString().split('T')[0],
        amount: "",
        from: "safe",
        to: "bank",
        note: "",
        ownerName: ""
      });
      
      // Auto Print
      setSelectedDepositForPrint(savedDeposit);
      setTimeout(() => generatePDF(), 500);
      
    } catch (err) {
      console.error(err);
      toast.error("Error adding deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = async (depositToPrint?: any) => {
    if (depositToPrint) {
      setSelectedDepositForPrint(depositToPrint);
    }
    setGeneratingPDF(true);

    await new Promise(resolve => setTimeout(resolve, 350));
    let wrapper = document.getElementById("single-deposit-print-wrapper");
    if (!wrapper) {
      await new Promise(resolve => setTimeout(resolve, 350));
      wrapper = document.getElementById("single-deposit-print-wrapper");
    }

    if (wrapper) {
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0px";
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    let page = document.getElementById("pdf-deposit-slip");
    if (!page) {
      await new Promise(resolve => setTimeout(resolve, 300));
      page = document.getElementById("pdf-deposit-slip");
    }
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      let pageAdded = false;
      
      if (page) {
        try {
          const canvas = await html2canvas(page, { scale: 2, useCORS: true, logging: false, imageTimeout: 15000 });
          const imgData = canvas.toDataURL("image/png");
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
          pageAdded = true;
        } catch (err1) {
          console.error("Deposit slip canvas error:", err1);
        }
      }

      if (pageAdded) {
        try {
          pdf.autoPrint();
          const blobUrl = pdf.output("bloburl");
          const printWin = window.open(blobUrl, "_blank");
          if (!printWin || printWin.closed || typeof printWin.closed === "undefined") {
            pdf.save(`Deposit_Slip_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("Deposit slip downloaded as PDF!");
          } else {
            toast.success("Deposit slip ready for printing!");
          }
        } catch (e) {
          pdf.save(`Deposit_Slip_${new Date().toISOString().split('T')[0]}.pdf`);
          toast.success("Deposit slip downloaded as PDF!");
        }
      } else {
        toast.error("Failed to generate PDF.");
      }

      setSelectedDepositForPrint(null);
    } catch (error) {
      console.error("Deposit PDF Generation Error:", error);
      toast.error("Failed to generate PDF.");
    } finally {
      if (wrapper) {
        wrapper.style.left = "-9999px";
      }
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deposit?")) return;
    try {
      await deleteDoc(doc(db, "deposits", id));
      toast.success("Deposit deleted");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting deposit");
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const avgDeposit = deposits.length ? totalDeposited / deposits.length : 0;
  const maxDeposit = deposits.reduce((max, d) => Math.max(max, Number(d.amount || 0)), 0);

  // Group unique flows
  const flowSet = new Set(deposits.map(d => `${d.from}-${d.to}`));
  const uniqueFlows = Array.from(flowSet).map(flow => {
    const [from, to] = flow.split('-');
    return { from, to, count: deposits.filter(d => d.from === from && d.to === to).length };
  });

  const getEntityIcon = (entity: string, size = 18) => {
    switch (entity) {
      case "safe": return <Vault size={size} />;
      case "owner": return <User size={size} />;
      case "bank": return <Building2 size={size} />;
      default: return <Banknote size={size} />;
    }
  };

  const getEntityName = (entity: string) => {
    switch (entity) {
      case "safe": return "Safe";
      case "owner": return "Owner";
      case "bank": return "Bank";
      default: return entity;
    }
  };

  // Fuzzy & Case-Insensitive Owner Distribution Breakdown calculation
  const ownerSummary = React.useMemo(() => {
    const summaryMap: Record<string, {
      displayName: string;
      fromBank: number;
      fromSafe: number;
      otherSource: number;
      total: number;
      count: number;
    }> = {};

    deposits.forEach((deposit: any) => {
      const fromSrc = String(deposit.from || "").toLowerCase();
      const toSrc = String(deposit.to || "").toLowerCase();
      const isOwnerDest = toSrc === "owner";

      let raw = String(deposit.ownerName || "").trim();

      if (!raw && deposit.note) {
        const noteStr = String(deposit.note).trim();
        if (noteStr.toLowerCase().includes("owner:")) {
          const parts = noteStr.split(/owner:/i);
          raw = parts[1] ? parts[1].trim() : noteStr;
        } else if (isOwnerDest) {
          raw = noteStr;
        }
      }

      if (!raw && !isOwnerDest) return;
      if (!raw && isOwnerDest) raw = "General Owner";

      // Clean string: remove "Owner:" prefix, dots, dashes, underscores, and extra spaces
      let cleaned = raw.replace(/^owner:\s*/i, "").trim();
      const normalizedKey = cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (!normalizedKey) return;

      let key = normalizedKey;
      let displayName = cleaned;

      if (normalizedKey.includes("ashraf")) {
        key = "mr_ashraf";
        displayName = "Mr. Ashraf";
      } else if (normalizedKey.includes("youssef")) {
        key = "mr_youssef";
        displayName = "Mr. Youssef";
      } else {
        displayName = cleaned
          .replace(/\./g, " ")
          .split(" ")
          .filter(Boolean)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
        if (!displayName.toLowerCase().startsWith("mr") && !displayName.toLowerCase().startsWith("mr.")) {
          displayName = `Mr. ${displayName}`;
        }
      }

      if (!summaryMap[key]) {
        summaryMap[key] = {
          displayName,
          fromBank: 0,
          fromSafe: 0,
          otherSource: 0,
          total: 0,
          count: 0
        };
      }

      const amt = Number(deposit.amount) || 0;
      summaryMap[key].total += amt;
      summaryMap[key].count += 1;

      if (fromSrc === "bank") {
        summaryMap[key].fromBank += amt;
      } else if (fromSrc === "safe") {
        summaryMap[key].fromSafe += amt;
      } else {
        summaryMap[key].otherSource += amt;
      }
    });

    return Object.values(summaryMap).sort((a, b) => b.total - a.total);
  }, [deposits]);

  const totalOwnerDistributed = ownerSummary.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Executive Glassmorphism Toolbar & Controls */}
      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 shadow-2xl p-4 sm:p-5 rounded-3xl flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 overflow-hidden">
        {/* Subtle ambient glow meshes */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left: Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto relative z-10">
          
          {/* Segmented Filter Type Pills */}
          <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
            {(["day", "month", "year", "all"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all capitalize ${
                  filterType === type 
                    ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {type === "day" ? "Daily" : type === "month" ? "Monthly" : type === "year" ? "Yearly" : "All Time"}
              </button>
            ))}
          </div>

          {/* Dynamic Date/Time Picker */}
          {filterType === "day" && (
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input 
                type="date" 
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full sm:w-auto pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-2xl font-bold text-sm text-slate-100 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 outline-none transition-all shadow-inner"
              />
            </div>
          )}

          {filterType === "month" && (
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input 
                type="month" 
                value={filterValue.substring(0, 7)}
                onChange={(e) => setFilterValue(e.target.value + "-01")}
                className="w-full sm:w-auto pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-2xl font-bold text-sm text-slate-100 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 outline-none transition-all shadow-inner"
              />
            </div>
          )}

          {filterType === "year" && (
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input 
                type="number" 
                min="2020" max="2100"
                value={filterValue.substring(0, 4)}
                onChange={(e) => setFilterValue(e.target.value + "-01-01")}
                className="w-full sm:w-32 pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-2xl font-bold text-sm text-slate-100 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 outline-none transition-all shadow-inner font-mono"
              />
            </div>
          )}
        </div>

        {/* Right: High-Impact Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto relative z-10">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 active:scale-95 transition-all"
          >
            <Plus size={16} className="stroke-[3]" />
            <span>Add Deposits</span>
          </button>
          
          <button 
            onClick={() => setShowExportModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Financial KPI Cards (4 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Deposited */}
        <div className="relative group bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-cyan-950/30 border border-slate-800/90 hover:border-cyan-500/40 p-5 rounded-3xl shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Deposited</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            EGP {formatMoney(totalDeposited)}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {deposits.length} transactions
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Recorded transfers</span>
          </div>
        </div>

        {/* Average Deposit */}
        <div className="relative group bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/30 border border-slate-800/90 hover:border-indigo-500/40 p-5 rounded-3xl shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Average Deposit</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            EGP {formatMoney(avgDeposit)}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Mean value
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Per transfer operation</span>
          </div>
        </div>

        {/* Largest Single Deposit */}
        <div className="relative group bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-fuchsia-950/30 border border-slate-800/90 hover:border-fuchsia-500/40 p-5 rounded-3xl shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-fuchsia-500/10 rounded-full blur-2xl group-hover:bg-fuchsia-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Largest Deposit</span>
            <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shadow-inner">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            EGP {formatMoney(maxDeposit)}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
              Peak liquidity
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Single transaction ceiling</span>
          </div>
        </div>

        {/* Active Capital Routes */}
        <div className="relative group bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-amber-950/30 border border-slate-800/90 hover:border-amber-500/40 p-5 rounded-3xl shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Active Flow Types</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            {uniqueFlows.length}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Capital routes
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Internal routing paths</span>
          </div>
        </div>

      </div>

      {/* 3. 👑 OWNER CAPITAL DISTRIBUTION & WITHDRAWAL COMMAND CENTER */}
      {ownerSummary.length > 0 && (
        <div className="relative bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-950 border border-amber-500/30 rounded-3xl p-6 shadow-2xl overflow-hidden space-y-5">
          {/* Ambient Gold/Amber Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    Owner Capital Distribution & Withdrawals
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    VIP Stakeholders
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Aggregated money received by each corporate owner from Commercial Bank Accounts & Safe Vault
                </p>
              </div>
            </div>

            {/* Total Distributed Metric Badge */}
            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500/15 to-rose-500/15 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-mono font-black flex items-center gap-2 shadow-inner">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>EGP {formatMoney(totalOwnerDistributed)} Total Distributed</span>
            </div>
          </div>

          {/* Owner Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 relative z-10">
            {ownerSummary.map((owner) => {
              const sharePercent = totalOwnerDistributed > 0 ? (owner.total / totalOwnerDistributed) * 100 : 0;
              return (
                <div
                  key={owner.displayName}
                  className="bg-slate-950/80 border border-slate-800/90 hover:border-amber-500/50 rounded-2xl p-4 space-y-3.5 relative group transition-all duration-300 shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: Avatar, Name & Total */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-300 text-sm shadow-inner">
                          {owner.displayName.replace(/^mr\.\s*/i, "").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-black text-white text-sm tracking-tight flex items-center gap-1">
                            <span>{owner.displayName}</span>
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                            {owner.count} {owner.count === 1 ? 'transaction' : 'transactions'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Received</span>
                        <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                          EGP {formatMoney(owner.total)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar (% of Total Distributed) */}
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                        <span>Distribution Share</span>
                        <span className="text-amber-400 font-mono">{sharePercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, sharePercent))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Split Sources: Bank vs Safe */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex flex-col">
                      <span className="text-[9.5px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                        <Building2 className="w-3 h-3 text-sky-400" /> Bank
                      </span>
                      <span className="font-mono font-bold text-white text-xs truncate">
                        EGP {formatMoney(owner.fromBank)}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex flex-col">
                      <span className="text-[9.5px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                        <Vault className="w-3 h-3 text-amber-400" /> Safe
                      </span>
                      <span className="font-mono font-bold text-white text-xs truncate">
                        EGP {formatMoney(owner.fromSafe)}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Active Capital Flow Stream Tags */}
      {uniqueFlows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 p-3 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-2">
            <Layers className="w-3.5 h-3.5 text-rose-500" />
            <span>Active Streams ({deposits.length}):</span>
          </span>
          {uniqueFlows.map((flow, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-2 bg-slate-950/80 hover:bg-slate-950 px-3 py-1.5 rounded-xl text-slate-300 border border-slate-800 hover:border-slate-700 transition-all text-xs font-semibold shadow-xs"
            >
              <span className="capitalize text-slate-200 flex items-center gap-1">
                {getEntityIcon(flow.from, 13)}
                <span>{getEntityName(flow.from)}</span>
              </span>
              <ArrowRight size={12} className="text-rose-500" />
              <span className="capitalize text-slate-200 flex items-center gap-1">
                {getEntityIcon(flow.to, 13)}
                <span>{getEntityName(flow.to)}</span>
              </span>
              <span className="px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-400 font-mono text-[10px] font-black border border-rose-500/30">
                {flow.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 5. Executive Liquidity Ledger & Transactions Table */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 shadow-2xl rounded-3xl overflow-hidden">
        
        {/* Table View (Desktop) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="p-4">Transaction Date</th>
                <th className="p-4">Transfer Channel</th>
                <th className="p-4">Origin Source</th>
                <th className="p-4">Destination</th>
                <th className="p-4 text-right">Amount (EGP)</th>
                <th className="p-4">Remarks & Stakeholder</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Loader2 className="h-7 w-7 animate-spin mx-auto text-rose-500 mb-2" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading deposits ledger...</span>
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <Vault className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                    <p className="font-bold text-sm text-slate-300">No deposits recorded for this timeframe.</p>
                    <p className="text-xs text-slate-500 mt-0.5">Click "+ Add Deposits" above to log a new capital movement.</p>
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr 
                    key={deposit.id} 
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Date */}
                    <td className="p-4 font-mono font-bold text-xs text-slate-200">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{deposit.date}</span>
                      </div>
                    </td>

                    {/* Flow Badge */}
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-slate-300">
                        {getEntityIcon(deposit.from, 13)}
                        <ArrowRight size={11} className="text-rose-500" />
                        {getEntityIcon(deposit.to, 13)}
                      </div>
                    </td>

                    {/* From */}
                    <td className="p-4 font-bold capitalize text-slate-200 text-xs">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                        {getEntityName(deposit.from)}
                      </span>
                    </td>

                    {/* To */}
                    <td className="p-4 font-bold capitalize text-slate-200 text-xs">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                        {getEntityName(deposit.to)}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="p-4 text-right font-black text-emerald-400 font-mono text-base">
                      EGP {formatMoney(deposit.amount)}
                    </td>

                    {/* Note & Owner */}
                    <td className="p-4 text-xs text-slate-300 max-w-xs truncate">
                      {deposit.ownerName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 inline-flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-400" />
                            <span>{deposit.ownerName}</span>
                          </span>
                          {deposit.note && <span className="text-slate-400 truncate">• {deposit.note}</span>}
                        </div>
                      ) : (
                        <span>{deposit.note || <span className="text-slate-600 italic">No notes</span>}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => {
                            setSelectedDepositForPrint(deposit);
                            setTimeout(() => generatePDF(), 500);
                          }}
                          className="p-2 text-cyan-400 hover:text-white bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/20 rounded-xl transition-all shadow-xs"
                          title="Print Official Deposit Voucher"
                        >
                          <Printer size={15} />
                        </button>
                        
                        {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                          <button 
                            onClick={() => handleDelete(deposit.id)}
                            className="p-2 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 rounded-xl transition-all shadow-xs"
                            title="Delete Record"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Strictly md:hidden) */}
        <div className="md:hidden p-3 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
            </div>
          ) : deposits.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs rounded-2xl bg-slate-950 border border-slate-800">
              No deposits recorded for this period.
            </div>
          ) : (
            deposits.map((deposit) => (
              <div
                key={deposit.id}
                className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                      <span>{getEntityName(deposit.from)}</span>
                      <ArrowRight size={12} className="text-rose-500" />
                      <span>{getEntityName(deposit.to)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{deposit.date}</p>
                  </div>
                  <span className="text-base font-black font-mono text-emerald-400">
                    EGP {formatMoney(deposit.amount)}
                  </span>
                </div>

                {deposit.note && (
                  <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    {deposit.note}
                  </p>
                )}

                <div className="flex items-center justify-between border-t border-slate-800 pt-2.5">
                  <span className="text-[11px] text-slate-400 font-bold">
                    {deposit.ownerName ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Crown className="w-3 h-3" /> {deposit.ownerName}
                      </span>
                    ) : (
                      "Internal Transfer"
                    )}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedDepositForPrint(deposit);
                        setTimeout(() => generatePDF(), 500);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <Printer className="w-3.5 h-3.5" /> Voucher
                    </button>
                    {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                      <button
                        onClick={() => handleDelete(deposit.id)}
                        className="p-1.5 text-rose-400 hover:text-white bg-rose-500/10 rounded-xl border border-rose-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* 6. Executive Add Deposit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
                  <Vault className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Record Capital Deposit</h2>
                  <p className="text-xs text-slate-400">Log transfer between Safe, Bank, or Stakeholder</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddDeposit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Deposit Date *
                  </label>
                  <input 
                    type="date"
                    required
                    value={newDeposit.date}
                    onChange={e => setNewDeposit({...newDeposit, date: e.target.value})}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Amount (EGP) *
                  </label>
                  <input 
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newDeposit.amount}
                    onChange={e => setNewDeposit({...newDeposit, amount: e.target.value})}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-black text-emerald-400 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Source & Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Transfer From *
                  </label>
                  <select 
                    value={newDeposit.from}
                    onChange={e => setNewDeposit({...newDeposit, from: e.target.value})}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-white text-sm capitalize"
                  >
                    <option value="safe">Vault Safe</option>
                    <option value="owner">Corporate Owner</option>
                    <option value="bank">Commercial Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Transfer To *
                  </label>
                  <select 
                    value={newDeposit.to}
                    onChange={e => setNewDeposit({...newDeposit, to: e.target.value})}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-white text-sm capitalize"
                  >
                    <option value="bank">Commercial Bank</option>
                    <option value="owner">Corporate Owner</option>
                    <option value="safe">Vault Safe</option>
                  </select>
                </div>
              </div>

              {/* Owner Name field */}
              {(newDeposit.from === "owner" || newDeposit.to === "owner") && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-amber-300">
                    Stakeholder / Owner Name *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Mr. Hesham, Mr. Ashraf, Mr. Youssef"
                    value={newDeposit.ownerName}
                    onChange={e => setNewDeposit({...newDeposit, ownerName: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-white text-sm"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Remarks / Purpose
                </label>
                <textarea 
                  placeholder="Additional reference, cheque number, or notes..."
                  value={newDeposit.note}
                  onChange={e => setNewDeposit({...newDeposit, note: e.target.value})}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 min-h-[90px] resize-none text-sm text-slate-200"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 shadow-lg shadow-rose-500/25 disabled:opacity-50 transition-all flex items-center gap-2 text-sm active:scale-95"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Save & Generate Voucher"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7. Hidden Print Receipt Container (Preserved Exact Structure) */}
      {selectedDepositForPrint && (
        <div id="single-deposit-print-wrapper" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -9999, pointerEvents: 'none' }}>
          <div 
            id="pdf-deposit-slip" 
            style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}
          >
            <div style={{ padding: '60px', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', paddingBottom: '24px', marginBottom: '40px' }}>
                <div>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Deposit Receipt</h1>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Official Financial Record</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Receipt ID</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e293b', fontFamily: 'monospace' }}>{selectedDepositForPrint.id?.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>

              {/* Company Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Company</p>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px 0' }}>{(selectedDepositForPrint.storeId || currentBranch || "").toLowerCase().includes("ola") || (selectedDepositForPrint.storeId || currentBranch || "").toLowerCase().includes("koronfol") ? "ANH Trade" : "El Masreya for Trade"}</p>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Branch: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{currentBranch === "all" ? "El Alamein 4" : currentBranch === "ola" ? "Ola" : "El Alamein 4"}</span></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Date & Time</p>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>{new Date(selectedDepositForPrint.createdAt?.toDate ? selectedDepositForPrint.createdAt.toDate() : selectedDepositForPrint.createdAt || Date.now()).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>{new Date(selectedDepositForPrint.createdAt?.toDate ? selectedDepositForPrint.createdAt.toDate() : selectedDepositForPrint.createdAt || Date.now()).toLocaleTimeString('en-US')}</p>
                </div>
              </div>

              {/* Transaction Details */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px', marginBottom: '40px' }}>
                <h3 style={{ fontSize: '14px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', margin: '0 0 24px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Transaction Details</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Transferred From</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'capitalize' }}>{getEntityName(selectedDepositForPrint.from)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Transferred To</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'capitalize' }}>{getEntityName(selectedDepositForPrint.to)}</p>
                  </div>
                </div>

                {selectedDepositForPrint.ownerName && (
                  <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Owner / Depositor Name</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{selectedDepositForPrint.ownerName}</p>
                  </div>
                )}
              </div>

              {/* Amount Box */}
              <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Deposit Amount</span>
                <span style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff' }}>EGP {formatMoney(selectedDepositForPrint.amount)}</span>
              </div>

              {/* Notes */}
              {selectedDepositForPrint.note && (
                <div style={{ marginBottom: '40px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Notes / Remarks</p>
                  <p style={{ fontSize: '16px', color: '#1e293b', margin: 0, lineHeight: '1.5' }}>{selectedDepositForPrint.note}</p>
                </div>
              )}

              {/* System Verification Stamp */}
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '40px' }}>
                <div style={{ border: '4px solid #16a34a', borderRadius: '8px', padding: '16px 32px', textAlign: 'center', transform: 'rotate(-2deg)' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '2px' }}>Approved & Saved</p>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase', letterSpacing: '1px' }}>Recorded in Financial Database</p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Generated by: <span style={{ fontWeight: 'bold', color: '#64748b' }}>{selectedDepositForPrint.createdBy}</span></p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Secure Automated Receipt</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportFinancialsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentTabName="Deposits"
        currentFilterType={filterType}
        currentFilterValue={filterValue}
        currentTabData={deposits}
        currentBranch={currentBranch}
      />
    </div>
  );
}
