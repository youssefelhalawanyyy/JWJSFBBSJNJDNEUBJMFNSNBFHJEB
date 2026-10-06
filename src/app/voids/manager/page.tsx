"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { dispatchNotificationSystem } from "@/lib/notifications";
import { Search, Printer, Shield, ShieldAlert, Image as ImageIcon, ArrowLeftRight, Calendar, CheckCircle, ArrowLeft, TrendingUp, X, Clock, XCircle, AlertCircle, Filter } from "lucide-react";
import Barcode from "react-barcode";
import { useBranch } from "@/context/BranchContext";
import { DataTable } from "@/components/ui/DataTable";
import { PageTransition } from "@/components/PageTransition";
import { DrawerProfile } from "@/components/DrawerProfile";
import { toast } from "sonner";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";

export default function ManagerVoidsPage() {
  const [voids, setVoids] = useState<any[]>([]);
  const [selectedVoid, setSelectedVoid] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "closed" | "rejected">("all");
  const { currentBranch } = useBranch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "void_requests"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setVoids(data);
      setLoading(false);
      setErrorMsg("");
    }, (error) => {
      console.error("Firestore error:", error);
      if (error.code === 'permission-denied') {
        setErrorMsg("Missing Permissions: You need to add 'void_requests' to your Firebase Firestore Rules.");
      } else {
        setErrorMsg(error.message);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleUpdateStatus = async (targetVoid: any, newStatus: "closed_on_system" | "rejected" | "pending", customReason?: string) => {
    if (!targetVoid) return;
    setUpdatingStatus(true);
    triggerHapticFeedback([15, 30]);
    playPopSound();

    try {
      const updatePayload: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || "Manager Operations"
      };

      const reasonToUse = customReason || rejectReason || "Rejected by Manager";

      if (newStatus === "rejected") {
        updatePayload.rejectionReason = reasonToUse;
        updatePayload.rejectedAt = new Date().toISOString();
      } else if (newStatus === "closed_on_system") {
        updatePayload.approvedAt = new Date().toISOString();
      }

      await updateDoc(doc(db, "void_requests", targetVoid.id), updatePayload);

      // Status Notification Dispatches
      const statusLabel = newStatus === "closed_on_system" 
        ? "APPROVED & CLOSED" 
        : newStatus === "rejected" 
        ? "REJECTED" 
        : "PENDING REVIEW";

      // Dispatch Universal System Notification
      const notifTitle = newStatus === "closed_on_system" 
        ? `✅ Void Approved - Receipt #${targetVoid.transactionNumber || targetVoid.invoiceNumber || 'N/A'}`
        : newStatus === "rejected" 
        ? `❌ Void Rejected - Receipt #${targetVoid.transactionNumber || targetVoid.invoiceNumber || 'N/A'}`
        : `⏳ Void Status Updated`;

      const notifBody = `Void of EGP ${Number(targetVoid.amount || 0).toLocaleString()} for Cashier ${targetVoid.cashierName || 'Cashier'} was ${statusLabel}.${newStatus === "rejected" ? `\nRejection Reason: "${reasonToUse}"` : ''}`;

      dispatchNotificationSystem({
        title: notifTitle,
        body: notifBody,
        type: "void",
        url: "/voids/manager",
        metadata: { status: newStatus, amount: targetVoid.amount, cashierName: targetVoid.cashierName, rejectReason: reasonToUse }
      });

      toast.success(`Void request ${targetVoid.transactionNumber} marked as ${statusLabel}!`);

      // Update local state
      const updatedVoidObj = { ...targetVoid, ...updatePayload };
      setSelectedVoid(updatedVoidObj);
      setShowRejectModal(false);
      setRejectReason("");

    } catch (e: any) {
      console.error("Failed to update status", e);
      toast.error("Failed to update status: " + (e.message || "Error"));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const generatePDF = () => {
    if (!selectedVoid) return;
    const printContent = document.getElementById("void-print-capture");
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=900,height=800');
    if (!printWindow) {
      alert("Please allow popups to print reports.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Void Report - ${selectedVoid.transactionNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@700&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0;
              -webkit-print-color-adjust: exact !important; 
              color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              background-color: white;
            }
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            .print-page {
              width: 210mm;
              height: 297mm;
              padding: 15mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              background: white;
              position: relative;
              page-break-after: avoid;
              overflow: hidden;
            }
            .print-hide { display: none !important; }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const filteredVoids = voids.filter(v => {
    const matchesBranch = currentBranch === "all" || !v.branchId || v.branchId === currentBranch;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (v.transactionNumber || "").toLowerCase().includes(q) ||
      (v.cashierName || "").toLowerCase().includes(q) ||
      (v.customerName || "").toLowerCase().includes(q) ||
      (v.reason || "").toLowerCase().includes(q);

    let matchesTab = true;
    if (filterTab === "pending") matchesTab = v.status !== "closed_on_system" && v.status !== "rejected";
    else if (filterTab === "closed") matchesTab = v.status === "closed_on_system";
    else if (filterTab === "rejected") matchesTab = v.status === "rejected";

    return matchesBranch && matchesSearch && matchesTab;
  });

  if (errorMsg) {
    return (
      <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-2xl mx-auto my-12 text-rose-300">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-lg font-black mb-2">Firestore Security Rule Notice</h2>
        <p className="text-xs font-mono bg-black/40 p-3 rounded-lg border border-rose-500/20 text-left overflow-x-auto">{errorMsg}</p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        
        {/* Sticky Blur Header */}
        <div className="sticky top-0 z-40 -mx-4 px-4 sm:mx-0 sm:px-0 py-4 bg-white/80 dark:bg-[#050810]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
              Void & Return Requests
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Review, approve, or reject cashier return logs and print receipts.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "all"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              All ({voids.length})
            </button>
            <button
              onClick={() => setFilterTab("pending")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "pending"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Pending ({voids.filter(v => v.status !== "closed_on_system" && v.status !== "rejected").length})
            </button>
            <button
              onClick={() => setFilterTab("closed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "closed"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Approved ({voids.filter(v => v.status === "closed_on_system").length})
            </button>
            <button
              onClick={() => setFilterTab("rejected")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "rejected"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Rejected ({voids.filter(v => v.status === "rejected").length})
            </button>
          </div>
        </div>

        {/* Mobile View Cards (md:hidden) */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
              {filterTab.toUpperCase()} VOIDS ({filteredVoids.length})
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1 text-xs rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-cyan-400 w-36"
            />
          </div>

          {filteredVoids.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs rounded-2xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-slate-800">
              No void requests found.
            </div>
          ) : (
            filteredVoids.map((v) => {
              const isClosed = v.status === "closed_on_system";
              const isRejected = v.status === "rejected";
              const isHighValue = Number(v.amount) > 150;

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-slate-800 shadow-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-cyan-600 dark:text-cyan-400">{v.transactionNumber}</span>
                        {isHighValue && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm animate-pulse">
                            HIGH VALUE
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">Cashier: {v.cashierName || "N/A"}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Reason: {v.reason || "N/A"}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white block">
                        {Number(v.amount || 0).toFixed(2)} EGP
                      </span>
                      <span className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
                        isClosed 
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : isRejected
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}>
                        {isClosed ? "Approved & Closed" : isRejected ? "Rejected ❌" : "Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#1E293B] pt-2.5">
                    <span className="text-[10px] font-mono text-slate-400">
                      {v.preciseTimestamp || (v.createdAt ? new Date(v.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')}
                    </span>
                    <button
                      onClick={() => setSelectedVoid(v)}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-extrabold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <Shield className="w-3.5 h-3.5" /> Review Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4 sm:p-6 shadow-sm relative z-10">
          <DataTable
            columns={[
              {
                accessorKey: "createdAt",
                header: "Date/Time",
                cell: ({ row }) => {
                  const voidData = row.original;
                  return (
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200">{voidData.preciseTimestamp || new Date(voidData.createdAt).toLocaleString('en-GB')}</div>
                      {Number(voidData.amount) > 150 && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-full shadow-sm">
                          High Value
                        </span>
                      )}
                    </div>
                  );
                }
              },
              {
                accessorKey: "transactionNumber",
                header: "TXN #",
                cell: ({ row }) => <span className="font-mono text-slate-600 dark:text-slate-400 font-bold">{row.getValue("transactionNumber")}</span>
              },
              {
                accessorKey: "cashierName",
                header: "Cashier",
                cell: ({ row }) => <span className="font-semibold text-slate-700 dark:text-slate-300">{row.getValue("cashierName") || 'N/A'}</span>
              },
              {
                accessorKey: "customerName",
                header: "Customer",
                cell: ({ row }) => <span className="font-semibold text-slate-700 dark:text-slate-300">{row.getValue("customerName")}</span>
              },
              {
                accessorKey: "amount",
                header: "Amount",
                cell: ({ row }) => (
                  <span className={`font-mono font-bold ${Number(row.getValue("amount")) > 150 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-200'}`}>
                    {Number(row.getValue("amount")).toFixed(2)} EGP
                  </span>
                )
              },
              {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => {
                  const status = row.getValue("status") as string;
                  const isClosed = status === "closed_on_system";
                  const isRejected = status === "rejected";
                  return (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      isClosed 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                        : isRejected
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    }`}>
                      {isClosed ? "Closed" : isRejected ? "Rejected ❌" : "Pending"}
                    </span>
                  );
                }
              },
              {
                id: "actions",
                cell: ({ row }) => (
                  <button
                    onClick={() => setSelectedVoid(row.original)}
                    className="px-3 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-bold hover:bg-cyan-500/20 transition-all cursor-pointer"
                  >
                    Review
                  </button>
                )
              }
            ]}
            data={filteredVoids}
          />
        </div>

        {/* Detail Drawer */}
        {selectedVoid && (
          <DrawerProfile 
            isOpen={!!selectedVoid} 
            onClose={() => setSelectedVoid(null)} 
            title={`Void Details - ${selectedVoid.transactionNumber}`}
          >
            <div className="flex flex-col h-full space-y-6">
              
              {/* STATUS INDICATOR BANNER */}
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                selectedVoid.status === "closed_on_system"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : selectedVoid.status === "rejected"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}>
                <span className="flex items-center gap-1.5 font-black">
                  {selectedVoid.status === "closed_on_system" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  {selectedVoid.status === "rejected" && <XCircle className="w-4 h-4 text-rose-500" />}
                  {(selectedVoid.status !== "closed_on_system" && selectedVoid.status !== "rejected") && <Clock className="w-4 h-4 text-amber-500" />}
                  {selectedVoid.status === "closed_on_system" ? "APPROVED & CLOSED ON SYSTEM" : selectedVoid.status === "rejected" ? "REJECTED BY MANAGER" : "PENDING MANAGER REVIEW"}
                </span>

                {selectedVoid.status === "rejected" && selectedVoid.rejectionReason && (
                  <span className="text-[10px] font-mono opacity-80 max-w-[180px] truncate">
                    Reason: {selectedVoid.rejectionReason}
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS (APPROVE, REJECT, PENDING, PRINT) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedVoid, "closed_on_system")}
                  className={`px-3.5 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    selectedVoid.status === "closed_on_system"
                      ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Approve & Close
                </button>

                <button
                  disabled={updatingStatus}
                  onClick={() => setShowRejectModal(true)}
                  className={`px-3.5 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    selectedVoid.status === "rejected"
                      ? "bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                  }`}
                >
                  <XCircle className="w-4 h-4" /> Reject Void Request
                </button>

                {selectedVoid.status && selectedVoid.status !== "pending" && (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus(selectedVoid, "pending")}
                    className="col-span-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" /> Reset Status to Pending
                  </button>
                )}

                <button
                  onClick={generatePDF}
                  className="col-span-2 px-3.5 py-3 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Official Record
                </button>
              </div>

              {/* Printable Record Capture Preview */}
              <div className="bg-white rounded-lg p-2 overflow-x-auto print-container-wrapper relative">
                <div id="void-print-capture" style={{ width: '800px', height: '1131px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', transform: 'scale(0.45)', transformOrigin: 'top left', marginBottom: '-55%', padding: '15px' }}>

                  {/* Micro-Typography Security Borders */}
                  <div style={{ position: 'absolute', top: '-15mm', left: '-15mm', right: '-15mm', bottom: '-15mm', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                    </div>
                    <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                    </div>
                  </div>

                  {/* Automated Digital Audit Stamp (Giant Watermark) */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '65px', fontWeight: '900', color: selectedVoid.status === "rejected" ? 'rgba(225, 29, 72, 0.12)' : selectedVoid.status === "closed_on_system" ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }}>
                    {selectedVoid.status === "rejected" ? "VOID REJECTED ❌" : selectedVoid.status === "closed_on_system" ? "VOID AUTHORIZED & CLOSED" : "PENDING REVIEW"}
                  </div>

                  {/* Header Section */}
                  <div style={{ paddingBottom: '10px', borderBottom: '4px solid #1e293b', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '55px', height: '55px', backgroundColor: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', lineHeight: 1 }}>K</span>
                      </div>
                      <div>
                        <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>OFFICIAL VOID RECORD</h1>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0', fontWeight: '600' }}>CIRCLE K ANH PORTAL VOID</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ border: `3px solid ${selectedVoid.status === "rejected" ? '#ef4444' : '#1e293b'}`, padding: '6px 10px', borderRadius: '8px', backgroundColor: selectedVoid.status === "rejected" ? '#fef2f2' : '#f8fafc' }}>
                        <p style={{ margin: 0, fontSize: '9px', color: selectedVoid.status === "rejected" ? '#dc2626' : '#475569', textTransform: 'uppercase', fontWeight: '800', textAlign: 'center', marginBottom: '2px' }}>Total Void Amount</p>
                        <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: selectedVoid.status === "rejected" ? '#dc2626' : '#0f172a', fontFamily: '"JetBrains Mono", monospace' }}>EGP {Number(selectedVoid.amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Metadata Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', position: 'relative', zIndex: 10 }}>
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0' }}>Transaction #</p>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0, fontFamily: 'monospace' }}>{selectedVoid.transactionNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0' }}>Status</p>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: selectedVoid.status === 'rejected' ? '#dc2626' : selectedVoid.status === 'closed_on_system' ? '#16a34a' : '#d97706', margin: 0, textTransform: 'uppercase' }}>
                        {selectedVoid.status === "closed_on_system" ? "APPROVED & CLOSED" : selectedVoid.status === "rejected" ? `REJECTED (${selectedVoid.rejectionReason || "Manager Decision"})` : "PENDING REVIEW"}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0' }}>Cashier</p>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.cashierName || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0' }}>Customer</p>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.customerName || 'Walk-in'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0' }}>Reason</p>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.reason || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0' }}>Logged Timestamp</p>
                      <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.preciseTimestamp || selectedVoid.createdAt}</p>
                    </div>
                  </div>

                  {/* Main Content Area: 2 Columns (Left: Items & Summary, Right: Receipt Photo Evidence) */}
                  <div style={{ display: 'flex', gap: '12px', flex: 1, marginBottom: '12px', position: 'relative', zIndex: 10 }}>
                    
                    {/* Left Column: Items List & Financial Summary */}
                    <div style={{ flex: '0 0 46%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedVoid.extractedReceipt && selectedVoid.extractedReceipt.items && selectedVoid.extractedReceipt.items.length > 0 ? (
                        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                          <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#1e293b' }}>
                            Scanned Items List
                          </div>
                          <div style={{ padding: '8px', flex: 1, overflow: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#64748b' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 2px', fontWeight: '800' }}>Item</th>
                                  <th style={{ textAlign: 'center', padding: '4px 2px', fontWeight: '800' }}>Qty</th>
                                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '800' }}>Price</th>
                                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '800' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedVoid.extractedReceipt.items.map((item: any, i: number) => {
                                  const isReturned = selectedVoid.selectedReturnedItems?.some((s: any) => s.desc === item.description);
                                  return (
                                    <tr key={i} style={{ backgroundColor: isReturned ? '#fef2f2' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '4px 2px', fontWeight: isReturned ? '800' : '500', color: isReturned ? '#991b1b' : '#0f172a' }}>{item.description} {isReturned ? '(VOID)' : ''}</td>
                                      <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '600' }}>{item.quantity}</td>
                                      <td style={{ padding: '4px 2px', textAlign: 'right', color: '#475569' }}>{item.price}</td>
                                      <td style={{ padding: '4px 2px', textAlign: 'right', fontWeight: '800' }}>{item.total}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b', fontWeight: '700' }}>Net Amount:</span>
                                <span style={{ fontWeight: '800' }}>{selectedVoid.extractedReceipt.net_amount || '0'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px' }}>
                                <span style={{ color: '#64748b', fontWeight: '700' }}>Tax:</span>
                                <span style={{ fontWeight: '800' }}>{selectedVoid.extractedReceipt.tax_amount || '0'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontSize: '12px' }}>
                                <span style={{ color: '#0f172a', fontWeight: '900' }}>Total Receipt:</span>
                                <span style={{ fontWeight: '900', color: '#0f172a' }}>{selectedVoid.extractedReceipt.total_amount || '0'} EGP</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc', fontSize: '11px', color: '#64748b' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#0f172a' }}>Void Details</p>
                          <p style={{ margin: '4px 0 0' }}>Reason: {selectedVoid.reason || 'N/A'}</p>
                          <p style={{ margin: '2px 0 0' }}>Amount: EGP {Number(selectedVoid.amount || 0).toFixed(2)}</p>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Physical Receipt Evidence Photo */}
                    <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ border: '2px solid #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                        <div style={{ backgroundColor: '#e2e8f0', padding: '8px 12px', borderBottom: '2px solid #cbd5e1', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', color: '#1e293b', letterSpacing: '1px' }}>
                          Physical Receipt Evidence
                        </div>
                        <div style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {selectedVoid.attachedPhotos && selectedVoid.attachedPhotos.length > 0 ? (
                            <img src={selectedVoid.attachedPhotos[0]} style={{ width: '100%', height: '100%', maxHeight: '350px', objectFit: 'contain', border: '1px solid #e2e8f0', backgroundColor: 'white', padding: '4px' }} alt="Receipt Evidence" />
                          ) : (
                            <div style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '800' }}>No Photo Attached</div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Footer Signatures */}
                  <div style={{ borderTop: '2px solid #1e293b', paddingTop: '10px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '8px', position: 'relative', zIndex: 10 }}>
                    <div style={{ width: '25%' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cashier Signature</p>
                      {selectedVoid.cashierSignature ? (
                        <img src={selectedVoid.cashierSignature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '40px', objectFit: 'contain', marginBottom: '2px' }} />
                      ) : (
                        <div style={{ height: '40px', marginBottom: '2px' }}></div>
                      )}
                      <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '4px' }}></div>
                      <p style={{ fontSize: '11px', fontWeight: '900', margin: 0, textTransform: 'uppercase', color: '#0f172a' }}>{selectedVoid.cashierName || 'Cashier'}</p>
                    </div>

                    <div style={{ width: '22%', textAlign: 'center' }}>
                      <Barcode
                        value={selectedVoid.transactionNumber || '000000'}
                        width={1.2}
                        height={35}
                        fontSize={10}
                        font="monospace"
                        margin={0}
                        background="#ffffff"
                        displayValue={true}
                      />
                    </div>

                    <div style={{ width: '25%' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manager Authorization</p>
                      <div style={{ height: '40px', marginBottom: '2px' }}></div>
                      <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '4px' }}></div>
                      <p style={{ fontSize: '11px', fontWeight: '900', margin: 0, textTransform: 'uppercase', color: '#0f172a' }}>Signature / Stamp</p>
                    </div>

                    {/* Official Stamp Box */}
                    <div style={{ width: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: '55px', border: '2px dashed #94a3b8', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                        <span style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.5px' }}>Official Branch<br />Stamp / Seal</span>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Digital Forensics Footer */}
                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '4px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <p style={{ fontSize: '7px', color: '#475569', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                      DOCUMENT VOID-{(selectedVoid.id || '0000').substring(0, 10).toUpperCase()} | TXN: {selectedVoid.transactionNumber} | PRINTED: {new Date().toLocaleString('en-GB')} | SYSTEM: ANH PORTAL V2.0
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </DrawerProfile>
        )}

        {/* REJECTION REASON PROMPT MODAL */}
        {showRejectModal && selectedVoid && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-[#1E293B] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900 dark:text-white">
              
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> Reject Void Request
                </h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Provide a reason for rejecting void request <strong className="font-mono text-cyan-600 dark:text-cyan-400">#{selectedVoid.transactionNumber}</strong> (EGP {Number(selectedVoid.amount || 0).toFixed(2)}):
              </p>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Invalid Receipt",
                  "Duplicate Request",
                  "Customer Cancelled",
                  "Unverified Item Error",
                  "Policy Violation"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] hover:border-rose-500/40 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection explanation for cashier..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0F172A] border border-slate-300 dark:border-[#1E293B] text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-200 dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedVoid, "rejected", rejectReason || "Rejected by Manager")}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
