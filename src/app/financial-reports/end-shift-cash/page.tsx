"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, setDoc, limit } from "firebase/firestore";
import { 
  ArrowLeft, 
  Wallet, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Plus, 
  Calendar, 
  Printer, 
  FilterX, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Building2,
  Receipt,
  Info
} from "lucide-react";
import Link from "next/link";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeDate, matchesBranch } from "@/lib/financial-sync";

type DetailItem = {
  description: string;
  po: string;
  price?: number | string;
};

type EndShiftRecord = {
  id: string; // The date string YYYY-MM-DD or custom doc id
  date: string;
  startCash: number;
  cash: number;
  visa: number;
  deduction: number;
  details?: string;
  poNumbers?: string;
  items?: DetailItem[];
  endCash: number;
  branchId?: string;
  isAutoSynced?: boolean;
  isManualOverride?: boolean;
};

export default function EndShiftCashPage() {
  const { currentBranch } = useBranch();
  
  // Raw Data from Firestore
  const [manualRecords, setManualRecords] = useState<any[]>([]);
  const [rawSales, setRawSales] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EndShiftRecord>>({});
  
  // Add new row state
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Real-time synchronization listeners for end_shift_cash, sales, and cash_payments
  useEffect(() => {
    setLoading(true);

    // 1. Manual / Overridden end_shift_cash records
    const endShiftQ = query(collection(db, "end_shift_cash"), orderBy("date", "desc"), limit(400));
    const unsubEndShift = onSnapshot(endShiftQ, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setManualRecords(docs);
    }, (err) => {
      console.error("end_shift_cash snapshot error:", err);
    });

    // 2. Shift Sales (Cash, Visa, Over/Short)
    const salesQ = query(collection(db, "sales"), orderBy("date", "desc"), limit(800));
    const unsubSales = onSnapshot(salesQ, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawSales(docs);
    }, (err) => {
      console.error("sales snapshot error:", err);
    });

    // 3. Cash Payments (Deductions, Supplier & Maintenance details, PO numbers)
    const payQ = query(collection(db, "cash_payments"), orderBy("date", "desc"), limit(800));
    const unsubPayments = onSnapshot(payQ, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawPayments(docs);
      setLoading(false);
    }, (err) => {
      console.error("cash_payments snapshot error:", err);
      setLoading(false);
    });

    return () => {
      unsubEndShift();
      unsubSales();
      unsubPayments();
    };
  }, []);

  // Filter raw data by branch
  const branchFiltered = useMemo(() => {
    const sales = rawSales.filter(s => matchesBranch(s, currentBranch));
    const payments = rawPayments.filter(p => matchesBranch(p, currentBranch));
    const manuals = manualRecords.filter((r: any) => {
      if (!currentBranch || currentBranch === "all") return true;
      const bId = (r.branchId || "alamein4").toLowerCase();
      const target = currentBranch.toLowerCase();
      return bId.includes(target) || target.includes(bId);
    });
    return { sales, payments, manuals };
  }, [rawSales, rawPayments, manualRecords, currentBranch]);

  // Aggregate and merge all unique dates across sales, payments, and manual overrides
  const computedRecords = useMemo(() => {
    const { sales, payments, manuals } = branchFiltered;

    // Map manual records by normalized date
    const manualByDate = new Map<string, any>();
    manualRecords.forEach(m => {
      const d = normalizeDate(m.date);
      if (d) {
        // If current branch matches or not specified
        if (!currentBranch || currentBranch === "all" || matchesBranch(m, currentBranch)) {
          manualByDate.set(d, m);
        }
      }
    });

    // Gather all unique normalized dates
    const dateSet = new Set<string>();
    sales.forEach(s => {
      const d = normalizeDate(s.date || s.createdAt);
      if (d) dateSet.add(d);
    });
    payments.forEach(p => {
      const d = normalizeDate(p.date || p.createdAt);
      if (d) dateSet.add(d);
    });
    manuals.forEach(m => {
      const d = normalizeDate(m.date);
      if (d) dateSet.add(d);
    });

    // Sort dates chronologically ascending
    const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

    const result: EndShiftRecord[] = [];
    let runningEndCash = 0;

    sortedDates.forEach((dateStr, index) => {
      // 1. Sales Calculation for this date
      const daysSales = sales.filter(s => normalizeDate(s.date || s.createdAt) === dateStr);
      const salesCash = daysSales.reduce((sum, s) => sum + Number(s.cash || 0), 0);
      const overAmount = daysSales.reduce((sum, s) => {
        const os = Number(s.overShort || 0);
        return sum + (os > 0 ? os : 0);
      }, 0);
      const autoCash = salesCash + overAmount;
      const autoVisa = daysSales.reduce((sum, s) => sum + Number(s.visa || 0), 0);

      // 2. Payments Calculation for this date (Deductions & Details + PO Numbers)
      const daysPayments = payments.filter(p => normalizeDate(p.date || p.createdAt) === dateStr);
      const autoDeduction = daysPayments.reduce((sum, p) => sum + Number(p.amount || p.total || 0), 0);

      const autoItems: DetailItem[] = daysPayments.map(p => {
        const comp = (p.companyName || "").trim();
        const desc = (p.categoryNote || p.description || "").trim();
        let description = comp;
        if (desc && desc !== comp) {
          description = comp ? `${comp} • ${desc}` : desc;
        }
        if (!description) description = "Payment / مصاريف";

        return {
          description,
          po: p.poNumber ? String(p.poNumber).trim() : "",
          price: Number(p.amount || p.total || 0)
        };
      });

      // 3. Check for manual override record
      const manualDoc = manualByDate.get(dateStr);
      const isManual = !!manualDoc && manualDoc.isManualOverride === true;

      let cash = autoCash;
      let visa = autoVisa;
      let deduction = autoDeduction;
      let items: DetailItem[] = autoItems;

      if (isManual) {
        cash = Number(manualDoc.cash ?? autoCash);
        visa = Number(manualDoc.visa ?? autoVisa);
        deduction = Number(manualDoc.deduction ?? autoDeduction);
        
        if (manualDoc.items && manualDoc.items.length > 0) {
          items = manualDoc.items;
        } else if (manualDoc.details) {
          const detArr = manualDoc.details.split("/").map((s: string) => s.trim()).filter(Boolean);
          const poArr = manualDoc.poNumbers ? manualDoc.poNumbers.split("/").map((s: string) => s.trim()) : [];
          items = detArr.map((det: string, i: number) => ({
            description: det,
            po: poArr[i] || ""
          }));
        }
      }

      // Start cash: for first row, either custom or previous day's end cash
      const startCash = index === 0 ? (manualDoc?.startCash !== undefined ? Number(manualDoc.startCash) : 0) : runningEndCash;
      const endCash = startCash + cash - deduction;
      runningEndCash = endCash;

      result.push({
        id: manualDoc?.id || dateStr,
        date: dateStr,
        startCash,
        cash,
        visa,
        deduction,
        items,
        endCash,
        branchId: manualDoc?.branchId || currentBranch,
        isAutoSynced: !isManual,
        isManualOverride: isManual
      });
    });

    return result;
  }, [branchFiltered, manualRecords, currentBranch]);

  // Apply Date Filters
  const filteredRecords = useMemo(() => {
    return computedRecords.filter(r => {
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
      return true;
    });
  }, [computedRecords, fromDate, toDate]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalCash = filteredRecords.reduce((sum, r) => sum + r.cash, 0);
    const totalVisa = filteredRecords.reduce((sum, r) => sum + r.visa, 0);
    const totalDeductions = filteredRecords.reduce((sum, r) => sum + r.deduction, 0);
    const latestEndCash = filteredRecords.length > 0 ? filteredRecords[filteredRecords.length - 1].endCash : 0;
    const daysCount = filteredRecords.length;

    return { totalCash, totalVisa, totalDeductions, latestEndCash, daysCount };
  }, [filteredRecords]);

  // Compute the preview start cash for adding a new row
  const editPreviewStartCash = useMemo(() => {
    if (!editForm.date) return 0;
    const prevs = computedRecords.filter(r => r.date < editForm.date!).sort((a, b) => b.date.localeCompare(a.date));
    return prevs.length > 0 ? prevs[0].endCash : 0;
  }, [computedRecords, editForm.date]);

  const handleDelete = async (id: string) => {
    toast.warning("Are you sure you want to delete this custom override?", {
      description: "Day will automatically revert to live sales and payments calculation.",
      action: {
        label: "Revert to Auto",
        onClick: async () => {
          try {
            await deleteDoc(doc(db, "end_shift_cash", id));
            toast.success("Reverted to automatic calculation");
            vibrateSuccess();
          } catch (error: any) {
            console.error(error);
            toast.error("Failed to delete record: " + error.message);
            vibrateError();
          }
        }
      }
    });
  };

  const handleResetToAuto = async (record: EndShiftRecord) => {
    try {
      await deleteDoc(doc(db, "end_shift_cash", record.id));
      toast.success(`Reset ${record.date} to live auto-sync!`);
      vibrateSuccess();
    } catch (e: any) {
      toast.error("Could not reset record: " + e.message);
    }
  };

  const startEditing = (record: EndShiftRecord) => {
    setIsAddingNew(false);
    setEditingId(record.id);
    setEditForm({
      ...record,
      items: record.items && record.items.length > 0 ? [...record.items] : [{ description: "", po: "", price: "" }]
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setEditForm({});
  };

  const startNewRow = () => {
    setEditingId(null);
    setIsAddingNew(true);
    
    // Default to the day after the last record or today
    let nextDate = new Date().toISOString().split('T')[0];
    if (computedRecords.length > 0) {
      const lastRecord = computedRecords[computedRecords.length - 1];
      const d = new Date(lastRecord.date);
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }
    
    setEditForm({
      date: nextDate,
      cash: 0,
      visa: 0,
      deduction: 0,
      items: [{ description: "", po: "", price: "" }]
    });
  };

  const handleAddItem = () => {
    setEditForm(prev => ({
      ...prev,
      items: [...(prev.items || []), { description: "", po: "", price: "" }]
    }));
  };

  const handleUpdateItem = (index: number, field: keyof DetailItem, value: string | number) => {
    setEditForm(prev => {
      const newItems = [...(prev.items || [])];
      newItems[index] = { ...newItems[index], [field]: value };
      
      const hasPrices = newItems.some(i => i.price !== undefined && i.price !== "");
      if (hasPrices) {
        const totalDeduction = newItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        return { ...prev, items: newItems, deduction: totalDeduction };
      }
      
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditForm(prev => {
      const newItems = [...(prev.items || [])];
      newItems.splice(index, 1);
      
      const hasPrices = newItems.some(i => i.price !== undefined && i.price !== "");
      if (hasPrices || newItems.length === 0) {
        const totalDeduction = newItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        return { ...prev, items: newItems, deduction: totalDeduction };
      }
      
      return { ...prev, items: newItems };
    });
  };

  const saveRow = async () => {
    if (!editForm.date) {
      toast.error("Date is required.");
      return;
    }

    try {
      let prevEndCash = 0;
      const prevRecords = computedRecords.filter(r => r.date < editForm.date!).sort((a, b) => b.date.localeCompare(a.date));
      if (prevRecords.length > 0) prevEndCash = prevRecords[0].endCash;
      
      const numStart = editForm.startCash !== undefined ? Number(editForm.startCash) : prevEndCash;
      const numCash = Number(editForm.cash || 0);
      const numVisa = Number(editForm.visa || 0);
      const numDed = Number(editForm.deduction || 0);
      const numEnd = numStart + numCash - numDed;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;

      const cleanedItems = (editForm.items || []).filter(item => item.description.trim() !== "");
      const detailsStr = cleanedItems.map(i => i.description).join(" / ");
      const poStr = cleanedItems.map(i => i.po).join(" / ");

      await setDoc(doc(db, "end_shift_cash", `${editForm.date!}_${bId}`), {
        date: editForm.date,
        startCash: numStart,
        cash: numCash,
        visa: numVisa,
        deduction: numDed,
        details: detailsStr,
        poNumbers: poStr,
        items: cleanedItems,
        endCash: numEnd,
        branchId: bId,
        isManualOverride: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setEditingId(null);
      setIsAddingNew(false);
      setEditForm({});
      toast.success("Record saved with manual override!");
      vibrateSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to save record: " + error.message);
      vibrateError();
    }
  };

  // Quick Preset Handlers
  const applyPreset = (preset: "thisMonth" | "lastMonth" | "last7" | "all") => {
    const today = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
    } else if (preset === "thisMonth") {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      setFromDate(`${year}-${month}-01`);
      setToDate(`${year}-${month}-31`);
    } else if (preset === "lastMonth") {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const year = prev.getFullYear();
      const month = String(prev.getMonth() + 1).padStart(2, "0");
      setFromDate(`${year}-${month}-01`);
      setToDate(`${year}-${month}-31`);
    } else if (preset === "last7") {
      const past = new Date(Date.now() - 7 * 86400000);
      setFromDate(past.toISOString().split("T")[0]);
      setToDate(today.toISOString().split("T")[0]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 print:bg-white print:text-black print:p-0 print:pb-0">
      
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/financial-reports" 
              className="text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-2 font-bold text-sm bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Link>
            <div className="h-5 w-px bg-slate-800 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5 text-teal-400" />
                End Shift Cash Ledger
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  <Sparkles className="w-3 h-3 text-teal-400" /> Auto Synced
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 transition-all shadow-sm"
              title="Print Ledger Report"
            >
              <Printer className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
            <button 
              onClick={startNewRow}
              disabled={isAddingNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={3} />
              <span>Add Custom Row</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-none space-y-6">

        {/* Floating Executive KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:hidden">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Cash (+ IN)</span>
              <div className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-teal-400 font-mono tracking-tight">
              {summary.totalCash.toLocaleString()} <span className="text-xs text-slate-500 font-sans">EGP</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Sales Cash + Over</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Visa</span>
              <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg"><Receipt className="w-4 h-4" /></div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-400 font-mono tracking-tight">
              {summary.totalVisa.toLocaleString()} <span className="text-xs text-slate-500 font-sans">EGP</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Shift Electronic Sales</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Deductions</span>
              <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg"><TrendingDown className="w-4 h-4" /></div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-red-400 font-mono tracking-tight">
              {summary.totalDeductions.toLocaleString()} <span className="text-xs text-slate-500 font-sans">EGP</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Supplier & Maintenance Out</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Closing End Cash</span>
              <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"><Wallet className="w-4 h-4" /></div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
              {summary.latestEndCash.toLocaleString()} <span className="text-xs text-slate-500 font-sans">EGP</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Net Running Balance</p>
          </div>

          <div className="col-span-2 md:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Ledger Span</span>
              <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg"><Calendar className="w-4 h-4" /></div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                {summary.daysCount} <span className="text-xs text-slate-500 font-sans">Days</span>
              </p>
              <p className="text-[10px] text-teal-400 font-semibold mt-1">Live Database Linked</p>
            </div>
          </div>

        </div>

        {/* Filters & Presets Strip */}
        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center print:hidden">
          
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
            <button 
              onClick={() => applyPreset("thisMonth")} 
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors whitespace-nowrap"
            >
              This Month
            </button>
            <button 
              onClick={() => applyPreset("lastMonth")} 
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors whitespace-nowrap"
            >
              Last Month
            </button>
            <button 
              onClick={() => applyPreset("last7")} 
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors whitespace-nowrap"
            >
              Last 7 Days
            </button>
            <button 
              onClick={() => applyPreset("all")} 
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800/80 transition-colors whitespace-nowrap"
            >
              All Time
            </button>
          </div>

          {/* Date Pickers */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">From:</span>
              <input 
                type="date" 
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="bg-transparent border-0 text-xs text-white font-medium outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">To:</span>
              <input 
                type="date" 
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="bg-transparent border-0 text-xs text-white font-medium outline-none cursor-pointer"
              />
            </div>
            {(fromDate || toDate) && (
              <button 
                onClick={() => { setFromDate(""); setToDate(""); }}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
                title="Clear Dates"
              >
                <FilterX className="h-4 w-4" />
              </button>
            )}
          </div>

        </div>

        {/* Print Only Header */}
        <div className="hidden print:block mb-6 text-center">
          <h1 className="text-2xl font-black text-black uppercase">Circle K Franchise — End Shift Cash Report</h1>
          <p className="text-gray-600 font-semibold text-sm">
            Branch: {currentBranch === "all" ? "All Branches (Consolidated)" : currentBranch.toUpperCase()} | 
            Period: {fromDate && toDate ? `${fromDate} to ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Up to ${toDate}` : 'All Recorded Dates'}
          </p>
        </div>

        {/* Main Table Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:bg-white print:border-none print:shadow-none print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left print:text-xs">
              <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-slate-950/80 border-b border-slate-800 print:text-black print:bg-gray-100">
                <tr>
                  <th className="px-3.5 py-3 font-black whitespace-nowrap">Date</th>
                  <th className="px-3.5 py-3 font-black text-right whitespace-nowrap bg-slate-800/40 print:bg-transparent">Start Cash</th>
                  <th className="px-3.5 py-3 font-black text-right whitespace-nowrap text-teal-400 print:text-black">Cash (+ In)</th>
                  <th className="px-3.5 py-3 font-black text-right whitespace-nowrap text-blue-400 print:text-black">Visa</th>
                  <th className="px-3.5 py-3 font-black text-right whitespace-nowrap text-red-400 print:text-black">Deduction (- Out)</th>
                  <th className="px-4 py-3 font-black w-2/5">Details & PO Numbers</th>
                  <th className="px-3.5 py-3 font-black text-right whitespace-nowrap bg-slate-800/40 print:bg-transparent">End Cash (Auto)</th>
                  <th className="px-3 py-3 font-black text-center sticky right-0 bg-slate-950/95 shadow-[-4px_0_12px_rgba(0,0,0,0.4)] print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-gray-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full bg-slate-800" />
                        <p className="text-slate-400 text-sm font-semibold">Aggregating live shift sales & payment deductions...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 && !isAddingNew ? (
                  <tr>
                    <td colSpan={8} className="text-center p-16 text-slate-500 font-semibold bg-slate-950/30">
                      No shift records or payments found for this period.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredRecords.map((r, index) => {
                      const isEditing = editingId === r.id;
                      
                      return (
                        <tr 
                          key={r.id} 
                          className={`transition-colors print:break-inside-avoid ${
                            isEditing 
                              ? 'bg-teal-950/30' 
                              : r.isManualOverride 
                                ? 'bg-amber-950/10 hover:bg-amber-950/20' 
                                : 'hover:bg-slate-800/40'
                          } print:hover:bg-transparent`}
                        >
                          {/* Date */}
                          <td className="px-3.5 py-3 font-semibold whitespace-nowrap align-top">
                            {isEditing ? (
                              <input 
                                type="date" 
                                value={editForm.date} 
                                onChange={e => setEditForm({...editForm, date: e.target.value})} 
                                className="px-2.5 py-1.5 border border-slate-700 focus:border-teal-400 rounded-lg bg-slate-950 text-white text-xs font-mono" 
                              />
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-slate-500 print:hidden" />
                                  <span className="font-mono font-bold text-white print:text-black">
                                    {r.date.split('-').reverse().join('/')}
                                  </span>
                                </div>
                                {r.isManualOverride ? (
                                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.2 w-fit print:hidden">
                                    Manual Override
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-semibold text-teal-400/80 print:hidden">
                                    • Auto Synced
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          
                          {/* Start Cash */}
                          <td className="px-3.5 py-3 font-mono text-slate-400 text-right bg-slate-800/20 print:bg-transparent print:text-black align-top font-semibold">
                            {isEditing && index === 0 ? (
                              <input 
                                type="number" 
                                value={editForm.startCash} 
                                onChange={e => setEditForm({...editForm, startCash: Number(e.target.value)})} 
                                className="w-24 px-2 py-1 border border-teal-500 rounded-md text-right bg-slate-950 text-white font-mono text-xs" 
                              />
                            ) : (
                              r.startCash.toLocaleString()
                            )}
                          </td>

                          {/* Cash (+ In) = Sales Cash + Over */}
                          <td className="px-3.5 py-3 font-black text-teal-400 text-right print:text-black align-top font-mono">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={editForm.cash} 
                                onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} 
                                className="w-24 px-2 py-1 border border-teal-500 rounded-md text-right bg-slate-950 text-teal-400 font-mono text-xs font-bold" 
                              />
                            ) : (
                              r.cash.toLocaleString()
                            )}
                          </td>

                          {/* Visa */}
                          <td className="px-3.5 py-3 font-bold text-blue-400 text-right print:text-black align-top font-mono">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={editForm.visa} 
                                onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} 
                                className="w-24 px-2 py-1 border border-blue-500 rounded-md text-right bg-slate-950 text-blue-400 font-mono text-xs font-bold" 
                              />
                            ) : (
                              r.visa.toLocaleString()
                            )}
                          </td>

                          {/* Deduction (- Out) */}
                          <td className="px-3.5 py-3 font-bold text-red-400 text-right print:text-black align-top font-mono">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={editForm.deduction} 
                                onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} 
                                className="w-24 px-2 py-1 border border-red-500 rounded-md text-right bg-slate-950 text-red-400 font-mono text-xs font-bold" 
                              />
                            ) : (
                              r.deduction.toLocaleString()
                            )}
                          </td>

                          {/* Details & PO Numbers as itemized companies list */}
                          <td className="px-4 py-3 align-top min-w-[280px]">
                            {isEditing ? (
                              <div className="space-y-2">
                                {(editForm.items || []).map((item, i) => (
                                  <div key={i} className="flex items-start gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                                    <div className="flex-1 space-y-1.5">
                                      <input 
                                        type="text" 
                                        placeholder="Company / Description..."
                                        value={item.description} 
                                        onChange={e => handleUpdateItem(i, "description", e.target.value)} 
                                        className="w-full px-2.5 py-1 border border-slate-700 focus:border-teal-400 rounded-md bg-slate-900 text-white text-xs" 
                                      />
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          placeholder="PO #"
                                          value={item.po} 
                                          onChange={e => handleUpdateItem(i, "po", e.target.value)} 
                                          className="w-1/2 px-2 py-1 border border-slate-700 focus:border-teal-400 rounded-md bg-slate-900 text-slate-300 text-xs font-mono" 
                                        />
                                        <input 
                                          type="number" 
                                          placeholder="Price (EGP)"
                                          value={item.price ?? ""} 
                                          onChange={e => handleUpdateItem(i, "price", e.target.value)} 
                                          className="w-1/2 px-2 py-1 border border-slate-700 focus:border-teal-400 rounded-md bg-slate-900 text-red-400 font-mono text-xs font-bold text-right" 
                                        />
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => handleRemoveItem(i)} 
                                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded mt-1"
                                      title="Remove"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={handleAddItem}
                                  className="text-xs font-bold text-teal-400 bg-teal-950/40 hover:bg-teal-900/60 border border-teal-800/60 px-2 py-1.5 rounded-lg flex items-center gap-1 w-full justify-center transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add Detail
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {r.items && r.items.length > 0 ? (
                                  r.items.map((item, i) => (
                                    <div 
                                      key={i} 
                                      className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between border-b border-slate-800/60 print:border-gray-200 last:border-0 pb-1 last:pb-0 gap-1"
                                    >
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-200 print:text-black font-semibold text-xs leading-snug">
                                          • {item.description}
                                        </span>
                                        {item.po && (
                                          <span className="text-[10px] font-mono font-bold text-teal-300 bg-teal-950/80 border border-teal-800/60 px-1.5 py-0.5 rounded print:bg-transparent print:border-gray-400 print:text-black">
                                            PO: {item.po}
                                          </span>
                                        )}
                                      </div>
                                      {item.price !== undefined && item.price !== "" && (
                                        <span className="text-xs font-mono font-bold text-red-400 whitespace-nowrap print:text-black">
                                          {Number(item.price).toLocaleString()} EGP
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-500 italic text-xs">No details</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* End Cash (Auto) */}
                          <td className="px-3.5 py-3 font-mono font-black text-right text-white bg-slate-800/20 print:bg-transparent print:text-black align-top">
                            {isEditing ? (
                              <span className="text-teal-400">
                                {((Number(editForm.startCash ?? r.startCash)||0) + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                              </span>
                            ) : (
                              r.endCash.toLocaleString()
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-center sticky right-0 bg-slate-900/95 shadow-[-4px_0_12px_rgba(0,0,0,0.4)] print:hidden align-top">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button 
                                  onClick={saveRow} 
                                  className="p-1.5 bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-lg shadow transition-colors" 
                                  title="Save Changes"
                                >
                                  <Check className="h-4 w-4" strokeWidth={3} />
                                </button>
                                <button 
                                  onClick={cancelEditing} 
                                  className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors" 
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center items-center gap-1">
                                <button 
                                  onClick={() => startEditing(r)} 
                                  className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Edit Row"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                {r.isManualOverride && (
                                  <button 
                                    onClick={() => handleResetToAuto(r)} 
                                    className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                                    title="Reset to Live Auto Calculation"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </button>
                                )}
                                {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                                  <button 
                                    onClick={() => handleDelete(r.id)} 
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Delete Override"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* NEW ROW ENTRY */}
                    {isAddingNew && (
                      <tr className="bg-teal-950/20 border-b border-teal-900/60 print:hidden">
                        <td className="px-3.5 py-3 align-top">
                          <input 
                            type="date" 
                            value={editForm.date} 
                            onChange={e => setEditForm({...editForm, date: e.target.value})} 
                            className="px-2.5 py-1.5 border border-teal-600 focus:border-teal-400 rounded-lg bg-slate-950 text-white font-mono text-xs shadow-sm" 
                            autoFocus 
                          />
                        </td>
                        <td className="px-3.5 py-3 font-mono text-slate-400 text-right bg-slate-800/20 align-top font-semibold">
                          {editPreviewStartCash.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <input 
                            type="number" 
                            value={editForm.cash} 
                            onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} 
                            className="w-24 px-2 py-1 border border-teal-600 rounded-md text-right bg-slate-950 text-teal-400 font-mono text-xs font-bold" 
                            placeholder="0" 
                          />
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <input 
                            type="number" 
                            value={editForm.visa} 
                            onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} 
                            className="w-24 px-2 py-1 border border-blue-600 rounded-md text-right bg-slate-950 text-blue-400 font-mono text-xs font-bold" 
                            placeholder="0" 
                          />
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <input 
                            type="number" 
                            value={editForm.deduction} 
                            onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} 
                            className="w-24 px-2 py-1 border border-red-600 rounded-md text-right bg-slate-950 text-red-400 font-mono text-xs font-bold" 
                            placeholder="0" 
                          />
                        </td>
                        <td className="px-4 py-3 align-top min-w-[280px]">
                          <div className="space-y-2">
                            {(editForm.items || []).map((item, i) => (
                              <div key={i} className="flex items-start gap-2 bg-slate-950 p-2 rounded-lg border border-teal-800/60 shadow-sm">
                                <div className="flex-1 space-y-1.5">
                                  <input 
                                    type="text" 
                                    placeholder="Company / Description..."
                                    value={item.description} 
                                    onChange={e => handleUpdateItem(i, "description", e.target.value)} 
                                    className="w-full px-2.5 py-1 border border-slate-700 focus:border-teal-400 rounded-md bg-slate-900 text-white text-xs" 
                                  />
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="PO #"
                                      value={item.po} 
                                      onChange={e => handleUpdateItem(i, "po", e.target.value)} 
                                      className="w-1/2 px-2 py-1 border border-slate-700 focus:border-teal-400 rounded-md bg-slate-900 text-slate-300 text-xs font-mono" 
                                    />
                                    <input 
                                      type="number" 
                                      placeholder="Price (EGP)"
                                      value={item.price ?? ""} 
                                      onChange={e => handleUpdateItem(i, "price", e.target.value)} 
                                      className="w-1/2 px-2 py-1 border border-slate-700 focus:border-teal-400 rounded-md bg-slate-900 text-red-400 font-mono text-xs font-bold text-right" 
                                    />
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleRemoveItem(i)} 
                                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded mt-1"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              onClick={handleAddItem}
                              className="text-xs font-bold text-teal-300 bg-teal-950/60 hover:bg-teal-900/80 border border-teal-700/60 px-2 py-1.5 rounded-lg flex items-center gap-1 w-full justify-center transition-colors shadow-sm"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Detail
                            </button>
                          </div>
                        </td>
                        <td className="px-3.5 py-3 font-mono font-black text-white text-right bg-slate-800/20 align-top">
                          {(editPreviewStartCash + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center sticky right-0 bg-slate-900/95 align-top">
                          <div className="flex justify-center gap-1">
                            <button 
                              onClick={saveRow} 
                              className="p-1.5 bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-lg shadow-md font-bold transition-all" 
                              title="Save Row"
                            >
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </button>
                            <button 
                              onClick={cancelEditing} 
                              className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors" 
                              title="Cancel"
                            >
                              <X className="h-4 w-4" strokeWidth={3} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
