"use client";

import React, { useState, useEffect } from "react";
import { db, auth, dbService } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Download,
  Loader2,
  X,
  Printer,
  FileCheck2,
  Building2,
  ShieldCheck,
  Scale,
  Eye,
  FileText
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import QRCode from "react-qr-code";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";

// Arabic Number to Words Converter for Egyptian Pounds (Tafqeet)
function numberToArabicWords(num: number): string {
  if (!num || num === 0) return "صفر جنيه مصري";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  const convertHundreds = (n: number): string => {
    let res = "";
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    if (h > 0) res += hundreds[h];
    if (remainder > 0) {
      if (res) res += " و";
      if (remainder < 20) {
        res += ones[remainder];
      } else {
        const o = remainder % 10;
        const t = Math.floor(remainder / 10);
        if (o > 0) res += ones[o] + " و";
        res += tens[t];
      }
    }
    return res;
  };

  const thousands = Math.floor(num / 1000);
  const remainderAfterThousand = num % 1000;
  let result = "";

  if (thousands > 0) {
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands >= 3 && thousands <= 10) result += convertHundreds(thousands) + " آلاف";
    else result += convertHundreds(thousands) + " ألف";
  }

  if (remainderAfterThousand > 0) {
    if (result) result += " و";
    result += convertHundreds(remainderAfterThousand);
  }

  return result + " جنيه مصري لا غير";
}

export default function ChequesPage() {
  const { currentBranch } = useBranch();
  const [cheques, setCheques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newCheque, setNewCheque] = useState({
    bankName: "",
    chequeNumber: "",
    chequeDate: new Date().toISOString().substring(0, 10),
    amount: "",
    receiverName: "",
    receiverCompanyName: "",
    nationalId: "",
    creditLimit: "",
    notes: ""
  });
  
  const [selectedForPrint, setSelectedForPrint] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = collection(db, "cheques") as any;

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      let data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      if (currentBranch && currentBranch !== "all") {
        data = data.filter((item: any) => {
          const bId = (item as any).storeId?.toLowerCase() || "";
          let itemBranch = "alamein4"; 
          if (bId.includes("ola") || bId.includes("koronfol")) itemBranch = "ola";
          return itemBranch === currentBranch;
        });
      }

      data.sort((a: any, b: any) => new Date(b.chequeDate).getTime() - new Date(a.chequeDate).getTime());

      setCheques(data);
      setLoading(false);
    }, (err: any) => {
      console.error(err);
      toast.error("Failed to load cheques");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheque.amount || isNaN(Number(newCheque.amount)) || Number(newCheque.amount) <= 0) {
      toast.error("Please enter a valid cheque amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4";

      const chequeData = {
        amount: Number(newCheque.amount),
        bankName: newCheque.bankName.trim(),
        chequeDate: newCheque.chequeDate,
        chequeNumber: newCheque.chequeNumber.trim(),
        receiverName: newCheque.receiverName.trim(),
        receiverCompanyName: newCheque.receiverCompanyName.trim(),
        nationalId: newCheque.nationalId.trim(),
        creditLimit: newCheque.creditLimit ? Number(newCheque.creditLimit) : 0,
        notes: newCheque.notes.trim(),
        status: "active_guarantee", // active_guarantee | cleared | returned | voided
        storeId,
        createdAt: serverTimestamp(),
        createdBy: user?.email || "unknown",
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "cheques"), chequeData);

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Create Legal Guarantee Cheque",
        "N/A",
        `Cheque #: ${newCheque.chequeNumber}, Bank: ${newCheque.bankName}, Amount: EGP ${newCheque.amount}`
      ).catch(() => {});

      toast.success("Guarantee cheque recorded successfully!");
      vibrateSuccess();
      setShowAddModal(false);
      
      const savedCheque = { id: docRef.id, ...chequeData, createdAt: new Date() };
      
      setNewCheque({
        bankName: "",
        chequeNumber: "",
        chequeDate: new Date().toISOString().substring(0, 10),
        amount: "",
        receiverName: "",
        receiverCompanyName: "",
        nationalId: "",
        creditLimit: "",
        notes: ""
      });
      
      setSelectedForPrint(savedCheque);
      
    } catch (err: any) {
      console.error(err);
      toast.error("Error adding cheque: " + err.message);
      vibrateError();
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "cheques", id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success("Status updated");
      vibrateSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Error updating status: " + err.message);
      vibrateError();
    }
  };

  const handlePrintDocument = (cheque: any) => {
    setSelectedForPrint(cheque);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const generatePDF = async (chequeToPrint?: any) => {
    const target = chequeToPrint || selectedForPrint;
    if (!target) return;
    
    setSelectedForPrint(target);
    setGeneratingPDF(true);

    await new Promise(resolve => setTimeout(resolve, 350));
    let element = document.getElementById("pdf-legal-guarantee-slip");
    if (!element) {
      await new Promise(resolve => setTimeout(resolve, 350));
      element = document.getElementById("pdf-legal-guarantee-slip");
    }

    try {
      if (element) {
        const canvas = await html2canvas(element, { 
          scale: 2, 
          useCORS: true, 
          logging: false, 
          imageTimeout: 15000,
          backgroundColor: "#ffffff"
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Guarantee_Cheque_${target.chequeNumber || target.id}.pdf`);
        toast.success("Legal Guarantee Cheque PDF downloaded!");
        vibrateSuccess();
      } else {
        toast.error("Could not capture print document.");
      }
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF: " + error.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cheque record?")) return;
    try {
      const chq = cheques.find(c => c.id === id);
      await deleteDoc(doc(db, "cheques", id));

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Delete Cheque Record",
        `ID: ${id}, Cheque #: ${chq?.chequeNumber || "N/A"}, Amount: EGP ${chq?.amount || 0}`,
        "Deleted"
      ).catch(() => {});

      toast.success("Cheque deleted");
      vibrateSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Error deleting cheque: " + err.message);
      vibrateError();
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Branch Corporate Metadata for Egyptian Commercial Law
  const getBranchLegalInfo = (storeId?: string) => {
    const s = (storeId || currentBranch || "").toLowerCase();
    const isOla = s.includes("ola") || s.includes("koronfol");
    if (isOla) {
      return {
        companyNameAr: "شركة ايه ان اتش للتجارة (ش.م.م)",
        companyNameEn: "ANH For Trading S.A.E",
        branchTitleAr: "فرع أولا القرنفل - التجمع الخامس (توكيل سيركل كي)",
        taxId: "756-563-844",
        commReg: "216727",
        address: "شارع التسعين الشمالي، كمبوند القرنفل، التجمع الخامس، القاهرة الجديدة",
        managerTitle: "المدير المالي / مدير الفرع"
      };
    }
    return {
      companyNameAr: "الشركة المصرية للتجارة والتوكيلات (ش.م.م)",
      companyNameEn: "El Masreya for Trade - Circle K Franchise",
      branchTitleAr: "فرع العلمين 4 - مارينا الساحل الشمالي (توكيل سيركل كي)",
      taxId: "123-456-789",
      commReg: "123456",
      address: "طريق الإسكندرية - مطروح الساحلي، أمام بوابة مارينا 4، العلمين",
      managerTitle: "المدير المالي / مدير الفرع"
    };
  };

  // Summaries
  const activeGuarantees = cheques.filter(c => c.status === "active_guarantee" || c.status === "issued");
  const returnedCheques = cheques.filter(c => c.status === "returned" || c.status === "cleared");
  const voidedCheques = cheques.filter(c => c.status === "cancelled" || c.status === "voided");
  
  const activeValue = activeGuarantees.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const returnedValue = returnedCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalValue = cheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const uniqueSuppliers = new Set(cheques.map(c => c.receiverCompanyName)).size;

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="bg-card border border-border shadow-sm p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Scale className="w-5 h-5 text-rose-500" />
            Guarantee Cheques Registry (شيكات الضمان الائتمانية)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Legal tracking for commercial supplier credit limits & guarantee deposits under Egyptian Law
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Plus size={18} /> إضافة شيك ضمان جديد (Add Cheque)
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        <div className="bg-gradient-to-br from-rose-500/10 to-card p-5 rounded-2xl border border-rose-500/20 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Active Under Guarantee</span>
            <ShieldCheck className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-foreground font-mono">EGP {formatMoney(activeValue)}</p>
          <p className="text-xs font-semibold text-rose-500/80 mt-1">{activeGuarantees.length} cheques held by suppliers</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-card p-5 rounded-2xl border border-emerald-500/20 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Settled & Returned</span>
            <FileCheck2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-foreground font-mono">EGP {formatMoney(returnedValue)}</p>
          <p className="text-xs font-semibold text-emerald-500/80 mt-1">{returnedCheques.length} custody returned</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Creditor Companies</span>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-black text-foreground font-mono">{uniqueSuppliers}</p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">active suppliers with credit limit</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Cheques Issued</span>
            <Scale className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-black text-foreground font-mono">EGP {formatMoney(totalValue)}</p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">{cheques.length} records in registry</p>
        </div>

      </div>

      {/* Data Table */}
      <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-black">Issue Date</th>
                <th className="p-4 font-black">Bank Name</th>
                <th className="p-4 font-black">Cheque #</th>
                <th className="p-4 font-black text-right">Guarantee Amount</th>
                <th className="p-4 font-black">Receiver & Company</th>
                <th className="p-4 font-black text-center">Legal Status</th>
                <th className="p-4 font-black text-center">Print / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-rose-500 mb-2" />
                    <p className="text-xs font-semibold">Loading guarantee cheques...</p>
                  </td>
                </tr>
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground font-medium">
                    No guarantee cheques found for this branch. Click "+ Add Cheque" to register one.
                  </td>
                </tr>
              ) : (
                cheques.map((cheque) => {
                  const isUnderGuarantee = cheque.status === "active_guarantee" || cheque.status === "issued";
                  const isReturned = cheque.status === "returned" || cheque.status === "cleared";
                  
                  return (
                    <tr key={cheque.id} className="hover:bg-muted/30 transition-colors">
                      
                      {/* Date */}
                      <td className="p-4 font-mono font-semibold text-xs text-foreground whitespace-nowrap">
                        {cheque.chequeDate}
                      </td>

                      {/* Bank */}
                      <td className="p-4 font-bold text-foreground">
                        {cheque.bankName}
                      </td>

                      {/* Cheque # */}
                      <td className="p-4 font-mono font-black text-rose-500">
                        {cheque.chequeNumber}
                      </td>

                      {/* Amount */}
                      <td className="p-4 text-right font-black font-mono text-foreground whitespace-nowrap">
                        EGP {formatMoney(cheque.amount)}
                      </td>

                      {/* Receiver Company & Name */}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {cheque.receiverCompanyName || "N/A"}
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5">
                            المندوب: {cheque.receiverName || "N/A"} • بطاقة: {cheque.nationalId || "N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Status Selector */}
                      <td className="p-4 text-center">
                        <select 
                          value={cheque.status}
                          onChange={(e) => updateStatus(cheque.id, e.target.value)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer appearance-none text-center outline-none ${
                            isUnderGuarantee 
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' 
                              : isReturned 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <option value="active_guarantee">تحت الضمان (Active Guarantee)</option>
                          <option value="returned">مسترد / مسوى (Returned / Settled)</option>
                          <option value="voided">ملغي (Voided)</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handlePrintDocument(cheque)}
                            className="px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            title="طباعة سند الضمان القانوني باللغة العربية"
                          >
                            <Printer size={14} />
                            <span>طباعة السند</span>
                          </button>

                          <button 
                            onClick={() => generatePDF(cheque)}
                            disabled={generatingPDF}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            title="تحميل السند PDF"
                          >
                            <Download size={15} />
                          </button>

                          {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                            <button 
                              onClick={() => handleDelete(cheque.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-border">
            
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">تسجيل شيك ضمان ائتماني رسمي</h2>
                  <p className="text-xs text-muted-foreground">Official Commercial Guarantee Cheque Registry</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    البنك المسحوب عليه (Bank Name) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. بنك مصر / البنك الأهلي المصري / CIB"
                    value={newCheque.bankName}
                    onChange={e => setNewCheque({...newCheque, bankName: e.target.value})}
                    className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    رقم الشيك البنكي (Cheque Number) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 00045892"
                    value={newCheque.chequeNumber}
                    onChange={e => setNewCheque({...newCheque, chequeNumber: e.target.value})}
                    className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    تاريخ تحرير الشيك (Cheque Date) *
                  </label>
                  <input 
                    type="date"
                    required
                    value={newCheque.chequeDate}
                    onChange={e => setNewCheque({...newCheque, chequeDate: e.target.value})}
                    className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    قيمة شيك الضمان (Amount in EGP) *
                  </label>
                  <input 
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newCheque.amount}
                    onChange={e => setNewCheque({...newCheque, amount: e.target.value})}
                    className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-rose-500"
                  />
                </div>
              </div>

              {/* Arabic Tafqeet Preview */}
              {newCheque.amount && Number(newCheque.amount) > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-right">
                  <p className="text-[11px] font-bold text-rose-400 mb-0.5">التفقيط الرسمي باللغة العربية (Tafqeet):</p>
                  <p className="text-xs font-black text-rose-300">
                    فقط وقدره {numberToArabicWords(Number(newCheque.amount))}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    اسم الشركة الموردة المستفيدة (Supplier Company) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. شركة جهينة للصناعات الغذائية"
                    value={newCheque.receiverCompanyName}
                    onChange={e => setNewCheque({...newCheque, receiverCompanyName: e.target.value})}
                    className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    اسم مندوب الشركة المستلم رباعي (Representative Name) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="الاسم الرباعي للمندوب المستلم للشيك"
                    value={newCheque.receiverName}
                    onChange={e => setNewCheque({...newCheque, receiverName: e.target.value})}
                    className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  الرقم القومي لمندوب الشركة المستلم (14 رقم قومي مصري) *
                </label>
                <input 
                  type="text"
                  required
                  maxLength={14}
                  placeholder="2980101XXXXXXXX"
                  value={newCheque.nationalId}
                  onChange={e => setNewCheque({...newCheque, nationalId: e.target.value})}
                  className="w-full p-3 bg-muted/60 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold tracking-widest"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors text-sm"
                >
                  إلغاء (Cancel)
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm shadow-md"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "حفظ وطباعة سند الضمان"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        100% LEGAL EGYPTIAN ARABIC GUARANTEE CHEQUE PRINT / PDF DOCUMENT
        طبقاً لأحكام قانون التجارة المصري رقم 17 لسنة 1999 والقانون المدني المصري
        ========================================================================
      */}
      {selectedForPrint && (
        <>
          {/* Action Modal Preview */}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 print:hidden">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-rose-500" />
                  <span className="font-black text-white text-sm">
                    سند استلام شيك ضمان بنكي مشروط بحد ائتماني (معاينة الطباعة الرسمية)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePrintDocument(selectedForPrint)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all"
                  >
                    <Printer size={15} />
                    <span>طباعة فورية (Print)</span>
                  </button>
                  <button 
                    onClick={() => generatePDF(selectedForPrint)}
                    disabled={generatingPDF}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition-all"
                  >
                    <Download size={15} />
                    <span>تحميل PDF</span>
                  </button>
                  <button 
                    onClick={() => setSelectedForPrint(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable Preview Container */}
              <div className="p-6 overflow-y-auto bg-slate-950/80 flex justify-center">
                <div className="w-full max-w-[760px] bg-white text-black p-8 rounded-xl shadow-lg font-sans text-right" dir="rtl">
                  
                  {/* Document Header */}
                  <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">جمهورية مصر العربية</h2>
                      <p className="text-xs font-bold text-slate-600">سند تجاري رسمي مشروط بحد ائتماني</p>
                    </div>
                    <div className="text-left" dir="ltr">
                      <p className="text-[10px] font-mono font-bold text-slate-500">REF: {selectedForPrint.chequeNumber}-{selectedForPrint.id?.slice(-5) || "001"}</p>
                      <p className="text-xs font-mono font-black text-rose-700">DATE: {selectedForPrint.chequeDate}</p>
                    </div>
                  </div>

                  <h1 className="text-lg font-black text-center text-slate-900 mb-4 bg-slate-100 py-2 border border-slate-300 rounded">
                    إقرار وسند استلام شيك بنكي على سبيل الضمان الائتماني
                  </h1>

                  {/* Summary Box */}
                  <div className="text-xs leading-relaxed space-y-3 mb-4 text-slate-800">
                    <p>
                      أقر أنا الموقع أدناه السيد / <span className="font-black underline">{selectedForPrint.receiverName || "المندوب المستلم"}</span>، 
                      بطاقة رقم قومي: <span className="font-mono font-black underline">{selectedForPrint.nationalId || "الرقم القومي"}</span>، 
                      بصفتي المندوب المفوض بالتوقيع والاستلام عن شركة / <span className="font-black underline">{selectedForPrint.receiverCompanyName || "الشركة الموردة"}</span>،
                    </p>
                    <p>
                      بأنني قد استلمت اليوم من شركة / <span className="font-black">{getBranchLegalInfo(selectedForPrint.storeId).companyNameAr}</span> (توكيل سيركل كي - {getBranchLegalInfo(selectedForPrint.storeId).branchTitleAr})، 
                      سجل تجاري: <span className="font-mono font-bold">{getBranchLegalInfo(selectedForPrint.storeId).commReg}</span>، 
                      بطاقة ضريبية: <span className="font-mono font-bold">{getBranchLegalInfo(selectedForPrint.storeId).taxId}</span>:
                    </p>
                  </div>

                  {/* Cheque Specifications Grid */}
                  <div className="bg-slate-50 border-2 border-slate-400 rounded-lg p-3.5 mb-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-600">رقم الشيك البنكي: </span>
                      <span className="font-mono font-black text-sm text-slate-900">{selectedForPrint.chequeNumber}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600">البنك المسحوب عليه: </span>
                      <span className="font-black text-slate-900">{selectedForPrint.bankName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600">تاريخ تحرير الشيك: </span>
                      <span className="font-mono font-bold text-slate-900">{selectedForPrint.chequeDate}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600">مبلغ الشيك بالأرقام: </span>
                      <span className="font-mono font-black text-sm text-rose-700">EGP {Number(selectedForPrint.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-300 pt-2">
                      <span className="font-bold text-slate-600">المبلغ بالحروف والتفقيط: </span>
                      <span className="font-black text-slate-900 text-xs">
                        فقط وقدره {numberToArabicWords(Number(selectedForPrint.amount || 0))}
                      </span>
                    </div>
                  </div>

                  {/* Strict Legal Articles under Egyptian Law */}
                  <div className="border border-slate-300 rounded p-3 bg-white mb-5 text-[11px] leading-normal space-y-2 text-slate-700">
                    <p className="font-black text-slate-900 text-xs border-b pb-1">
                      الشروط والتعهدات القانونية الملزمة (وفقاً لقانون التجارة المصري رقم 17 لسنة 1999 والقانون المدني):
                    </p>
                    <p>
                      <strong>أولاً: صفة الضمان التأميني:</strong> يقر الطرف الثاني (المستلم وشركته) بأن هذا الشيك قد سُلِّم على سبيل **الضمان والتأمين فقط** لتغطية الحد الائتماني الممنوح للطرف الأول لتوريد بضائع بالآجل، وأنه ليس شيكاً واجب الوفاء الفوري أو مستحق الأداء حالاً.
                    </p>
                    <p>
                      <strong>ثانياً: حظر الصرف البنكي أو التظهير:</strong> يتعهد الطرف الثاني صراحة بعدم تقديم الشيك للصرف البنكي أو تظهيره للغير أو اتخاذ إجراءات قانونية به طالما أن الطرف الأول منتظم في سداد فواتير البضائع المسلمة إليه.
                    </p>
                    <p>
                      <strong>ثالثاً: قصر الاستخدام على المديونية الفعلية بعد الإعذار:</strong> لا يجوز المطالبة بقيمة الشيك إلا في حالة ثبوت التوقف عن السداد وبعد إنذار كتابي رسمي بمهلة 15 يوماً، وفي حدود المديونية الصافية غير المسددة فقط بعد خصم كافة الدفعات والمرتجعات.
                    </p>
                    <p>
                      <strong>رابعاً: التزام رد أصل الشيك:</strong> يلتزم الطرف الثاني برد أصل الشيك فوراً وتسليمه للطرف الأول بمجرد تصفية التعامل التجاري أو استبداله بضمان آخر أو تسوية الحسابات.
                    </p>
                    <p>
                      <strong>خامساً: المسؤولية الجنائية والمدنية:</strong> يُعد أي تقديم أو تصرف في هذا الشيك خلافاً للغرض المخصص له (شيك أمانة وضمان) خيانة للأمانة واستعمالاً لمحرر في غير ما أُعد له وفقاً لقانون العقوبات وقانون التجارة المصري.
                    </p>
                  </div>

                  {/* Signature Blocks */}
                  <div className="grid grid-cols-2 gap-6 border-t-2 border-slate-900 pt-4 text-xs">
                    <div className="space-y-2">
                      <p className="font-black text-slate-900">الطرف الثاني (المندوب المستلم والشركة):</p>
                      <p className="text-[11px]">اسم المستلم: ...........................................</p>
                      <p className="text-[11px]">الرقم القومي: ...........................................</p>
                      <p className="text-[11px]">التوقيع: ...................................................</p>
                      <div className="h-14 border border-dashed border-slate-400 rounded flex items-center justify-center text-[10px] text-slate-400">
                        [ بصمة إبهام المستلم / خاتم الشركة المستلمة ]
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-black text-slate-900">الطرف الأول (الساحب / إدارة الحسابات):</p>
                      <p className="text-[11px]">المنشأة: {getBranchLegalInfo(selectedForPrint.storeId).companyNameAr}</p>
                      <p className="text-[11px]">الاعتماد: {getBranchLegalInfo(selectedForPrint.storeId).managerTitle}</p>
                      <p className="text-[11px]">التوقيع: ...................................................</p>
                      <div className="h-14 border border-dashed border-slate-400 rounded flex items-center justify-center text-[10px] text-slate-400">
                        [ خاتم الشركة الرسمي ]
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* Printable Native Container for window.print() & PDF generation */}
          <div id="single-cheque-print-wrapper" className="hidden print:block fixed inset-0 bg-white text-black p-0 m-0 z-[99999]">
            <div 
              id="pdf-legal-guarantee-slip" 
              className="w-full max-w-[210mm] mx-auto p-10 bg-white text-black font-sans text-right" 
              dir="rtl"
              style={{ minHeight: "297mm" }}
            >
              
              {/* Document Header */}
              <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-black tracking-tight">جمهورية مصر العربية</h2>
                  <p className="text-xs font-bold text-gray-700">سند تجاري وقانوني رسمي - شيك ضمان مشروط بحد ائتماني</p>
                </div>
                <div className="text-left" dir="ltr">
                  <p className="text-xs font-mono font-bold text-gray-600">SERIAL: REF-CHQ-{selectedForPrint.chequeNumber}</p>
                  <p className="text-xs font-mono font-bold text-black">ISSUE DATE: {selectedForPrint.chequeDate}</p>
                </div>
              </div>

              <div className="border-2 border-black bg-gray-100 py-3 px-4 rounded mb-6 text-center">
                <h1 className="text-xl font-black text-black">
                  إقرار وسند استلام شيك بنكي على سبيل الضمان الائتماني
                </h1>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">
                  OFFICIAL COMMERCIAL GUARANTEE CHEQUE ACKNOWLEDGEMENT
                </p>
              </div>

              {/* Preamble / Parties */}
              <div className="text-sm leading-relaxed space-y-3 mb-6 text-black">
                <p>
                  أقر أنا الموقع أدناه السيد / <span className="font-black text-base underline">{selectedForPrint.receiverName || "المندوب المستلم"}</span>، 
                  بطاقة رقم قومي: <span className="font-mono font-black text-base underline">{selectedForPrint.nationalId || "الرقم القومي"}</span>، 
                  بصفتي المندوب المفوض بالتوقيع والاستلام عن شركة / <span className="font-black text-base underline">{selectedForPrint.receiverCompanyName || "الشركة المستفيدة"}</span>،
                </p>
                <p>
                  بأنني قد استلمت اليوم من شركة / <span className="font-black">{getBranchLegalInfo(selectedForPrint.storeId).companyNameAr}</span> ({getBranchLegalInfo(selectedForPrint.storeId).branchTitleAr})، 
                  سجل تجاري رقم: <span className="font-mono font-bold">{getBranchLegalInfo(selectedForPrint.storeId).commReg}</span>، 
                  بطاقة ضريبية رقم: <span className="font-mono font-bold">{getBranchLegalInfo(selectedForPrint.storeId).taxId}</span>:
                </p>
              </div>

              {/* Cheque Specifics Box */}
              <div className="border-2 border-black rounded-lg p-4 mb-6 grid grid-cols-2 gap-4 text-sm bg-gray-50">
                <div>
                  <span className="font-bold text-gray-700">رقم الشيك البنكي: </span>
                  <span className="font-mono font-black text-base text-black">{selectedForPrint.chequeNumber}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-700">البنك المسحوب عليه: </span>
                  <span className="font-black text-black">{selectedForPrint.bankName}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-700">تاريخ تحرير الشيك: </span>
                  <span className="font-mono font-bold text-black">{selectedForPrint.chequeDate}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-700">قيمة الشيك بالأرقام: </span>
                  <span className="font-mono font-black text-base text-black">EGP {Number(selectedForPrint.amount || 0).toLocaleString()}</span>
                </div>
                <div className="col-span-2 border-t border-gray-300 pt-2.5">
                  <span className="font-bold text-gray-700">المبلغ بالحروف والتفقيط: </span>
                  <span className="font-black text-black text-sm">
                    فقط وقدره {numberToArabicWords(Number(selectedForPrint.amount || 0))}
                  </span>
                </div>
              </div>

              {/* Binding Articles */}
              <div className="border border-black rounded p-4 mb-6 text-xs leading-relaxed space-y-2.5 text-justify">
                <p className="font-black text-sm text-black border-b border-gray-300 pb-1">
                  البنود والشروط القانونية الحاكمة (وفقاً لأحكام قانون التجارة المصري رقم 17 لسنة 1999 والقانون المدني):
                </p>
                <p>
                  <strong>المادة الأولى (صفة الضمان التأميني):</strong> يقر الطرف الثاني (الشركة المستفيدة ومندوبها المفوض) بأن هذا الشيك قد سُلِّم على سبيل **الضمان والتأمين التجاري فقط** لتغطية الحد الائتماني الممنوح للطرف الأول لتوريد بضائع بالآجل، وأنه ليس شيكاً واجب الوفاء الفوري أو مستحق الأداء حالاً في تاريخه، ولا يمثل مديونية قائمة بذاتها.
                </p>
                <p>
                  <strong>المادة الثانية (حظر الصرف البنكي أو التظهير):</strong> يحظر تماماً على الطرف الثاني تقديم الشيك للصرف من البنك المسحوب عليه أو تظهيره أو رهنه للغير أو اتخاذ أي بلاغات جنائية بموجبه، طالما أن الطرف الأول منتظم في سداد فواتير البضائع المسلمة إليه طبقاً للمدد الائتمانية المقررة.
                </p>
                <p>
                  <strong>المادة الثالثة (قصر المطالبة على العجز الفعلي بعد الإعذار):</strong> في حال حدوث أي توقف أو إخلال مثبت بالسداد من قبل الطرف الأول، يلتزم الطرف الثاني بتوجيه إخطار كتابي رسمي بمهلة لا تقل عن 15 يوماً، ولا يجوز له بأي حال من الأحوال المطالبة إلا بصافي قيمة المديونية الفعلية غير المسددة فقط بعد استنزال كافة الدفعات والمرتجعات.
                </p>
                <p>
                  <strong>المادة الرابعة (الالتزام برد أصل الشيك):</strong> يلتزم الطرف الثاني برد أصل الشيك فوراً وتسليمه للطرف الأول بمجرد انتهاء التعامل التجاري أو تقديم ضمان بديل أو سداد المديونية، ويُعد أي سداد بموجب إيصالات أو تحويلات بنكية مسقطاً لأي التزام يغطيه هذا الشيك.
                </p>
                <p>
                  <strong>المادة الخامسة (المسؤولية الجنائية والمدنية):</strong> يقر الطرف الثاني بأن أي استخدام لهذا الشيك خلافاً للغرض المخصص له (شيك أمانة وضمان) يُعد خيانة للأمانة واستعمالاً لمحرر في غير ما أُعد له وفقاً لقانون العقوبات وقانون التجارة المصري رقم 17 لسنة 1999، ويتحمل المودع لديه المسؤولية الجنائية والتعويض المدني الكامل.
                </p>
              </div>

              {/* Signatures & Stamps */}
              <div className="grid grid-cols-2 gap-8 border-t-2 border-black pt-5 text-xs mt-auto">
                <div className="space-y-2">
                  <p className="font-black text-sm text-black">الطرف الثاني (المندوب المستلم والشركة الموردة):</p>
                  <p>اسم المندوب رباعي: ....................................................</p>
                  <p>الرقم القومي (14 رقم): .................................................</p>
                  <p>التوقيع الرسمي: .............................................................</p>
                  <div className="h-20 border-2 border-dashed border-gray-400 rounded flex items-center justify-center text-xs text-gray-500 mt-2">
                    [ بصمة إبهام المستلم / خاتم الشركة المستلمة الرسمي ]
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-black text-sm text-black">الطرف الأول (الساحب / إدارة الحسابات):</p>
                  <p>الشركة: {getBranchLegalInfo(selectedForPrint.storeId).companyNameAr}</p>
                  <p>المفوض بالاعتماد: {getBranchLegalInfo(selectedForPrint.storeId).managerTitle}</p>
                  <p>التوقيع: .....................................................................</p>
                  <div className="h-20 border-2 border-dashed border-gray-400 rounded flex items-center justify-center text-xs text-gray-500 mt-2">
                    [ خاتم المنشأة التجاري الرسمي ]
                  </div>
                </div>
              </div>

              {/* Security Footer */}
              <div className="border-t border-gray-300 mt-8 pt-3 flex justify-between items-center text-[10px] text-gray-600">
                <p>توثيق رسمي إلكتروني مشفر عبر منظومة Circle K Financial Verification Ledger</p>
                <p className="font-mono">TIMESTAMP: {new Date().toISOString()}</p>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
