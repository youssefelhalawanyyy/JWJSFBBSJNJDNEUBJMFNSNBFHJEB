"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth, storage, dbService } from "@/lib/firebase";
import { safeSetLocalStorage, sanitizeCreditForCache } from "@/lib/storageUtils";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { syncProductsToMaster } from "@/lib/products-sync";
import { dispatchNotificationSystem } from "@/lib/notifications";

function safeToIsoDate(val: any, fallback?: Date): string {
  try {
    if (!val) {
      return (fallback || new Date()).toISOString().split("T")[0];
    }
    if (val?.toDate && typeof val.toDate === "function") {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
    return (fallback || new Date()).toISOString().split("T")[0];
  } catch (_e) {
    return new Date().toISOString().split("T")[0];
  }
}
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  Timestamp,
  where,
  limit
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  FileDown,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Clock,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  PieChart,
  AlertCircle,
  FileText,
  Banknote,
  Calendar,
  MoreHorizontal,
  CreditCard,
  Building,
  Building2,
  Image as ImageIcon,
  ClipboardPaste,
  Eye,
  EyeOff,
  Calculator,
  Pencil,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Check,
  Layers,
  PackageOpen,
  Upload
} from "lucide-react";
import { notifyFinancialsUpdated } from "@/lib/financial-sync";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { TiltCard } from "@/components/MobileUX/TiltCard";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { onAuthStateChanged } from "firebase/auth";
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QRCode from "react-qr-code";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, AreaChart, Area, ComposedChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell } from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import dynamic from "next/dynamic";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { AnalogOdometer } from "@/components/SkeuomorphicUX/AnalogOdometer";
import { CoinDropWallet } from "@/components/SkeuomorphicUX/CoinDropWallet";
import { PosReceiptPrinter } from "@/components/SkeuomorphicUX/PosReceiptPrinter";
import { RubberStamp } from "@/components/SkeuomorphicUX/RubberStamp";
import { ReturnReceiptContent, numberToArabicWords, PendingReturnTicket, groupPendingReturns } from "@/components/ReturnReceiptContent";

function cleanPayload<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return null as any;
  if (typeof obj !== "object") {
    if (typeof obj === "number" && isNaN(obj)) return 0 as any;
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanPayload(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanPayload(value);
    }
  }
  return cleaned as any;
}

const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.65): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const SignaturePad = dynamic(() => import("react-signature-canvas"), { ssr: false });

interface Credit {
  id: string;
  amountDue: number;
  collectionDate: string;
  companyName: string;
  createdAt: any;
  createdBy: string;
  invoiceNumber: string;
  isTaxable: boolean;
  onSalesOnly: boolean;
  poNumber: string;
  status: "open" | "pending" | "paid" | "partial" | "overdue";
  storeId: string;
  tax: number;
  paidAmount: number;
  priceAdjustment: number;
  payments: any[];
  managerSignature?: string;
  items?: any[];
  poImageUrl?: string;
  supplierRepName?: string;
  supplierNationalId?: string;
  invoiceUrl?: string;
  invoiceUrls?: string[];
  poUrl?: string;
  poUrls?: string[];
  date?: string;
  isEdited?: boolean;
  lastEditedAt?: string;
  lastEditedBy?: string;
  editHistory?: {
    editedAt: string;
    editedBy: string;
    role?: string;
    changes: string[];
    summary: string;
  }[];
}

// --- Sortable Item for Kanban Board ---
function SortableInvoiceCard({ credit, onSelect, onStatusChange }: { credit: Credit; onSelect: (c: Credit) => void; onStatusChange: (c: Credit, status: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: credit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-3 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-600 transition-colors relative"
      {...attributes}
      {...listeners}
      onClick={() => onSelect(credit)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-white capitalize text-sm truncate">{credit.companyName}</h4>
          {credit.isEdited && (
            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded font-bold shrink-0 flex items-center gap-0.5" title="Edited">
              <Pencil size={9} />
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-500 shrink-0">{credit.invoiceNumber || 'No Inv'}</span>
      </div>
      <p className="text-lg font-black text-slate-900 dark:text-white mb-2">EGP {Number(credit.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="flex items-center gap-1"><Clock size={12} /> {credit.collectionDate || 'No Date'}</span>
        {credit.paidAmount > 0 && <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Partial</span>}
      </div>
    </div>
  );
}

// --- Droppable Column for Kanban Board ---
function DroppableColumn({ id, title, credits, onSelect }: { id: string, title: string, credits: Credit[], onSelect: (c: Credit) => void }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="flex-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl p-4 flex flex-col border border-slate-200/60 dark:border-slate-800">
      <h3 className="font-black text-slate-800 dark:text-slate-200 mb-4 capitalize flex items-center gap-2">
        {id === 'open' && <AlertCircle size={18} className="text-slate-500" />}
        {id === 'pending' && <Clock size={18} className="text-blue-500" />}
        {id === 'paid' && <CheckCircle size={18} className="text-emerald-500" />}
        {title}
        <span className="ml-auto bg-white dark:bg-slate-800 text-xs px-2 py-1 rounded-lg text-slate-500">
          {credits.length}
        </span>
      </h3>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto pr-2 min-h-[200px]">
        <SortableContext id={id} items={credits.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
          {credits.map((credit: any) => (
            <SortableInvoiceCard 
              key={credit.id} 
              credit={credit} 
              onSelect={onSelect} 
              onStatusChange={() => {}}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const branchIds = useMemo(() => {
    const b = currentBranch as string;
    if (b === "all") {
      return [];
    } else if (b === "alamein4" || b === "el-alamein-4") {
      return ["eL-alamein-4", "alamein4", "el-alamein-4", "alamein", "alamein-4"];
    } else if (b === "ola" || b === "ola-el-koronfol") {
      return ["ola-el-koronfol", "ola", "ola_el_koronfol", "el-koronfol"];
    } else {
      return [b];
    }
  }, [currentBranch]);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [credits, setCredits] = useState<Credit[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem('cached_detailed_credits');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem('cached_detailed_credits');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board" | "companies">("list");
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const [companySortBy, setCompanySortBy] = useState<"owed" | "overdue" | "name" | "invoices">("owed");
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Dashboard & Profile State
  const [simulatorCash, setSimulatorCash] = useState<string>("");
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<string | null>(null);

  // Bulk Print State
  const [selectedBulkItems, setSelectedBulkItems] = useState<Set<string>>(new Set());
  const [isGeneratingBulkPDF, setIsGeneratingBulkPDF] = useState(false);
  const [bulkCreditsForPrint, setBulkCreditsForPrint] = useState<any[]>([]);

  const handleSelectBulkItem = (id: string) => {
    const newSet = new Set(selectedBulkItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedBulkItems(newSet);
  };

  const handleSelectAllBulkItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBulkItems(new Set(filteredCredits.map((c) => c.id)));
    } else {
      setSelectedBulkItems(new Set());
    }
  };

  // Credit Form
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Credit Form
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [tax, setTax] = useState("0");
  const [collectionDate, setCollectionDate] = useState("");
  const [onSalesOnly, setOnSalesOnly] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [poImageUrl, setPoImageUrl] = useState("");
  const [isProcessingPo, setIsProcessingPo] = useState(false);
  const [uploadingPoToOldCredit, setUploadingPoToOldCredit] = useState(false);
  const [selectedCreditForPoUpload, setSelectedCreditForPoUpload] = useState<Credit | null>(null);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  // Edit Credit State (Admin Only)
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [showEditCreditModal, setShowEditCreditModal] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editAmountDue, setEditAmountDue] = useState("");
  const [editTax, setEditTax] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editPoNumber, setEditPoNumber] = useState("");
  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editOnSalesOnly, setEditOnSalesOnly] = useState(false);
  const [editIsTaxable, setEditIsTaxable] = useState(false);

  const sigPadRef = React.useRef<any>(null);
  const [managerSignature, setManagerSignature] = useState("");
  const [hasSigned, setHasSigned] = useState(false);

  // Payment Form
  const [selectedCreditForPayment, setSelectedCreditForPayment] = useState<Credit | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankTransferFile, setBankTransferFile] = useState<File | null>(null);
  const [paymentPoNumber, setPaymentPoNumber] = useState("");
  const [paymentPoImageUrl, setPaymentPoImageUrl] = useState("");
  const [paymentPoItems, setPaymentPoItems] = useState<any[]>([]);
  const [isProcessingPaymentPo, setIsProcessingPaymentPo] = useState(false);
  const [showPaymentItemsDrawer, setShowPaymentItemsDrawer] = useState(false);

  // Goods Return / RTV Deduction Form State
  const [hasReturn, setHasReturn] = useState(false);
  const [returnSource, setReturnSource] = useState<"pending" | "new">("pending");
  const [availablePendingReturns, setAvailablePendingReturns] = useState<PendingReturnTicket[]>([]);
  const [loadingPendingReturns, setLoadingPendingReturns] = useState(false);
  const [selectedPendingReturn, setSelectedPendingReturn] = useState<PendingReturnTicket | null>(null);
  const [pendingReturnSearchQuery, setPendingReturnSearchQuery] = useState("");
  const [showAllSuppliersPending, setShowAllSuppliersPending] = useState(false);
  const [returnAmount, setReturnAmount] = useState("");
  const [returnTransferOutNumber, setReturnTransferOutNumber] = useState("");
  const [returnAgentName, setReturnAgentName] = useState("");
  const [returnAgentNationalId, setReturnAgentNationalId] = useState("");
  const [returnAgentMobile, setReturnAgentMobile] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnItems, setReturnItems] = useState<{ barcode: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number }[]>([]);

  const fetchPendingReturnsList = async () => {
    setLoadingPendingReturns(true);
    try {
      const q = query(
        collection(db, "supplier_returns"),
        orderBy("createdAt", "desc"),
        limit(150)
      );
      const snap = await getDocs(q);
      const grouped = groupPendingReturns(snap.docs);
      setAvailablePendingReturns(grouped);
    } catch (err) {
      console.error("Error loading pending returns:", err);
    } finally {
      setLoadingPendingReturns(false);
    }
  };

  useEffect(() => {
    if (hasReturn) {
      fetchPendingReturnsList();
    }
  }, [hasReturn]);

  const matchingPendingReturns = useMemo(() => {
    if (!availablePendingReturns || availablePendingReturns.length === 0) return [];
    const queryStr = (pendingReturnSearchQuery || "").toLowerCase().trim();
    const targetComp = (selectedCreditForPayment?.companyName || "").toLowerCase().replace(/[\s\-_]/g, '').trim();

    return availablePendingReturns.filter((ticket) => {
      const supp = (ticket.supplier || "").toLowerCase().trim();
      const suppClean = supp.replace(/[\s\-_]/g, '');
      const retNum = (ticket.returnNumber || "").toLowerCase();
      const trNum = (ticket.transferOutNumber || "").toLowerCase();
      const reason = (ticket.reason || "").toLowerCase();

      if (queryStr) {
        return (
          supp.includes(queryStr) ||
          retNum.includes(queryStr) ||
          trNum.includes(queryStr) ||
          reason.includes(queryStr)
        );
      }

      if (showAllSuppliersPending) return true;

      if (!targetComp) return true;
      return suppClean.includes(targetComp) || targetComp.includes(suppClean);
    });
  }, [availablePendingReturns, selectedCreditForPayment, pendingReturnSearchQuery, showAllSuppliersPending]);

  const handleSelectPendingReturn = (ticket: PendingReturnTicket) => {
    if (selectedPendingReturn?.id === ticket.id) {
      setSelectedPendingReturn(null);
      setReturnAmount("");
      setReturnTransferOutNumber("");
      setReturnReason("");
      setReturnItems([]);
      return;
    }

    setSelectedPendingReturn(ticket);
    const amountVal = ticket.totalPrice > 0 ? ticket.totalPrice.toString() : "";
    setReturnAmount(amountVal);
    setReturnTransferOutNumber(ticket.transferOutNumber || ticket.returnNumber || "");
    setReturnReason(ticket.reason || `مرتجع بضاعة معلق (${ticket.returnNumber})`);
    if (ticket.agentName) setReturnAgentName(ticket.agentName);
    if (ticket.agentNationalId) setReturnAgentNationalId(ticket.agentNationalId);
    if (ticket.agentMobile) setReturnAgentMobile(ticket.agentMobile);
    if (ticket.items && ticket.items.length > 0) {
      setReturnItems(ticket.items);
    } else {
      setReturnItems([{
        barcode: "N/A",
        itemName: ticket.reason || "مرتجع بضاعة",
        quantity: 1,
        unitPrice: ticket.totalPrice || 0,
        totalPrice: ticket.totalPrice || 0
      }]);
    }
  };

  const handleReturnItemChange = (index: number, field: string, value: any) => {
    const newItems = [...returnItems];
    const currentItem = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? parseFloat(value) || 0 : currentItem.quantity;
      const prc = field === 'unitPrice' ? parseFloat(value) || 0 : currentItem.unitPrice;
      currentItem.totalPrice = qty * prc;
    }
    newItems[index] = currentItem;
    setReturnItems(newItems);
    if (field === 'quantity' || field === 'unitPrice' || field === 'totalPrice') {
      const sum = newItems.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
      setReturnAmount(sum.toString());
    }
  };

  const handleAddReturnItem = () => {
    setReturnItems([...returnItems, { barcode: "", itemName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleRemoveReturnItem = (index: number) => {
    const newItems = returnItems.filter((_, idx) => idx !== index);
    setReturnItems(newItems);
    if (newItems.length > 0) {
      const sum = newItems.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
      setReturnAmount(sum.toString());
    }
  };

  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [creditPOItems, setCreditPOItems] = useState<Record<string, any[]>>({});
  const [loadingHistories, setLoadingHistories] = useState<Record<string, boolean>>({});
  const [selectedCreditForPrint, setSelectedCreditForPrint] = useState<Credit | null>(null);
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<{ credit: Credit; payment: any } | null>(null);
  const [isPrintingPayment, setIsPrintingPayment] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCreditForView, setSelectedCreditForView] = useState<Credit | null>(null);
  const [savedCreditForQR, setSavedCreditForQR] = useState<Credit | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const qrFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!savedCreditForQR) return;
    const unsub = onSnapshot(doc(db, "credits", savedCreditForQR.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.invoiceUrl || data.poUrl || (data.invoiceUrls && data.invoiceUrls.length > 0) || (data.poUrls && data.poUrls.length > 0)) {
          toast.success(isAr ? "تم رفع صورة الفاتورة بنجاح!" : "Invoice successfully uploaded!");
          setSavedCreditForQR(null);
          fetchCredits();
        }
      }
    });
    return () => unsub();
  }, [savedCreditForQR]);

  const uploadInvoiceDataUrl = async (activeId: string, dataUrl: string) => {
    setIsPasting(true);
    setSavedCreditForQR(null);
    toast.loading(isAr ? "جاري رفع صورة الفاتورة..." : "Uploading invoice image...", { id: "credit-invoice-upload-toast" });

    try {
      let finalDataUrl = dataUrl;
      if (dataUrl.length > 350000) {
        const img = new window.Image();
        img.src = dataUrl;
        await new Promise((res) => { img.onload = res; img.onerror = res; });
        if (img.width > 0) {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;
          const maxW = 1200;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            finalDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          }
        }
      }

      const updatePayload = {
        invoiceUrls: [finalDataUrl],
        invoiceUrl: finalDataUrl,
        poUrls: [finalDataUrl],
        poUrl: finalDataUrl,
        updatedAt: new Date().toISOString()
      };

      try {
        await updateDoc(doc(db, "credits", activeId), updatePayload);
        setCredits(prev => prev.map(c => c.id === activeId ? { ...c, ...updatePayload } : c));
        if (selectedCreditForView?.id === activeId) {
          setSelectedCreditForView((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
        }
        toast.success(isAr ? "تم رفع وإرفاق الفاتورة بنجاح! 📄✨" : "Invoice uploaded & attached successfully! 📄✨", { id: "credit-invoice-upload-toast" });
        fetchCredits();
        return;
      } catch (clientErr) {
        console.warn("Direct updateDoc failed for credit, attempting /api/upload-invoice fallback:", clientErr);
      }

      const res = await fetch("/api/upload-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: activeId,
          invoiceDataUrls: [finalDataUrl],
          type: "credit",
        }),
      });

      if (res.ok) {
        setCredits(prev => prev.map(c => c.id === activeId ? { ...c, ...updatePayload } : c));
        toast.success(isAr ? "تم رفع وإرفاق الفاتورة بنجاح! 📄✨" : "Invoice uploaded & attached successfully! 📄✨", { id: "credit-invoice-upload-toast" });
        fetchCredits();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to upload invoice", { id: "credit-invoice-upload-toast" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error uploading invoice", { id: "credit-invoice-upload-toast" });
    } finally {
      setIsPasting(false);
    }
  };

  const handlePasteFromClipboardButton = async () => {
    const activeId = savedCreditForQR?.id || (selectedCreditForView && (!selectedCreditForView.invoiceUrl && !((selectedCreditForView.invoiceUrls?.length || 0) > 0) && !selectedCreditForView.poUrl) ? selectedCreditForView.id : null);
    if (!activeId) return;

    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], "clipboard-invoice.png", { type: imageType });
            const compressed = await compressImage(file, 1200, 0.8);
            await uploadInvoiceDataUrl(activeId, compressed);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Clipboard API read restriction:", err);
    }

    if (qrFileInputRef.current) {
      qrFileInputRef.current.click();
    } else {
      toast.info(isAr ? "يرجى استخدام Ctrl+V للصق صورة الفاتورة أو اختيار ملف" : "Please press Ctrl+V to paste or select invoice file");
    }
  };

  const handleQrFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const activeId = savedCreditForQR?.id || selectedCreditForView?.id;
    if (!activeId || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const compressed = await compressImage(file, 1200, 0.8);
      await uploadInvoiceDataUrl(activeId, compressed);
    } catch (err) {
      toast.error("Failed to process image file.");
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeId = savedCreditForQR?.id || (selectedCreditForView && (!selectedCreditForView.invoiceUrl && !((selectedCreditForView.invoiceUrls?.length || 0) > 0) && !selectedCreditForView.poUrl) ? selectedCreditForView.id : null);
      if (!activeId) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            await uploadInvoiceDataUrl(activeId, dataUrl);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [savedCreditForQR, selectedCreditForView]);
  
  // Skeuomorphic States
  const [isCoinDropping, setIsCoinDropping] = useState(false);
  const [isReceiptPrinting, setIsReceiptPrinting] = useState(false);

  useEffect(() => {
    // Instant cache hydration for fast 0ms initial load
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem('cached_detailed_credits');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCredits(parsed);
            const uniqueSuppliers = new Set<string>();
            parsed.forEach((c: any) => {
              if (c.companyName) uniqueSuppliers.add(c.companyName.toUpperCase());
            });
            setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));
            setLoading(false);
          }
        }
      } catch (e) {
        console.warn("Could not read cached credits:", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchCredits();
    }
  }, [currentUser, currentBranch, monthFilter]);

  const [creditHistories, setCreditHistories] = useState<Record<string, any[]>>({});

  const fetchCredits = async () => {
    const hasCached = typeof window !== "undefined" && !!localStorage.getItem('cached_detailed_credits');
    if (!hasCached) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }
    try {
      let q;
      if (monthFilter) {
        const [year, month] = monthFilter.split("-");
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
        
        q = branchIds.length > 0
          ? query(collection(db, "credits"), where("storeId", "in", branchIds), where("createdAt", ">=", startDate), where("createdAt", "<=", endDate), orderBy("createdAt", "desc"))
          : query(collection(db, "credits"), where("createdAt", ">=", startDate), where("createdAt", "<=", endDate), orderBy("createdAt", "desc"));
      } else {
        q = branchIds.length > 0
          ? query(collection(db, "credits"), where("storeId", "in", branchIds), orderBy("createdAt", "desc"), limit(150))
          : query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(150));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data() as any;

        let totalPaid = Number(d.paidAmount || 0);
        const totalDue = Number(d.amountDue || 0) + Number(d.tax || 0);

        let status = d.status || "open";

        // Backwards compatibility for old records that have status='paid' but missing paidAmount
        if (status === "paid" && totalPaid === 0 && totalDue > 0) {
          totalPaid = totalDue;
        }

        // Auto-detect status based on true totalPaid
        if (totalPaid >= totalDue && totalDue > 0) {
          status = "paid";
        } else if (totalPaid > 0 && totalPaid < totalDue) {
          status = "partial";
        } else if (status === "open" && d.collectionDate) {
          const cDate = new Date(d.collectionDate);
          if (!isNaN(cDate.getTime())) {
            const today = new Date();
            cDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            if (cDate < today) {
              status = "overdue";
            }
          }
        }

        return {
          id: doc.id,
          ...d,
          status,
          paidAmount: totalPaid,
          priceAdjustment: Number(d.priceAdjustment || 0),
          tax: Number(d.tax || 0)
        };
      }) as Credit[];
      setCredits(data);

      // Safe lightweight caching without heavy payloads (signatures, large base64 images)
      const cleanData = data.slice(0, 100).map(sanitizeCreditForCache);
      safeSetLocalStorage('cached_detailed_credits', JSON.stringify(cleanData));

      const uniqueSuppliers = new Set<string>();
      data.forEach(c => {
        if (c.companyName) uniqueSuppliers.add(c.companyName.toUpperCase());
      });
      setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));

    } catch (err: any) {
      console.error("Error fetching credits:", err);
      if (err.message?.includes("https://console.firebase.google.com")) {
        const urlMatch = err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]*)/);
        if (urlMatch) {
          toast.error("Firebase Index Missing (Required for filtering)", {
            description: "Click the button to automatically create the required index.",
            action: {
              label: "Create Index",
              onClick: () => window.open(urlMatch[0], "_blank")
            },
            duration: 20000,
          });
          setLoading(false);
          return;
        }
      }
      toast.error("Failed to load credits: " + err.message);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const toggleExpand = async (id: string) => {
    const isExpanding = !expandedCredits[id];
    setExpandedCredits(prev => ({ ...prev, [id]: isExpanding }));

    if (isExpanding && (!creditHistories[id] || !creditPOItems[id])) {
      setLoadingHistories(prev => ({ ...prev, [id]: true }));
      try {
        const currentCredit = credits.find(c => c.id === id);
        
        // 1. Fetch payment histories in parallel from multiple sources
        const historyPromises = [
          getDocs(query(collection(db, "credit_payments"), where("creditId", "==", id))),
          getDocs(query(collection(db, "cash_payments"), where("creditId", "==", id))),
        ];

        if (currentCredit?.invoiceNumber) {
          historyPromises.push(
            getDocs(query(collection(db, "credit_payments"), where("invoiceNumber", "==", currentCredit.invoiceNumber)))
          );
        }

        const snapshots = await Promise.allSettled(historyPromises);
        const allLoadedDocs: any[] = [];
        const seenIds = new Set<string>();

        snapshots.forEach(res => {
          if (res.status === "fulfilled" && res.value && res.value.docs) {
            res.value.docs.forEach(docSnap => {
              if (!seenIds.has(docSnap.id)) {
                seenIds.add(docSnap.id);
                allLoadedDocs.push({ id: docSnap.id, ...docSnap.data() });
              }
            });
          }
        });

        // Deduplicate payment records between credit_payments and cash_payments
        const deduplicatedDocs: any[] = [];
        const seenSignatures = new Set<string>();

        // Prioritize richer cash_payments records
        allLoadedDocs.sort((a, b) => {
          const aWeight = (a.category === "credit" || a.items || a.description) ? 1 : 0;
          const bWeight = (b.category === "credit" || b.items || b.description) ? 1 : 0;
          return bWeight - aWeight;
        });

        allLoadedDocs.forEach(docItem => {
          const docDate = docItem.date || (docItem.createdAt && typeof docItem.createdAt.toDate === 'function' ? docItem.createdAt.toDate().toISOString().substring(0, 10) : "");
          const docAmount = Math.round(Number(docItem.amount || docItem.total || 0));
          const docMethod = (docItem.method || "cash").toLowerCase();
          const sig = `${docDate}_${docAmount}_${docMethod}`;
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            deduplicatedDocs.push(docItem);
          }
        });

        let finalHistory = deduplicatedDocs;

        // If no separate documents found, check embedded payments array
        if (finalHistory.length === 0 && currentCredit?.payments && Array.isArray(currentCredit.payments) && currentCredit.payments.length > 0) {
          finalHistory = currentCredit.payments;
        }

        // If still empty but the credit was marked as paid or has paidAmount > 0, generate an official recorded settlement item
        if (finalHistory.length === 0 && currentCredit && (Number(currentCredit.paidAmount) > 0 || currentCredit.status === "paid")) {
          const totalDue = Number(currentCredit.amountDue || 0) + Number(currentCredit.tax || 0);
          const paidAmt = Number(currentCredit.paidAmount) > 0 ? Number(currentCredit.paidAmount) : totalDue;
          finalHistory = [{
            id: `settlement_${currentCredit.id}`,
            amount: paidAmt,
            date: currentCredit.collectionDate || currentCredit.date || new Date().toISOString().split("T")[0],
            method: "Direct Settlement / سداد معتمد",
            createdBy: currentCredit.createdBy || "Store Manager",
            isSettlement: true
          }];
        }

        // Sort by date / createdAt descending
        finalHistory.sort((a: any, b: any) => {
          if (a.createdAt && b.createdAt) {
            const timeA = a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
            return timeB - timeA;
          }
          return 0;
        });

        setCreditHistories(prev => ({ ...prev, [id]: finalHistory }));

        // 2. Fetch PO items if not already on currentCredit.items
        let items = currentCredit?.items || [];
        if (items.length === 0 && currentCredit?.invoiceNumber) {
          try {
            const expSnap = await getDocs(
              query(collection(db, "expiries"), where("invoiceNumber", "==", currentCredit.invoiceNumber))
            );
            if (!expSnap.empty) {
              items = expSnap.docs.map(d => {
                const ed = d.data();
                return {
                  barcode: ed.barcode || "N/A",
                  description: ed.itemName || "Unnamed Item",
                  quantity: ed.quantity || 1,
                  unitPrice: ed.unitPrice || 0,
                };
              });
            }
          } catch (poErr) {
            console.warn("Could not fetch PO items from expiries:", poErr);
          }
        }
        setCreditPOItems(prev => ({ ...prev, [id]: items }));

        // 3. Recalculate true paid amount from history for accuracy
        const calculatedPaid = finalHistory.reduce((sum, payment: any) => sum + Number(payment.amount || 0), 0);
        if (calculatedPaid > 0 && currentCredit) {
          setCredits(prev => prev.map(c => {
            if (c.id === id) {
              const newPaid = Math.max(c.paidAmount, calculatedPaid);
              const totalDue = (Number(c.amountDue) || 0) + (Number(c.tax) || 0);
              return { 
                ...c, 
                paidAmount: newPaid, 
                status: newPaid >= totalDue ? "paid" : c.status 
              };
            }
            return c;
          }));
        }
      } catch (err) {
        console.error("Failed to load details for credit", id, err);
      } finally {
        setLoadingHistories(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const name = newSupplierName.trim().toUpperCase();
    const newSupp = { id: `sup_new_${Date.now()}`, name };
    setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyName(name);
    setShowAddSupplier(false);
    setNewSupplierName("");
    toast.success("Supplier ready to be used!");
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || !companyName || !amountDue || !collectionDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newCredit = {
        amountDue: parseFloat(amountDue),
        collectionDate,
        companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        invoiceNumber,
        isTaxable,
        onSalesOnly,
        poNumber,
        status: "open",
        storeId: branchIds.length > 0 ? branchIds[0] : "eL-alamein-4",
        tax: parseFloat(tax) || 0,
        paidAmount: 0,
        priceAdjustment: 0,
        managerSignature: managerSignature || (hasSigned && sigPadRef.current ? sigPadRef.current.toDataURL() : null),
        items: poItems,
        poImageUrl
      };

      // Sync products to master DB if we have items
      if (poItems && poItems.length > 0) {
        await syncProductsToMaster(poItems, collectionDate || new Date().toISOString().split('T')[0], companyName);
      }

      const docRef = await addDoc(collection(db, "credits"), newCredit);

      // Dispatch Universal System Notification
      dispatchNotificationSystem({
        title: `📑 New Credit Note / Invoice - ${companyName}`,
        body: `Invoice of EGP ${Number(amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })} logged for ${companyName}.\nTax: EGP ${Number(tax).toLocaleString()}${poNumber ? ` • PO #: ${poNumber}` : ''}${invoiceNumber ? ` • Inv #: ${invoiceNumber}` : ''}`,
        type: "credit",
        url: "/financials/inputs/credits",
        branchId: currentBranch,
        metadata: { companyName, amountDue, tax, poNumber, invoiceNumber, storeId: currentBranch }
      });

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Create Credit Record",
        "N/A",
        `Supplier: ${companyName}, Amount: EGP ${amountDue}`
      ).catch(() => {});

      const savedCredit = { id: docRef.id, ...newCredit, createdAt: Timestamp.now() } as Credit;
      const updatedCredits = [savedCredit, ...credits];
      setCredits(updatedCredits);
      
      const cleanUpdated = updatedCredits.slice(0, 50).map(sanitizeCreditForCache);
      safeSetLocalStorage('cached_detailed_credits', JSON.stringify(cleanUpdated));

      toast.success("Credit added & notification sent!");
      setShowAddModal(false);
      setSavedCreditForQR(savedCredit);

      // Reset form
      setInvoiceNumber("");
      setPoNumber("");
      setCompanyName("");
      setAmountDue("");
      setTax("0");
      setCollectionDate("");
      setOnSalesOnly(false);
      setIsTaxable(false);
      setPoItems([]);
      setPoImageUrl("");
      
      setManagerSignature("");
      setHasSigned(false);
      if (sigPadRef.current) {
        sigPadRef.current.clear();
      }

    } catch (error) {
      console.error("Error adding credit:", error);
      toast.error("Failed to add credit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCredit = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credit?")) return;
    try {
      const creditItem = credits.find(c => c.id === id);
      await deleteDoc(doc(db, "credits", id));

      // Cascade delete child credit_payments and cash_payments
      try {
        const [cpSnap, cashSnap] = await Promise.all([
          getDocs(query(collection(db, "credit_payments"), where("creditId", "==", id))),
          getDocs(query(collection(db, "cash_payments"), where("creditId", "==", id)))
        ]);
        cpSnap.docs.forEach(d => deleteDoc(d.ref).catch(() => {}));
        cashSnap.docs.forEach(d => deleteDoc(d.ref).catch(() => {}));
      } catch (e) {
        console.error("Error cleaning child credit payments:", e);
      }

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Delete Credit Record",
        `ID: ${id}, Supplier: ${creditItem?.companyName || "N/A"}, Amount: EGP ${creditItem?.amountDue || 0}`,
        "Deleted"
      ).catch(() => {});

      setCredits(credits.filter(c => c.id !== id));
      toast.success("Credit & associated payments deleted.");
    } catch (error) {
      console.error("Error deleting credit:", error);
      toast.error("Failed to delete.");
    }
  };

  const handleDeleteCreditPayment = async (credit: Credit, payment: any) => {
    const role = typeof window !== "undefined" ? localStorage.getItem("circlek_role") : null;
    if (role === "manager") {
      toast.error(isAr ? "غير مصرح. حذف الدفعات متاح للمسؤول فقط." : "Unauthorized. Only Admin can delete payments.");
      return;
    }

    const pAmt = Number(payment.grossAmount || payment.grossTotal || (Number(payment.amount || 0) + Number(payment.returnDeductionAmount || 0)) || payment.total || 0);
    if (!confirm(isAr 
      ? `هل أنت متأكد من حذف هذه الدفعة بقيمة EGP ${pAmt.toLocaleString()}؟` 
      : `Are you sure you want to delete this payment of EGP ${pAmt.toLocaleString()}?`)) {
      return;
    }

    try {
      // 1. Delete from cash_payments and credit_payments by ID
      if (payment.id) {
        try { await deleteDoc(doc(db, "cash_payments", payment.id)); } catch (e) {}
        try { await deleteDoc(doc(db, "credit_payments", payment.id)); } catch (e) {}
      }

      // If this payment had an associated RTV return in supplier_returns, delete it as well
      const associatedReturnId = payment.returnDetails?.returnId || payment.returnId;
      if (associatedReturnId) {
        try { await deleteDoc(doc(db, "supplier_returns", associatedReturnId)); } catch (e) {}
      }

      // Also clean any duplicates with same creditId & date & amount
      try {
        const [cpSnap, cashSnap] = await Promise.all([
          getDocs(query(collection(db, "credit_payments"), where("creditId", "==", credit.id))),
          getDocs(query(collection(db, "cash_payments"), where("creditId", "==", credit.id)))
        ]);
        cpSnap.docs.forEach(d => {
          const dData = d.data();
          if (Math.abs(Number(dData.amount || 0) - pAmt) < 2) {
            deleteDoc(d.ref).catch(() => {});
          }
        });
        cashSnap.docs.forEach(d => {
          const dData = d.data();
          if (Math.abs(Number(dData.amount || 0) - pAmt) < 2) {
            deleteDoc(d.ref).catch(() => {});
          }
        });
      } catch (e) {
        console.warn("Cleanup error:", e);
      }

      // 2. Recalculate Credit paidAmount & status
      const totalDue = Number(credit.amountDue || 0) + Number(credit.tax || 0);
      const newPaidAmount = Math.max(0, Number(credit.paidAmount || 0) - pAmt);
      const newStatus = newPaidAmount >= totalDue && totalDue > 0 ? "paid" : "open";

      await updateDoc(doc(db, "credits", credit.id), {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 3. Update local state
      setCredits(prev => prev.map(c => c.id === credit.id ? {
        ...c,
        paidAmount: newPaidAmount,
        status: newStatus as any
      } : c));

      setCreditHistories(prev => ({
        ...prev,
        [credit.id]: (prev[credit.id] || []).filter((p: any) => p.id !== payment.id)
      }));

      // 4. Log Action
      const editorEmail = currentUser?.email || auth.currentUser?.email || "Admin";
      dbService.logAction(
        editorEmail,
        currentUser?.displayName || "Admin",
        role || "admin",
        "Delete Credit Payment",
        `Credit ID: ${credit.id}, Inv: ${credit.invoiceNumber || "N/A"}, Amount: EGP ${pAmt}`,
        "Deleted"
      ).catch(() => {});

      toast.success(isAr ? "تم حذف الدفعة وتحديث حساب الفاتورة بنجاح!" : "Payment deleted and credit balance updated successfully!");
    } catch (err: any) {
      console.error("Failed to delete payment:", err);
      toast.error(isAr ? "فشل حذف الدفعة" : "Failed to delete payment.");
    }
  };

  const handleOpenEditCredit = (c: Credit) => {
    const role = typeof window !== "undefined" ? localStorage.getItem("circlek_role") : null;
    if (role === "manager") {
      toast.error(isAr ? "غير مصرح. التعديل متاح للإدارة فقط." : "Unauthorized. Edit is only available for Admin.");
      return;
    }
    setEditingCredit(c);
    setEditCompanyName(c.companyName || "");
    setEditAmountDue(c.amountDue !== undefined ? c.amountDue.toString() : "");
    setEditTax(c.tax !== undefined ? c.tax.toString() : "0");
    setEditInvoiceNumber(c.invoiceNumber || "");
    setEditPoNumber(c.poNumber || "");
    setEditCollectionDate(c.collectionDate || "");
    setEditDate(c.date || (c.createdAt?.toDate ? c.createdAt.toDate().toISOString().split("T")[0] : new Date().toISOString().split("T")[0]));
    setEditOnSalesOnly(!!c.onSalesOnly);
    setEditIsTaxable(!!c.isTaxable);
    setShowEditCreditModal(true);
  };

  const handleSaveEditCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredit) return;

    const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
    if (role === "manager") {
      toast.error(isAr ? "غير مصرح لك بتعديل الفواتير" : "Unauthorized. Only Admins can edit invoices.");
      return;
    }

    if (!editCompanyName.trim() || !editAmountDue) {
      toast.error(isAr ? "يرجى ملء المورد والمبلغ المستحق" : "Company and Amount Due are required.");
      return;
    }

    const numAmountDue = parseFloat(editAmountDue) || 0;
    const numTax = parseFloat(editTax) || 0;

    // Detect exact changes
    const changes: string[] = [];
    const oldAmountDue = Number(editingCredit.amountDue) || 0;
    if (oldAmountDue !== numAmountDue) {
      changes.push(`Amount Due (Before Tax): EGP ${oldAmountDue.toLocaleString()} ➔ EGP ${numAmountDue.toLocaleString()}`);
    }

    const oldTax = Number(editingCredit.tax) || 0;
    if (oldTax !== numTax) {
      changes.push(`Tax Amount: EGP ${oldTax.toLocaleString()} ➔ EGP ${numTax.toLocaleString()}`);
    }

    if ((editingCredit.companyName || "") !== editCompanyName.trim()) {
      changes.push(`Supplier: "${editingCredit.companyName || 'N/A'}" ➔ "${editCompanyName.trim()}"`);
    }

    if ((editingCredit.invoiceNumber || "") !== editInvoiceNumber.trim()) {
      changes.push(`Invoice #: "${editingCredit.invoiceNumber || 'N/A'}" ➔ "${editInvoiceNumber.trim() || 'N/A'}"`);
    }

    if ((editingCredit.poNumber || "") !== editPoNumber.trim()) {
      changes.push(`PO #: "${editingCredit.poNumber || 'N/A'}" ➔ "${editPoNumber.trim() || 'N/A'}"`);
    }

    if ((editingCredit.collectionDate || "") !== editCollectionDate) {
      changes.push(`Collection Date: "${editingCredit.collectionDate || 'N/A'}" ➔ "${editCollectionDate}"`);
    }

    if ((editingCredit.date || "") !== editDate) {
      changes.push(`Date: "${editingCredit.date || 'N/A'}" ➔ "${editDate}"`);
    }

    if (!!editingCredit.onSalesOnly !== editOnSalesOnly) {
      changes.push(`Sales Only: ${editingCredit.onSalesOnly ? 'Yes' : 'No'} ➔ ${editOnSalesOnly ? 'Yes' : 'No'}`);
    }

    if (changes.length === 0) {
      toast.info(isAr ? "لم يتم إجراء أي تعديل" : "No changes detected.");
      setShowEditCreditModal(false);
      setEditingCredit(null);
      return;
    }

    try {
      setIsSubmitting(true);
      const editorName = currentUser?.displayName || currentUser?.email || auth.currentUser?.email || "Admin";
      const nowIso = new Date().toISOString();

      const newHistoryEntry = {
        editedAt: nowIso,
        editedBy: editorName,
        role: role,
        changes: changes,
        summary: changes.join(" • ")
      };

      const updatedPayload: any = {
        amountDue: numAmountDue,
        tax: numTax,
        isTaxable: numTax > 0 || editIsTaxable,
        companyName: editCompanyName.trim(),
        invoiceNumber: editInvoiceNumber.trim(),
        poNumber: editPoNumber.trim(),
        collectionDate: editCollectionDate,
        date: editDate,
        onSalesOnly: editOnSalesOnly,
        isEdited: true,
        lastEditedAt: nowIso,
        lastEditedBy: editorName,
        editHistory: [...(editingCredit.editHistory || []), newHistoryEntry]
      };

      await updateDoc(doc(db, "credits", editingCredit.id), updatedPayload);

      // Update local state
      const updatedDoc = { ...editingCredit, ...updatedPayload };
      setCredits(prev => prev.map(c => c.id === editingCredit.id ? updatedDoc : c));
      if (selectedCreditForView?.id === editingCredit.id) {
        setSelectedCreditForView(updatedDoc);
      }

      // Log in audit system
      dbService.logAction(
        auth.currentUser?.email || editorName,
        auth.currentUser?.displayName || editorName,
        role,
        "Edit Credit Invoice (Admin)",
        `Credit ID: ${editingCredit.id}, Supplier: ${editCompanyName}`,
        `Changes: ${changes.join("; ")}`
      ).catch(() => {});

      toast.success(isAr ? "تم تحديث الفاتورة وحفظ سجل التعديل بنجاح!" : "Credit invoice updated & audit logged successfully!");
      setShowEditCreditModal(false);
      setEditingCredit(null);
    } catch (err: any) {
      console.error("Failed to update credit:", err);
      toast.error(isAr ? "فشل تعديل الفاتورة" : "Failed to update credit invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setIsProcessingPo(true);
    try {
      const base64Image = await compressImage(file, 1000, 0.7);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
        signal: AbortSignal.timeout(18000)
      });
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("RATE_LIMIT");
          }
          throw new Error('Failed to process PO');
        }

        const data = await response.json();
        
        // User requested to skip saving PO images to storage for faster processing
        setPoImageUrl("");


        if (data.invoiceNumber && data.invoiceNumber !== "UNKNOWN") setInvoiceNumber(data.invoiceNumber);
        if (data.poNumber && data.poNumber !== "UNKNOWN") setPoNumber(data.poNumber);
        if (data.companyName && data.companyName !== "UNKNOWN") {
          setCompanyName(data.companyName.toUpperCase());
          // Auto add supplier to dropdown if not exists
          const name = data.companyName.toUpperCase();
          setSuppliers(prev => {
            if (!prev.find(s => s.name === name)) {
              return [...prev, { id: `sup_auto_${Date.now()}`, name }].sort((a, b) => a.name.localeCompare(b.name));
            }
            return prev;
          });
        }
        
        if (data.amount !== undefined) setAmountDue(data.amount.toString());
        if (data.tax !== undefined) setTax(data.tax.toString());
        if (data.items) setPoItems(data.items);
        
        toast.success('PO processed successfully!');
      } catch (error: any) {
        console.error('Error processing PO:', error);
        if (error.message === 'RATE_LIMIT') {
          toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
        } else {
          toast.error('Failed to extract PO details. Please enter manually.');
        }
      } finally {
        setIsProcessingPo(false);
      }
  };

  const handleUploadPoToOldCredit = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setUploadingPoToOldCredit(true);
    try {
      const base64Image = await compressImage(file, 1000, 0.7);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
        signal: AbortSignal.timeout(18000)
      });
        
        if (!response.ok) {
          throw new Error('Failed to process PO');
        }

        const data = await response.json();
        
        // User requested to skip saving PO images to storage for faster processing
        const updateData: any = {
          items: data.items || []
        };
        
        // Only update these fields if they exist and aren't "UNKNOWN"
        if (data.poNumber && data.poNumber !== "UNKNOWN") updateData.poNumber = data.poNumber;
        if (data.invoiceNumber && data.invoiceNumber !== "UNKNOWN") updateData.invoiceNumber = data.invoiceNumber;
        
        // Sync products to master DB
        if (data.items && data.items.length > 0) {
          const poDateForSync = selectedCreditForPoUpload?.collectionDate || new Date().toISOString().split('T')[0];
          await syncProductsToMaster(data.items, poDateForSync, selectedCreditForPoUpload?.companyName || "Unknown Supplier");
        }

        // Update the document
        if (selectedCreditForPoUpload) {
          await updateDoc(doc(db, "credits", selectedCreditForPoUpload.id), updateData);
          
          // Refresh local state
          setCredits(prev => prev.map(c => 
            c.id === selectedCreditForPoUpload.id ? { ...c, ...updateData } : c
          ));
          toast.success('PO added to credit and products synchronized!');
        }
      } catch (error: any) {
        console.error('Error adding PO to old credit:', error);
        if (error.message === 'RATE_LIMIT') {
          toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
        } else {
          toast.error('Failed to add PO to credit.');
        }
      } finally {
        setUploadingPoToOldCredit(false);
        setSelectedCreditForPoUpload(null);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePastePoImageButtonClick = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          if (selectedCreditForPoUpload) {
            handleUploadPoToOldCredit(file);
          } else {
            handleImageUpload(file);
          }
          return;
        }
      }
      toast.error('No image found in clipboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to read clipboard. Please use Cmd+V / Ctrl+V on your keyboard.');
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (selectedCreditForPoUpload || showAddModal) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              if (selectedCreditForPoUpload) {
                handleUploadPoToOldCredit(file);
              } else if (showAddModal) {
                handleImageUpload(file);
              }
            }
            break;
          }
        }
        return;
      }
      
      if (showPaymentModal) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file && paymentMethod === 'bank_transfer') {
              e.preventDefault();
              setBankTransferFile(file);
              toast.success("Bank transfer receipt pasted!");
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [selectedCreditForPoUpload, showAddModal, showPaymentModal, paymentMethod]);

  const handlePasteBankReceipt = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-bank-receipt.png", { type: imageType });
          setBankTransferFile(file);
          toast.success('Bank transfer receipt pasted successfully!');
          return;
        }
      }
      toast.error('No image found in clipboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to read clipboard. Please use Ctrl+V / Cmd+V directly or upload a file.');
    }
  };

  const handleUploadPaymentPo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(isAr ? 'برجاء رفع ملف صورة صالح.' : 'Please upload a valid image file.');
      return;
    }
    setIsProcessingPaymentPo(true);
    try {
      const base64Image = await compressImage(file, 1000, 0.7);
      setPaymentPoImageUrl(base64Image);

      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
        signal: AbortSignal.timeout(18000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.poNumber && data.poNumber !== "UNKNOWN" && !paymentPoNumber) {
          setPaymentPoNumber(data.poNumber);
        }
        if (data.items && data.items.length > 0 && paymentPoItems.length === 0) {
          setPaymentPoItems(data.items);
        }
        toast.success(isAr ? 'تم استخراج بيانات أمر الشراء بنجاح!' : 'PO processed successfully!');
      }
    } catch (err) {
      console.warn("PO OCR error, image preserved:", err);
      toast.info(isAr ? "تم حفظ صورة أمر الشراء" : "PO image saved");
    } finally {
      setIsProcessingPaymentPo(false);
    }
  };

  const handlePastePaymentPo = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted-po.png", { type: imageType });
          await handleUploadPaymentPo(file);
          return;
        }
      }
      toast.error(isAr ? 'لم يتم العثور على صورة في الحافظة' : 'No image found in clipboard');
    } catch (e) {
      toast.error(isAr ? 'تعذر قراءة الحافظة، يرجى رفع الصورة' : 'Failed to read clipboard');
    }
  };

  const handleOpenPaymentModal = (credit: Credit) => {
    setSelectedCreditForPayment(credit);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

    // Suggest the remaining amount
    const remaining = (credit.amountDue + credit.tax) - credit.paidAmount;
    setPaymentAmount(remaining.toString());
    setPaymentMethod("cash");
    setBankTransferFile(null);
    setHasReturn(false);
    setReturnSource("pending");
    setSelectedPendingReturn(null);
    setPendingReturnSearchQuery("");
    setShowAllSuppliersPending(false);
    setReturnAmount("");
    setReturnTransferOutNumber("");
    setReturnAgentName(credit.supplierRepName || "");
    setReturnAgentNationalId(credit.supplierNationalId || "");
    setReturnAgentMobile("");
    setReturnReason("");
    setReturnItems([]);
    setShowPaymentItemsDrawer(false);

    // Initialize PO details
    setPaymentPoNumber(credit.poNumber || "");
    const initialPoImage = credit.poImageUrl || credit.poUrl || (credit.poUrls && credit.poUrls[0]) || "";
    setPaymentPoImageUrl(initialPoImage);

    // Resolve PO items from memory or state
    let items = credit.items || [];
    if (items.length === 0 && creditPOItems[credit.id] && creditPOItems[credit.id].length > 0) {
      items = creditPOItems[credit.id];
    }
    setPaymentPoItems(items);

    setShowPaymentModal(true);
    fetchPendingReturnsList();

    // Background fetch if items or PO are missing on credit
    if ((items.length === 0 || !credit.poNumber || !initialPoImage) && (credit.invoiceNumber || credit.id)) {
      (async () => {
        try {
          let fetchedItems: any[] = [];
          if (credit.invoiceNumber) {
            const expSnap = await getDocs(
              query(collection(db, "expiries"), where("invoiceNumber", "==", credit.invoiceNumber))
            );
            if (!expSnap.empty) {
              fetchedItems = expSnap.docs.map(d => {
                const ed = d.data();
                return {
                  barcode: ed.barcode || "N/A",
                  description: ed.itemName || "Unnamed Item",
                  quantity: ed.quantity || 1,
                  unitPrice: ed.unitPrice || 0,
                };
              });
            }
          }
          if (fetchedItems.length === 0 && credit.id) {
            const directSnap = await getDoc(doc(db, "credits", credit.id));
            if (directSnap.exists()) {
              const dData = directSnap.data();
              if (dData.items && Array.isArray(dData.items) && dData.items.length > 0) {
                fetchedItems = dData.items;
              }
              if (dData.poNumber && !credit.poNumber) {
                setPaymentPoNumber(dData.poNumber);
              }
              if (dData.poImageUrl && !initialPoImage) {
                setPaymentPoImageUrl(dData.poImageUrl);
              }
            }
          }
          if (fetchedItems.length > 0) {
            setPaymentPoItems(fetchedItems);
            setCreditPOItems(prev => ({ ...prev, [credit.id]: fetchedItems }));
          }
        } catch (e) {
          console.warn("Could not background fetch PO items for payment modal:", e);
        }
      })();
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditForPayment) return;
    
    const grossSettled = parseFloat(paymentAmount);
    if (isNaN(grossSettled) || grossSettled <= 0) {
      toast.error(isAr ? "يرجى إدخال مبلغ سداد صحيح" : "Enter a valid payment amount");
      return;
    }

    const numReturnAmount = hasReturn ? (parseFloat(returnAmount) || 0) : 0;

    if (hasReturn) {
      if (numReturnAmount <= 0) {
        toast.error(isAr ? "برجاء إدخال قيمة خصم المرتجع بشكل صحيح." : "Please enter a valid return deduction amount.");
        return;
      }
      if (numReturnAmount > grossSettled) {
        toast.error(isAr ? "قيمة خصم المرتجع لا يمكن أن تتجاوز إجمالي المبلغ المسدد." : "Return deduction cannot exceed gross settlement amount.");
        return;
      }
    }

    // Auto-generate fallback TR Number if not provided
    const finalTransferOutNum = returnTransferOutNumber.trim() || (hasReturn ? `TR-${Date.now().toString().slice(-6)}` : "");

    // Net cash disbursed from safe (after deducting goods return RTV)
    const netCashDisbursed = Math.max(0, grossSettled - numReturnAmount);

    setIsSubmitting(true);
    const saveToastId = toast.loading(isAr ? "جاري تسجيل السداد وتسوية المرتجع..." : "Processing payment & return settlement...");

    try {
      const currentPaid = Number(selectedCreditForPayment.paidAmount) || 0;
      // Credit debt is settled by the full gross amount (Cash + Return)
      const newPaidAmount = currentPaid + grossSettled;
      const totalDue = (Number(selectedCreditForPayment.amountDue) || 0) + (Number(selectedCreditForPayment.tax) || 0);

      let newStatus = selectedCreditForPayment.status;
      if (newPaidAmount >= totalDue) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      // Step A: Prepare receipt image if bank transfer
      let bankTransferReceiptUrl = null;
      if (paymentMethod === 'bank_transfer' && bankTransferFile) {
        try {
          bankTransferReceiptUrl = await compressImage(bankTransferFile, 800, 0.65);
        } catch (imgErr) {
          console.warn("Failed to compress bank transfer receipt, continuing without image:", imgErr);
        }
      }

      // Step B: Determine canonical storeId
      const rawStoreId = selectedCreditForPayment.storeId || 
        (branchIds.length > 0 && branchIds[0] !== "all" ? branchIds[0] : "eL-alamein-4");
      const targetStoreId = (rawStoreId.toLowerCase().includes("ola") || currentBranch === "ola")
        ? "ola-el-koronfol"
        : "eL-alamein-4";

      const userEmail = currentUser?.email || 
        (typeof window !== "undefined" ? localStorage.getItem("circlek_email") || localStorage.getItem("circlek_role") : null) || 
        "manager";

      // Step C: If there is an RTV return, settle existing pending return or create a new settled record
      const isPendingSource = hasReturn && returnSource === "pending" && !!selectedPendingReturn;
      const finalReturnNumber = isPendingSource
        ? (selectedPendingReturn.returnNumber || `RTV-${selectedPendingReturn.id.slice(-6)}`)
        : (hasReturn ? `RTV-${Date.now().toString().slice(-6)}` : null);

      const finalRepName = returnAgentName.trim() || selectedCreditForPayment.supplierRepName || (isPendingSource ? selectedPendingReturn.agentName : "") || "مندوب الشركة المعتمد";
      const finalRepNationalId = returnAgentNationalId.trim() || selectedCreditForPayment.supplierNationalId || (isPendingSource ? selectedPendingReturn.agentNationalId : "") || "";
      const finalRepMobile = returnAgentMobile.trim() || (isPendingSource ? selectedPendingReturn.agentMobile : "") || "";
      const finalReturnReason = returnReason.trim() || (isPendingSource ? selectedPendingReturn.reason : "") || "خصم مرتجع بضاعة من سداد المديونية الآجلة";

      const finalReturnItems = ((returnItems && returnItems.length > 0)
        ? returnItems
        : (isPendingSource && selectedPendingReturn.items && selectedPendingReturn.items.length > 0)
          ? selectedPendingReturn.items
          : [{
              barcode: "N/A",
              itemName: finalReturnReason,
              quantity: 1,
              unitPrice: numReturnAmount,
              totalPrice: numReturnAmount
            }]).map((it, idx) => ({
              barcode: it.barcode || "N/A",
              itemName: it.itemName || (finalReturnReason || `صنف مرتجع ${idx + 1}`),
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice: Number(it.totalPrice) || 0
            }));

      let createdReturnId = null;
      const voucherRef = selectedCreditForPayment.invoiceNumber ? `INV-${selectedCreditForPayment.invoiceNumber}` : `CREDIT-${selectedCreditForPayment.id.slice(-6)}`;

      if (hasReturn && numReturnAmount > 0) {
        if (isPendingSource) {
          // Update all docs belonging to this pending return ticket to settled!
          const settleTimestamp = new Date().toISOString();
          for (const docId of selectedPendingReturn.allDocIds) {
            try {
              await updateDoc(doc(db, "supplier_returns", docId), cleanPayload({
                status: "returned",
                isSettled: true,
                settledAt: settleTimestamp,
                settledBy: userEmail,
                settledByVoucher: voucherRef,
                paymentTiming: "now",
                settlementMethod: "money",
                deductedFromPaymentDate: paymentDate || new Date().toISOString().split("T")[0],
                returnAmount: numReturnAmount,
                transferOutNumber: finalTransferOutNum || selectedPendingReturn.transferOutNumber || "",
                agentName: finalRepName,
                agentNationalId: finalRepNationalId,
                agentMobile: finalRepMobile,
                creditId: selectedCreditForPayment.id
              }));
            } catch (updErr) {
              console.warn(`Failed to update return doc ${docId}:`, updErr);
            }
          }
          createdReturnId = selectedPendingReturn.id;
        } else {
          // Create new settled return record in supplier_returns
          const returnTimestamp = new Date().toISOString();
          const returnDocRef = await addDoc(collection(db, "supplier_returns"), cleanPayload({
            barcode: finalReturnItems[0]?.barcode || "N/A",
            itemName: finalReturnItems[0]?.itemName || finalReturnReason,
            category: "deduction_from_payment",
            supplier: selectedCreditForPayment.companyName || "مورد",
            quantity: finalReturnItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 1,
            storeId: targetStoreId,
            branchId: currentBranch === "all" ? (targetStoreId.includes("ola") ? "ola" : "alamein4") : currentBranch,
            status: "returned",
            createdAt: returnTimestamp,
            createdBy: userEmail,
            returnedAt: returnTimestamp,
            returnNumber: finalReturnNumber,
            transferOutNumber: finalTransferOutNum,
            agentName: finalRepName,
            agentNationalId: finalRepNationalId,
            agentMobile: finalRepMobile,
            totalPrice: numReturnAmount,
            reason: finalReturnReason,
            items: finalReturnItems,
            settlementMethod: "money",
            paymentTiming: "now",
            isSettled: true,
            paymentVoucherNumber: voucherRef,
            creditId: selectedCreditForPayment.id,
            deductedFromPaymentDate: paymentDate || new Date().toISOString().split("T")[0]
          }));
          createdReturnId = returnDocRef.id;
        }
      }

      const returnDetailsPayload = (hasReturn && numReturnAmount > 0) ? {
        returnNumber: finalReturnNumber || `RTV-${Date.now().toString().slice(-6)}`,
        returnId: createdReturnId || "",
        allDocIds: (isPendingSource && selectedPendingReturn?.allDocIds ? selectedPendingReturn.allDocIds : [createdReturnId]).filter(Boolean),
        sourceType: isPendingSource ? "pending_settled" : "newly_created",
        transferOutNumber: finalTransferOutNum,
        returnAmount: numReturnAmount,
        agentName: finalRepName,
        agentNationalId: finalRepNationalId,
        agentMobile: finalRepMobile,
        reason: finalReturnReason,
        items: finalReturnItems,
        returnedAt: (isPendingSource && selectedPendingReturn?.returnedAt) ? selectedPendingReturn.returnedAt : new Date().toISOString(),
        isSettled: true,
        settlementMethod: "money",
        paymentTiming: "now",
        paymentVoucherNumber: voucherRef
      } : null;

      const finalPoNumber = paymentPoNumber.trim() || selectedCreditForPayment.poNumber || "";
      const finalItems = ((paymentPoItems && paymentPoItems.length > 0)
        ? paymentPoItems
        : ((selectedCreditForPayment.items && selectedCreditForPayment.items.length > 0)
            ? selectedCreditForPayment.items
            : (creditPOItems[selectedCreditForPayment.id] || []))).map((it: any) => ({
          barcode: it.barcode || "N/A",
          name: it.name || it.itemName || "صنف",
          quantity: Number(it.quantity) || 1,
          price: Number(it.price || it.unitPrice) || 0,
          total: Number(it.total || it.totalPrice) || 0
        }));

      const finalPoImageUrl = paymentPoImageUrl || selectedCreditForPayment.poImageUrl || selectedCreditForPayment.poUrl || (selectedCreditForPayment.poUrls && selectedCreditForPayment.poUrls[0]) || "";
      const finalInvoiceUrl = selectedCreditForPayment.invoiceUrl || (selectedCreditForPayment.invoiceUrls && selectedCreditForPayment.invoiceUrls.length > 0 ? selectedCreditForPayment.invoiceUrls[0] : "");

      // Step D: Update Credit Document in Firestore
      const creditUpdatePayload: any = {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: serverTimestamp(),
      };
      if (finalPoNumber && !selectedCreditForPayment.poNumber) {
        creditUpdatePayload.poNumber = finalPoNumber;
      }
      if (finalItems.length > 0 && (!selectedCreditForPayment.items || selectedCreditForPayment.items.length === 0)) {
        creditUpdatePayload.items = finalItems;
      }
      if (finalPoImageUrl && !selectedCreditForPayment.poImageUrl) {
        creditUpdatePayload.poImageUrl = finalPoImageUrl;
      }
      await updateDoc(doc(db, "credits", selectedCreditForPayment.id), cleanPayload(creditUpdatePayload));

      // Optimistically update local credit state immediately
      setCredits(prev => prev.map(c => c.id === selectedCreditForPayment.id ? { 
        ...c, 
        paidAmount: newPaidAmount, 
        status: newStatus as any,
        ...(finalPoNumber ? { poNumber: finalPoNumber } : {}),
        ...(finalItems.length > 0 ? { items: finalItems } : {}),
        ...(finalPoImageUrl ? { poImageUrl: finalPoImageUrl } : {})
      } : c));

      if (finalItems.length > 0) {
        setCreditPOItems(prev => ({ ...prev, [selectedCreditForPayment.id]: finalItems }));
      }

      // Step E: Write cash_payments (single source of truth for payments ledger)
      // Safe accounting: Safe balance outflow is payment.amount, so we store netCashDisbursed
      let createdCashPaymentId = "";
      const paymentRecord: any = {
        amount: netCashDisbursed,
        grossAmount: grossSettled,
        grossTotal: grossSettled,
        hasReturn: hasReturn && numReturnAmount > 0,
        returnDeductionAmount: hasReturn ? numReturnAmount : 0,
        returnNumber: finalReturnNumber || "",
        returnTransferOutNumber: finalTransferOutNum,
        returnDetails: returnDetailsPayload,
        category: "order",
        subCategory: "credit_payment",
        categoryNote: `Credit Payment - Inv #${selectedCreditForPayment.invoiceNumber || ""} - ${selectedCreditForPayment.companyName || ""}${finalPoNumber ? ` • PO #${finalPoNumber}` : ''}${hasReturn ? ` (RTV: EGP ${numReturnAmount})` : ''}`,
        companyName: selectedCreditForPayment.companyName || "Unknown",
        createdAt: serverTimestamp(),
        createdBy: userEmail,
        date: paymentDate || new Date().toISOString().split("T")[0],
        description: hasReturn ? `Credit Payment & RTV Settled` : `Credit Payment`,
        invoiceNumber: selectedCreditForPayment.invoiceNumber || "",
        isTaxable: Number(selectedCreditForPayment.tax) > 0,
        method: paymentMethod,
        poNumber: finalPoNumber,
        poImageUrl: finalPoImageUrl || "",
        invoiceUrl: finalInvoiceUrl || "",
        managerSignature: selectedCreditForPayment.managerSignature || "",
        supplierRepName: finalRepName,
        supplierNationalId: finalRepNationalId,
        items: finalItems,
        storeId: targetStoreId,
        tax: 0,
        total: netCashDisbursed,
        creditId: selectedCreditForPayment.id,
      };
      if (bankTransferReceiptUrl) {
        paymentRecord.bankTransferReceiptUrl = bankTransferReceiptUrl;
      }

      const cleanedPaymentRecord = cleanPayload(paymentRecord);
      try {
        const cashDocRef = await addDoc(collection(db, "cash_payments"), cleanedPaymentRecord);
        createdCashPaymentId = cashDocRef.id;
      } catch (firstCashErr) {
        console.warn("Primary cash_payments addDoc failed, retrying with lightweight payload:", firstCashErr);
        // Retry with lightweight payload stripping large image blobs
        const lightweight = { ...cleanedPaymentRecord };
        delete lightweight.poImageUrl;
        delete lightweight.invoiceUrl;
        delete lightweight.invoiceUrls;
        delete lightweight.poUrls;
        delete lightweight.bankTransferReceiptUrl;
        const cashDocRef = await addDoc(collection(db, "cash_payments"), cleanPayload(lightweight));
        createdCashPaymentId = cashDocRef.id;
      }

      // Prepend new payment to local cache so it appears immediately upon navigation
      if (typeof window !== "undefined" && createdCashPaymentId) {
        try {
          const rawCache = localStorage.getItem('cached_detailed_payments');
          const cachedList = rawCache ? JSON.parse(rawCache) : [];
          const newPaymentForCache = {
            ...cleanedPaymentRecord,
            id: createdCashPaymentId,
            createdAt: new Date().toISOString(),
          };
          const updatedCache = [newPaymentForCache, ...cachedList.filter((p: any) => p.id !== createdCashPaymentId)].slice(0, 100);
          localStorage.setItem('cached_detailed_payments', JSON.stringify(updatedCache));
        } catch (cacheErr) {
          console.warn("Could not cache new payment locally:", cacheErr);
        }
      }

      // Auto sync products to master DB if items present
      if (finalItems && finalItems.length > 0) {
        syncProductsToMaster(finalItems, paymentDate || new Date().toISOString().split("T")[0], selectedCreditForPayment.companyName).catch(() => {});
      }

      // Notify financials sync across all views and tabs
      notifyFinancialsUpdated(targetStoreId);

      // Auto open print dialog immediately for the dual-sheet voucher
      const createdPaymentForPrint = {
        ...cleanedPaymentRecord,
        id: createdCashPaymentId,
        date: paymentDate || new Date().toISOString().split("T")[0],
      };
      handlePrintPaymentReceipt(selectedCreditForPayment, createdPaymentForPrint);

      // Trigger Skeuomorphic effects
      setIsCoinDropping(true);
      setTimeout(() => {
        setIsCoinDropping(false);
        setIsReceiptPrinting(true);
        setTimeout(() => setIsReceiptPrinting(false), 3000);
      }, 1500);

      // Dismiss loading toast and show professional success with redirect info
      toast.success(
        hasReturn
          ? (isAr ? "تم تسجيل سداد الدين وخصم المرتجع بنجاح! جاري الانتقال إلى المدفوعات..." : "Payment & Return settled successfully! Redirecting to payments...")
          : (newStatus === "paid" 
              ? (isAr ? "تم سداد الدين بالكامل! جاري الانتقال إلى المدفوعات..." : "Credit fully paid! Redirecting to payments...") 
              : (isAr ? "تم تسجيل الدفعة بنجاح! جاري الانتقال إلى المدفوعات..." : "Payment recorded successfully! Redirecting to payments...")), 
        { id: saveToastId, duration: 3000 }
      );
      
      setShowPaymentModal(false);
      setSelectedCreditForPayment(null);

      // Step F: Refresh data in background without blocking or throwing
      fetchCredits().catch(e => console.warn("Background fetch credits failed:", e));

      // Step G: Smooth, professional auto-navigation to the Payments tab
      const targetMonth = (paymentDate || new Date().toISOString().split("T")[0]).slice(0, 7);
      setTimeout(() => {
        router.push(`/financials/inputs/payments?month=${targetMonth}&highlight=${createdCashPaymentId}`);
      }, 700);

      // Refresh history if expanded
      if (expandedCredits[selectedCreditForPayment.id]) {
        try {
          const [cpSnap, cashSnap] = await Promise.all([
            getDocs(query(collection(db, "credit_payments"), where("creditId", "==", selectedCreditForPayment.id))),
            getDocs(query(collection(db, "cash_payments"), where("creditId", "==", selectedCreditForPayment.id)))
          ]);
          const combined: any[] = [];
          const seen = new Set<string>();
          [...cashSnap.docs, ...cpSnap.docs].forEach(d => {
            const data = d.data();
            const dDate = data.date || "";
            const dAmt = Math.round(Number(data.amount || data.total || 0));
            const sig = `${dDate}_${dAmt}`;
            if (!seen.has(sig)) {
              seen.add(sig);
              combined.push({ id: d.id, ...data });
            }
          });
          setCreditHistories(prev => ({ ...prev, [selectedCreditForPayment.id]: combined }));
        } catch (hErr) {
          console.warn("Could not refresh credit history:", hErr);
        }
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(
        isAr ? `فشل تسجيل السداد: ${error.message || "خطأ غير متوقع"}` : `Failed to process payment: ${error.message || "Unexpected error"}`,
        { id: saveToastId }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPdf = (credit: Credit) => {
    setSelectedCreditForPrint(credit);
    setIsPrinting(true);
  };

  // useEffect: when isPrinting becomes true and the print wrapper is in the DOM, clone it into an iframe and print
  useEffect(() => {
    if (!isPrinting || !selectedCreditForPrint) return;

    let attempts = 0;
    const maxAttempts = 20; // 20 * 100ms = 2 seconds max wait

    const tryPrint = () => {
      attempts++;
      const wrapper = document.getElementById("single-credit-print-wrapper");
      if (!wrapper) {
        if (attempts < maxAttempts) {
          setTimeout(tryPrint, 100);
          return;
        }
        toast.error("Could not prepare credit receipt for printing.");
        setIsPrinting(false);
        return;
      }

      // Create or reuse a hidden iframe
      let iframe = document.getElementById("credit-print-iframe") as HTMLIFrameElement;
      if (iframe) iframe.remove();
      iframe = document.createElement("iframe");
      iframe.id = "credit-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const receiptHtml = wrapper.innerHTML;
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        toast.error("Could not open print window.");
        setIsPrinting(false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<title>Credit Receipt</title>
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>${receiptHtml}</body>
</html>`);
      iframeDoc.close();

      // Wait for iframe content to load, then print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          toast.success("Print dialog opened!");
        } catch (e) {
          console.error("Print failed:", e);
          toast.error("Print failed. Please try again.");
        }
        setIsPrinting(false);
      }, 400);
    };

    // Start polling for the wrapper to appear in DOM
    setTimeout(tryPrint, 100);
  }, [isPrinting, selectedCreditForPrint]);

  const handlePrintPaymentReceipt = (credit: Credit, payment: any) => {
    setSelectedPaymentForPrint({ credit, payment });
    setIsPrintingPayment(true);
  };

  // useEffect: print payment receipt voucher iframe
  useEffect(() => {
    if (!isPrintingPayment || !selectedPaymentForPrint) return;

    let attempts = 0;
    const maxAttempts = 20;

    const tryPrintPayment = () => {
      attempts++;
      const wrapper = document.getElementById("single-payment-print-wrapper");
      if (!wrapper) {
        if (attempts < maxAttempts) {
          setTimeout(tryPrintPayment, 100);
          return;
        }
        toast.error("Could not prepare payment receipt for printing.");
        setIsPrintingPayment(false);
        return;
      }

      let iframe = document.getElementById("payment-print-iframe") as HTMLIFrameElement;
      if (iframe) iframe.remove();
      iframe = document.createElement("iframe");
      iframe.id = "payment-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const receiptHtml = wrapper.innerHTML;
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        toast.error("Could not open print window.");
        setIsPrintingPayment(false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<title>Payment Receipt Voucher - ${selectedPaymentForPrint?.credit?.companyName || ''}</title>
<style>
@page {
  size: A4 portrait;
  margin: 0;
}
* {
  box-sizing: border-box;
}
html, body {
  margin: 0;
  padding: 0;
  background: white;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-page {
  width: 210mm !important;
  height: 297mm !important;
  max-height: 297mm !important;
  overflow: hidden !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  page-break-after: always !important;
  break-after: page !important;
  box-sizing: border-box !important;
}
.print-page:last-child {
  page-break-after: avoid !important;
  break-after: avoid !important;
}
</style>
</head>
<body>${receiptHtml}</body>
</html>`);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          toast.success("Payment receipt print dialog opened!");
        } catch (e) {
          console.error("Print payment receipt failed:", e);
          toast.error("Print failed. Please try again.");
        }
        setIsPrintingPayment(false);
      }, 400);
    };

    setTimeout(tryPrintPayment, 150);
  }, [isPrintingPayment, selectedPaymentForPrint]);

  const generateBulkPDF = async () => {
    if (selectedBulkItems.size === 0) return;
    setIsGeneratingBulkPDF(true);
    
    // Gather all selected credits
    const creditsToPrint = filteredCredits.filter(c => selectedBulkItems.has(c.id));
    setBulkCreditsForPrint(creditsToPrint);
    
    // Give React a moment to render the hidden bulk layout
    setTimeout(async () => {
      const wrapper = document.getElementById("bulk-credit-print-wrapper");
      if (wrapper) {
        wrapper.style.left = "0";
        wrapper.style.top = "0";
      }
      try {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        
        // Render Cover Page
        const coverPage = document.getElementById("pdf-bulk-cover-credits");
        if (coverPage) {
          const canvas = await html2canvas(coverPage, { scale: 2, useCORS: true, logging: false });
          const imgData = canvas.toDataURL("image/png");
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        }
        
        // Render each credit
        for (let i = 0; i < creditsToPrint.length; i++) {
          const c = creditsToPrint[i];
          const pageId = `pdf-bulk-credit-${c.id}`;
          const page1 = document.getElementById(pageId);
          if (page1) {
            const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, logging: false });
            const imgData1 = canvas1.toDataURL("image/png");
            const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
            pdf.addPage();
            pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
          }
          
          // Render invoices for this credit
          const invoiceUrls = c.invoiceUrls && c.invoiceUrls.length > 0 ? c.invoiceUrls : (c.invoiceUrl ? [c.invoiceUrl] : []);
          for (let j = 0; j < invoiceUrls.length; j++) {
            const invPage = document.getElementById(`pdf-bulk-credit-${c.id}-invoice-${j}`);
            if (invPage) {
              const canvasInv = await html2canvas(invPage, { scale: 2, useCORS: true, logging: false });
              const imgDataInv = canvasInv.toDataURL("image/png");
              const pdfHeightInv = (canvasInv.height * pdfWidth) / canvasInv.width;
              pdf.addPage();
              pdf.addImage(imgDataInv, "PNG", 0, 0, pdfWidth, pdfHeightInv);
            }
          }
        }
        
        pdf.save(`Bulk_Credits_Report_${new Date().getTime()}.pdf`);
        toast.success("Bulk PDF generated successfully!");
      } catch (err) {
        toast.error("Error generating bulk PDF.");
        console.error(err);
      } finally {
        if (wrapper) {
          wrapper.style.left = "-9999px";
        }
        setIsGeneratingBulkPDF(false);
        setBulkCreditsForPrint([]); // clear
        setSelectedBulkItems(new Set()); // clear selection
      }
    }, 1000); // 1000ms for react to render
  };

  // Derived Stats
  const stats = useMemo(() => {
    let outstanding = 0;
    let pending = 0;
    let partial = 0;
    let collected = 0;
    let overdue = 0;
    let salesOnly = 0;

    let outstandingCount = 0;
    let pendingCount = 0;
    let partialCount = 0;
    let collectedCount = 0;
    let overdueCount = 0;
    let salesOnlyCount = 0;

    credits.forEach(c => {
      const total = c.amountDue + c.tax;
      const remaining = total - c.paidAmount;

      if (c.onSalesOnly) {
        salesOnly += remaining;
        salesOnlyCount++;
        return; // Skip other stats if sales only
      }

      if (c.status === "paid") {
        collected += c.paidAmount;
        collectedCount++;
      } else if (c.status === "partial") {
        partial += remaining;
        partialCount++;
        outstanding += remaining;
        outstandingCount++;
      } else if (c.status === "overdue") {
        overdue += remaining;
        overdueCount++;
        outstanding += remaining;
        outstandingCount++;
      } else if (c.status === "pending") {
        pending += remaining;
        pendingCount++;
      } else {
        outstanding += remaining;
        outstandingCount++;
      }
    });

    return {
      outstanding: { amount: outstanding, count: outstandingCount },
      pending: { amount: pending, count: pendingCount },
      partial: { amount: partial, count: partialCount },
      collected: { amount: collected, count: collectedCount },
      overdue: { amount: overdue, count: overdueCount },
      salesOnly: { amount: salesOnly, count: salesOnlyCount }
    };
  }, [credits]);

  const filteredCredits = credits.filter(c => {
    const matchesSearch = c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== "all") {
      if (statusFilter === "salesOnly") matchesStatus = c.onSalesOnly;
      else matchesStatus = c.status === statusFilter && !c.onSalesOnly;
    }

    return matchesSearch && matchesStatus;
  });

  // Derived Dashboard Data
  const dashboardData = useMemo(() => {
    try {
      let age0_15 = 0;
      let age16_30 = 0;
      let age30Plus = 0;
      const waterfallMap: Record<string, number> = {};
      const now = new Date();

      credits.forEach(c => {
        try {
          if (!c || c.status === "paid" || c.onSalesOnly) return;
          const remaining = (Number(c.amountDue || 0) + Number(c.tax || 0)) - Number(c.paidAmount || 0);
          if (remaining <= 0) return;

          let createdTime = now.getTime();
          try {
            if (c.createdAt?.toDate && typeof c.createdAt.toDate === "function") {
              const dt = c.createdAt.toDate();
              if (dt && !isNaN(dt.getTime())) createdTime = dt.getTime();
            } else if (c.createdAt) {
              const dt = new Date(c.createdAt);
              if (dt && !isNaN(dt.getTime())) createdTime = dt.getTime();
            }
          } catch (_e) {}

          const diffTime = Math.abs(now.getTime() - createdTime);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 15) age0_15 += remaining;
          else if (diffDays <= 30) age16_30 += remaining;
          else age30Plus += remaining;

          const expectedDateStr = safeToIsoDate(c.collectionDate || (createdTime + 30 * 24 * 60 * 60 * 1000));
          if (!waterfallMap[expectedDateStr]) waterfallMap[expectedDateStr] = 0;
          waterfallMap[expectedDateStr] += remaining;
        } catch (_creditErr) {}
      });

      const agingChartData = [
        { name: "0-15 Days", amount: age0_15, color: "#10b981" },
        { name: "16-30 Days", amount: age16_30, color: "#eab308" },
        { name: "30+ Days", amount: age30Plus, color: "#ef4444" }
      ];

      const waterfallChartData = Object.keys(waterfallMap).sort().slice(0, 30).map(date => {
        return { date, amount: waterfallMap[date] };
      });

      return { agingChartData, waterfallChartData };
    } catch (_dashboardErr) {
      return {
        agingChartData: [
          { name: "0-15 Days", amount: 0, color: "#10b981" },
          { name: "16-30 Days", amount: 0, color: "#eab308" },
          { name: "30+ Days", amount: 0, color: "#ef4444" }
        ],
        waterfallChartData: []
      };
    }
  }, [credits]);

  // Smart Simulator Logic
  const simulatorResults = useMemo(() => {
    try {
      if (!simulatorCash || isNaN(Number(simulatorCash))) return [];
      let cash = Number(simulatorCash);
      if (cash <= 0) return [];
      
      const openInvoices = credits.filter(c => c && c.status !== "paid" && !c.onSalesOnly).map(c => {
        const remaining = (Number(c.amountDue || 0) + Number(c.tax || 0)) - Number(c.paidAmount || 0);
        let created = Date.now();
        try {
          if (c.createdAt?.toDate && typeof c.createdAt.toDate === "function") {
            const dt = c.createdAt.toDate();
            if (dt && !isNaN(dt.getTime())) created = dt.getTime();
          } else if (c.createdAt) {
            const dt = new Date(c.createdAt);
            if (dt && !isNaN(dt.getTime())) created = dt.getTime();
          }
        } catch (_e) {}
        return { ...c, remaining, created };
      }).sort((a, b) => a.created - b.created);

      const plan = [];
      for (const inv of openInvoices) {
        if (cash <= 0) break;
        if (cash >= inv.remaining) {
          plan.push({ credit: inv, payAmount: inv.remaining, type: "Full" });
          cash -= inv.remaining;
        } else {
          plan.push({ credit: inv, payAmount: cash, type: "Partial" });
          cash = 0;
        }
      }
      return plan;
    } catch (_simErr) {
      return [];
    }
  }, [simulatorCash, credits]);

  const selectedSupplierData = useMemo(() => {
    try {
      if (!selectedSupplierProfile) return null;
      const supplierCredits = credits.filter(c => c && c.companyName === selectedSupplierProfile);
      let totalVolume = 0;
      let totalDebt = 0;
      let totalDaysToPay = 0;
      let paidCount = 0;

      supplierCredits.forEach(c => {
        try {
          const total = Number(c.amountDue || 0) + Number(c.tax || 0);
          totalVolume += total;
          totalDebt += total - Number(c.paidAmount || 0);
          
          if (c.status === 'paid' && c.payments && Array.isArray(c.payments) && c.payments.length > 0) {
            let created = Date.now();
            try {
              if (c.createdAt?.toDate && typeof c.createdAt.toDate === "function") {
                const dt = c.createdAt.toDate();
                if (dt && !isNaN(dt.getTime())) created = dt.getTime();
              } else if (c.createdAt) {
                const dt = new Date(c.createdAt);
                if (dt && !isNaN(dt.getTime())) created = dt.getTime();
              }
            } catch (_e) {}

            const lastPayment = c.payments[c.payments.length - 1];
            let paidDate = Date.now();
            try {
              if (lastPayment?.date) {
                const dt = new Date(lastPayment.date);
                if (!isNaN(dt.getTime())) paidDate = dt.getTime();
              }
            } catch (_e) {}

            totalDaysToPay += Math.max(0, (paidDate - created) / (1000 * 60 * 60 * 24));
            paidCount++;
          }
        } catch (_supErr) {}
      });

      const avgDaysToPay = paidCount > 0 ? totalDaysToPay / paidCount : 30;
      const trustScore = Math.max(0, 100 - (avgDaysToPay > 30 ? (avgDaysToPay - 30) * 2 : 0) - (totalDebt > totalVolume * 0.5 ? 20 : 0));

      return {
        name: selectedSupplierProfile,
        totalVolume,
        totalDebt,
        avgDaysToPay: Math.round(avgDaysToPay),
        trustScore: Math.round(trustScore),
        radarData: [
          { subject: 'Speed', A: Math.max(0, 100 - avgDaysToPay), fullMark: 100 },
          { subject: 'Volume', A: Math.min(100, (totalVolume / 100000) * 100), fullMark: 100 },
          { subject: 'Trust', A: trustScore, fullMark: 100 },
          { subject: 'Health', A: 100 - ((totalDebt / (totalVolume || 1)) * 100), fullMark: 100 },
        ]
      };
    } catch (_supDataErr) {
      return null;
    }
  }, [selectedSupplierProfile, credits]);

  // Reactive Company-by-Company Liabilities & Owed Ledger Calculations
  const companySummaries = useMemo(() => {
    const map = new Map<string, {
      companyName: string;
      totalInvoicesCount: number;
      totalInvoiced: number;
      totalPaid: number;
      totalRemainingDue: number;
      overdueInvoicesCount: number;
      overdueAmount: number;
      partialInvoicesCount: number;
      partialPaidAmount: number;
      partialRemainingAmount: number;
      fullyPaidCount: number;
      fullyPaidAmount: number;
      openInvoicesCount: number;
      openRemainingAmount: number;
      invoices: Credit[];
    }>();

    const today = new Date().toISOString().substring(0, 10);

    credits.forEach((credit: Credit) => {
      if (credit.onSalesOnly) return;
      const rawComp = (credit.companyName || "Unknown Company").trim();
      if (!rawComp) return;

      if (!map.has(rawComp)) {
        map.set(rawComp, {
          companyName: rawComp,
          totalInvoicesCount: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          totalRemainingDue: 0,
          overdueInvoicesCount: 0,
          overdueAmount: 0,
          partialInvoicesCount: 0,
          partialPaidAmount: 0,
          partialRemainingAmount: 0,
          fullyPaidCount: 0,
          fullyPaidAmount: 0,
          openInvoicesCount: 0,
          openRemainingAmount: 0,
          invoices: []
        });
      }

      const item = map.get(rawComp)!;
      item.invoices.push(credit);
      item.totalInvoicesCount += 1;

      const gross = Number(credit.amountDue || 0) + Number(credit.tax || 0);
      const paid = Number(credit.paidAmount || 0);
      const remaining = Math.max(0, gross - paid);

      item.totalInvoiced += gross;
      item.totalPaid += paid;
      item.totalRemainingDue += remaining;

      const colDate = credit.collectionDate ? credit.collectionDate.substring(0, 10) : "";
      const isOverdue = remaining > 0 && colDate && colDate < today && credit.status !== "paid";

      if (isOverdue) {
        item.overdueInvoicesCount += 1;
        item.overdueAmount += remaining;
      }

      if (credit.status === "paid" || remaining === 0) {
        item.fullyPaidCount += 1;
        item.fullyPaidAmount += paid;
      } else if (paid > 0 && remaining > 0) {
        item.partialInvoicesCount += 1;
        item.partialPaidAmount += paid;
        item.partialRemainingAmount += remaining;
      } else {
        item.openInvoicesCount += 1;
        item.openRemainingAmount += remaining;
      }
    });

    // Sort invoices within each company: newest / overdue first
    map.forEach(item => {
      item.invoices.sort((a, b) => {
        const aDate = a.collectionDate || a.date || "";
        const bDate = b.collectionDate || b.date || "";
        return bDate.localeCompare(aDate);
      });
    });

    return Array.from(map.values());
  }, [credits]);

  const companyOverallStats = useMemo(() => {
    let totalGross = 0;
    let totalRemainingDue = 0;
    let totalOverdue = 0;
    let totalPaid = 0;
    let totalPartialPaid = 0;
    let activeCreditorsCount = 0;

    companySummaries.forEach(c => {
      totalGross += c.totalInvoiced;
      totalRemainingDue += c.totalRemainingDue;
      totalOverdue += c.overdueAmount;
      totalPaid += c.totalPaid;
      totalPartialPaid += c.partialPaidAmount;
      if (c.totalRemainingDue > 0) {
        activeCreditorsCount += 1;
      }
    });

    return {
      totalGross,
      totalRemainingDue,
      totalOverdue,
      totalPaid,
      totalPartialPaid,
      activeCreditorsCount,
      totalCompaniesCount: companySummaries.length
    };
  }, [companySummaries]);

  const filteredCompanies = useMemo(() => {
    let list = [...companySummaries];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => 
        c.companyName.toLowerCase().includes(q) || 
        c.invoices.some(inv => 
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) || 
          (inv.poNumber && inv.poNumber.toLowerCase().includes(q))
        )
      );
    }

    if (companySortBy === "owed") {
      list.sort((a, b) => b.totalRemainingDue - a.totalRemainingDue);
    } else if (companySortBy === "overdue") {
      list.sort((a, b) => b.overdueAmount - a.overdueAmount);
    } else if (companySortBy === "name") {
      list.sort((a, b) => a.companyName.localeCompare(b.companyName));
    } else if (companySortBy === "invoices") {
      list.sort((a, b) => b.totalInvoicesCount - a.totalInvoicesCount);
    }

    return list;
  }, [companySummaries, searchTerm, companySortBy]);


  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const creditId = active.id as string;
    const newStatus = over.id as string;
    
    const credit = credits.find(c => c.id === creditId);
    if (!credit) return;
    
    if (credit.status !== newStatus && ['open', 'pending', 'paid'].includes(newStatus)) {
      const totalDue = (Number(credit.amountDue) || 0) + (Number(credit.tax) || 0);
      const newPaidAmount = newStatus === "paid" ? totalDue : (newStatus === "open" && credit.paidAmount === 0 ? 0 : credit.paidAmount);
      
      setCredits(prev => prev.map(c => c.id === creditId ? { ...c, status: newStatus as any, paidAmount: newPaidAmount } : c));
      try {
        const updatePayload: any = { 
          status: newStatus,
          updatedAt: serverTimestamp()
        };
        if (newStatus === "paid") {
          updatePayload.paidAmount = totalDue;
        }
        await updateDoc(doc(db, "credits", creditId), updatePayload);
        toast.success(isAr ? `تم تحديث حالة الفاتورة إلى ${newStatus === 'paid' ? 'مدفوع' : newStatus}` : `Invoice moved to ${newStatus}`);
      } catch (e: any) {
        console.error("Failed to move invoice:", e);
        toast.error(isAr ? `فشل نقل الفاتورة: ${e.message || "خطأ غير متوقع"}` : "Failed to move invoice");
        fetchCredits().catch(() => {});
      }
    }
  };

  if (loading && credits.length === 0) {
    return <div className="flex h-screen items-center justify-center bg-[#09090B]"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-[#09090B] text-slate-100 p-1 sm:p-4 md:p-8 font-sans print:hidden pb-28 relative">
        {isSyncing && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16161d]/90 border border-indigo-500/30 text-indigo-400 text-xs font-bold shadow-2xl backdrop-blur-md animate-pulse pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>{isAr ? "مزامنة لحظية..." : "Live cloud sync..."}</span>
          </div>
        )}
        <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-8">
          
          {/* Header & Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {isAr ? "إدارة الآجل والديون" : "Credits Management"}
              </h1>
              <p className="text-sm text-slate-400 font-medium mt-1">
                {isAr ? "متابعة وإدارة وتحصيل مديونيات وآجل العملاء والفرع." : "Track, manage, and collect outstanding corporate credits."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={async () => {
                  setIsRefreshing(true);
                  await fetchCredits();
                  setIsRefreshing(false);
                  toast.success(isAr ? "تم تحديث البيانات بنجاح!" : "Credits refreshed!");
                }}
                disabled={isRefreshing}
                className="flex items-center gap-2 bg-slate-800/60 backdrop-blur-md border border-slate-700/60 text-slate-300 px-3.5 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-slate-700 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                title={isAr ? "تحديث فوري" : "Fast Refresh"}
              >
                <RefreshCw size={16} className={isRefreshing ? "animate-spin text-indigo-400" : ""} />
                <span className="hidden sm:inline">{isAr ? "تحديث" : "Refresh"}</span>
              </button>
              <button className="flex items-center gap-2 bg-slate-800/60 backdrop-blur-md border border-slate-700/60 text-slate-300 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-slate-700 hover:border-slate-600 transition-all">
                <FileDown size={18} /> {isAr ? "تصدير" : "Export"}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <Plus size={20} /> {isAr ? "إضافة دين جديد" : "Add Credit"}
              </button>
            </div>
          </div>

          {/* ADVANCED DASHBOARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Credit Aging Dashboard */}
            <div className="bg-[#0B1121] border border-slate-800 p-6 rounded-3xl shadow-lg lg:col-span-1">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2 mb-6">
                <AlertCircle size={20} className="text-rose-500" />
                {isAr ? "أعمار الديون والآجل" : "Credit Aging"}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.agingChartData} margin={{top:10, right:10, left:-20, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#64748b'}} tickFormatter={(val) => `£${(val/1000).toFixed(0)}k`} />
                    <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor:'#1e293b', color:'#e2e8f0'}} />
                    <Bar dataKey="amount" radius={[6,6,6,6]}>
                      {dashboardData.agingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Debt Waterfall */}
            <div className="bg-[#0B1121] border border-slate-800 p-6 rounded-3xl shadow-lg lg:col-span-1">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2 mb-6">
                <Calendar size={20} className="text-sky-500" />
                30-Day Debt Waterfall
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.waterfallChartData} margin={{top:10, right:10, left:-20, bottom:0}}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(val) => val.split('-').slice(1).join('/')} tick={{fontSize:12, fill:'#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#64748b'}} tickFormatter={(val) => `£${(val/1000).toFixed(0)}k`} />
                    <RechartsTooltip cursor={{stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4'}} contentStyle={{borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor:'#1e293b', color:'#e2e8f0'}} />
                    <Area type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Smart Payment Simulator */}
            <div className="bg-gradient-to-br from-slate-900 to-[#0B1121] border border-slate-800 p-6 rounded-3xl shadow-lg lg:col-span-1 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Banknote size={100} /></div>
              <h3 className="text-lg font-black text-indigo-300 flex items-center gap-2 mb-2 relative z-10">
                <Banknote size={20} /> Smart Settle Simulator
              </h3>
              <p className="text-sm text-slate-400 mb-4 relative z-10">Type your available cash. We'll suggest the perfect payment plan.</p>
              
              <div className="relative z-10 flex gap-2 mb-4">
                <input 
                  type="number"
                  placeholder="e.g. 20000"
                  value={simulatorCash}
                  onChange={(e) => setSimulatorCash(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2 relative z-10 max-h-40">
                {simulatorResults.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm mt-8">Awaiting cash input...</div>
                ) : (
                  simulatorResults.map((res, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                      <div>
                        <p className="text-xs font-bold text-white capitalize">{res.credit.companyName}</p>
                        <p className="text-[10px] text-slate-400">{res.type} Payment</p>
                      </div>
                      <p className="text-sm font-black text-indigo-400">EGP {res.payAmount.toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>

          {/* Premium Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-orange-950/40 to-slate-900 border border-orange-800/30 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertCircle size={48} className="text-orange-500" /></div>
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <AlertCircle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Outstanding</p>
              </div>
              <div className="flex items-center gap-1 relative z-10">
                <span className="text-xl font-bold text-white tracking-tight mt-1">EGP</span>
                <AnalogOdometer value={stats.outstanding.amount} />
              </div>
              <p className="text-xs font-semibold text-orange-500/70 mt-1 relative z-10">{stats.outstanding.count} open invoices</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/30 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={48} className="text-blue-400" /></div>
              <div className="flex items-center gap-2 text-blue-400 mb-3">
                <Clock size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Pending</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight relative z-10">EGP {stats.pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-blue-400/70 mt-1 relative z-10">{stats.pending.count} awaiting clear</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-800/30 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><PieChart size={48} className="text-amber-400" /></div>
              <div className="flex items-center gap-2 text-amber-400 mb-3">
                <PieChart size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Partial</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight relative z-10">EGP {stats.partial.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-amber-400/70 mt-1 relative z-10">{stats.partial.count} partially paid</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/30 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={48} className="text-emerald-400" /></div>
              <div className="flex items-center gap-2 text-emerald-400 mb-3">
                <CheckCircle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Collected</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight relative z-10">EGP {stats.collected.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-emerald-400/70 mt-1 relative z-10">{stats.collected.count} fully paid</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-red-950/40 to-slate-900 border border-red-800/30 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle size={48} className="text-red-400" /></div>
              <div className="flex items-center gap-2 text-red-400 mb-3">
                <AlertTriangle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Overdue</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight relative z-10">EGP {stats.overdue.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-red-400/70 mt-1 relative z-10">{stats.overdue.count} past due date</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-800/30 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Building size={48} className="text-violet-400" /></div>
              <div className="flex items-center gap-2 text-violet-400 mb-3">
                <Building size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Sales Only</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight relative z-10">EGP {stats.salesOnly.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-violet-400/70 mt-1 relative z-10">{stats.salesOnly.count} active accounts</p>
            </motion.div>
          </div>

          {/* Unified Command Bar (Filters) */}
          <div className="bg-[#0B1121] border border-slate-800 p-2.5 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 items-center">
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setViewMode('list')} className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${viewMode === 'list' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-400 hover:text-slate-200'}`}>List</button>
              <button onClick={() => setViewMode('board')} className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${viewMode === 'board' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-400 hover:text-slate-200'}`}>Board</button>
              <button onClick={() => setViewMode('companies')} className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${viewMode === 'companies' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <Building2 size={15} />
                <span>Companies Owed (مديونيات الشركات)</span>
              </button>
            </div>

            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <input
                type="text"
                placeholder="Search company or invoice..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-950/80 focus:bg-slate-950 border border-slate-800 focus:border-indigo-500 transition-colors outline-none text-white placeholder:text-slate-500 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="w-full md:w-64 px-4 py-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 focus:bg-slate-950 border border-slate-800 transition-colors outline-none text-slate-200 font-bold cursor-pointer appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">⚡ All Statuses</option>
              <option value="open">Open Credits</option>
              <option value="pending">Pending Payments</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Fully Paid</option>
              <option value="overdue">⚠️ Overdue</option>
              <option value="salesOnly">🏢 Sales Only Accounts</option>
            </select>
          </div>

        {/* Credits Data View */}
        {selectedBulkItems.size > 0 && (
          <div className="bg-blue-950/40 border border-blue-800/60 rounded-2xl p-4 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4 mb-4">
            <div className="flex items-center gap-3 text-blue-300">
              <div className="w-8 h-8 rounded-full bg-blue-900/60 border border-blue-700 flex items-center justify-center font-bold">
                {selectedBulkItems.size}
              </div>
              <span className="font-bold text-sm">Credits Selected</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedBulkItems(new Set())}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={generateBulkPDF}
                disabled={isGeneratingBulkPDF}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {isGeneratingBulkPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer size={16} />}
                {isGeneratingBulkPDF ? 'Generating...' : 'Bulk Print PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Mobile Summary Cards & Status Filters (Strictly md:hidden) */}
        <div className="md:hidden space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-[#0B1121] border border-orange-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Outstanding</p>
              <p className="text-sm font-black font-mono text-orange-400 mt-0.5">
                EGP {stats.outstanding.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B1121] border border-amber-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Partial</p>
              <p className="text-sm font-black font-mono text-amber-400 mt-0.5">
                EGP {stats.partial.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B1121] border border-rose-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Overdue</p>
              <p className="text-sm font-black font-mono text-rose-400 mt-0.5">
                EGP {stats.overdue.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        {viewMode === 'list' && (
          <div className="flex items-center gap-3 px-2 mb-2">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded text-blue-600 cursor-pointer"
              checked={filteredCredits.length > 0 && selectedBulkItems.size === filteredCredits.length}
              onChange={handleSelectAllBulkItems}
            />
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider">
              ALL RECORDS ({filteredCredits.length})
            </h2>
          </div>
        )}

        {/* Data List for Mobile Portrait, Landscape & Desktop */}
        <div>
          {viewMode === 'list' ? (
            <div className="space-y-3 sm:space-y-4">
            <AnimatePresence>
              {filteredCredits.map((credit, idx) => {
              const isExpanded = expandedCredits[credit.id];
              const totalDue = credit.amountDue + credit.tax;
              const remaining = totalDue - credit.paidAmount;

              // Generate Company Initials for Avatar
              const initials = credit.companyName.substring(0, 2).toUpperCase();
              const colors = [
                'bg-indigo-950/80 text-indigo-300 border-indigo-700/50', 
                'bg-rose-950/80 text-rose-300 border-rose-700/50', 
                'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
                'bg-amber-950/80 text-amber-300 border-amber-700/50',
                'bg-sky-950/80 text-sky-300 border-sky-700/50'
              ];
              const avatarColor = colors[credit.companyName.charCodeAt(0) % colors.length];

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  key={credit.id} 
                  className={`bg-[#0B1121] border rounded-2xl shadow-lg hover:border-slate-700 transition-all overflow-hidden group ${selectedBulkItems.has(credit.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-800'}`}
                >
                  {/* Row Summary */}
                  <div className="p-3.5 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 relative">
                    
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                      <input 
                        type="checkbox" 
                        checked={selectedBulkItems.has(credit.id)}
                        onChange={() => handleSelectBulkItem(credit.id)}
                        className="w-5 h-5 rounded text-indigo-600 cursor-pointer mr-1 flex-shrink-0"
                      />
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center font-black text-sm sm:text-lg tracking-tight flex-shrink-0 ${avatarColor}`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <button onClick={() => setSelectedSupplierProfile(credit.companyName)} className="text-base sm:text-lg font-bold text-white uppercase tracking-tight text-left hover:text-indigo-400 transition-colors underline decoration-dotted decoration-indigo-500/50 underline-offset-4 truncate max-w-[200px] sm:max-w-none">
                            {credit.companyName}
                          </button>
                          
                          {/* Modern Badges */}
                          {credit.status === 'paid' && <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle size={12}/> Paid</span>}
                          {credit.status === 'pending' && <span className="bg-blue-950/60 text-blue-400 border border-blue-800/60 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock size={12}/> Pending</span>}
                          {credit.status === 'partial' && <span className="bg-amber-950/60 text-amber-400 border border-amber-800/60 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><PieChart size={12}/> Partial</span>}
                          {credit.status === 'overdue' && <span className="bg-rose-950/60 text-rose-400 border border-rose-800/60 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={12}/> Overdue</span>}
                          {credit.status === 'open' && <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertCircle size={12}/> Open</span>}

                          {credit.onSalesOnly && (
                            <span className="bg-violet-950/60 text-violet-400 border border-violet-800/60 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Building size={12}/> Sales Only</span>
                          )}

                          {credit.isEdited && (
                            <span 
                              className="bg-amber-950/50 text-amber-400 border border-amber-800/60 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-900/50 transition-colors"
                              title={credit.editHistory && credit.editHistory.length > 0 ? `Edited on ${new Date(credit.lastEditedAt!).toLocaleDateString()}:\n${credit.editHistory[credit.editHistory.length - 1].summary}` : "Edited"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCreditForView(credit);
                              }}
                            >
                              <Pencil size={11} className="shrink-0" /> {isAr ? "مُعدّل" : "Edited"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-slate-400 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1"><FileText size={13} className="text-slate-500" /> Inv: {credit.invoiceNumber}</span>
                          {credit.poNumber && <><span className="text-slate-600">•</span> <span>PO: {credit.poNumber}</span></>} 
                          <span className="text-slate-600">•</span> <span>Due: {credit.collectionDate}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Financials & Actions */}
                    <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-800/80 pt-2.5 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-xl sm:text-2xl font-black text-rose-500 tracking-tight font-mono">
                          <span className="text-xs sm:text-sm font-medium text-slate-400 mr-1">EGP</span>
                          {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-slate-400 flex items-center justify-start md:justify-end gap-1">
                          Paid: <span className="text-emerald-400 font-bold">{credit.paidAmount.toLocaleString()}</span>
                        </p>
                      </div>
                      
                      {/* Action Dropdown / Buttons */}
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button onClick={() => setSelectedCreditForView(credit)} className="p-2 sm:p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer" title="View Statement">
                          <Eye size={19} />
                        </button>
                        <button onClick={() => handlePrintPdf(credit)} disabled={isPrinting} className="p-2 sm:p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-xl transition-colors disabled:opacity-50 cursor-pointer" title="Print Voucher">
                          <Printer size={19} />
                        </button>
                        {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                          <>
                            <button
                              onClick={() => handleOpenEditCredit(credit)}
                              className="p-2 sm:p-2.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
                              title={isAr ? "تعديل الفاتورة (خاص بالإدارة)" : "Edit Credit (Admin Only)"}
                            >
                              <Pencil size={19} />
                            </button>
                            <button onClick={() => handleDeleteCredit(credit.id)} className="p-2 sm:p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer" title={isAr ? "حذف الدين" : "Delete Credit"}>
                              <Trash2 size={19} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleExpand(credit.id)}
                          className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/50' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                          title="Toggle Details"
                        >
                          {isExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details Area */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-800 bg-[#070C18]"
                      >
                        <div className="p-5 md:p-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-[#0B1121] p-4 rounded-xl border border-slate-800 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                              <p className="font-black text-white">EGP {credit.amountDue.toLocaleString()}</p>
                            </div>
                            <div className="bg-[#0B1121] p-4 rounded-xl border border-slate-800 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax</p>
                              <p className="font-black text-white">EGP {credit.tax.toLocaleString()}</p>
                            </div>
                            <div className="bg-rose-950/30 p-4 rounded-xl border border-rose-900/50 shadow-sm">
                              <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">Remaining</p>
                              <p className="font-black text-rose-400">EGP {remaining.toLocaleString()}</p>
                            </div>
                            <div className="bg-[#0B1121] p-4 rounded-xl border border-slate-800 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</p>
                              <p className="font-bold text-white flex items-center gap-2">
                                {credit.onSalesOnly ? <><Building size={14} className="text-violet-400"/> Sales Only</> : <><CreditCard size={14} className="text-indigo-400"/> Standard</>}
                              </p>
                            </div>
                          </div>

                          {/* Payment History Section */}
                          <div className="flex justify-between items-center border-t border-slate-800 pt-6 mb-4">
                            <h4 className="font-bold text-white flex items-center gap-2">
                              <Banknote className="text-emerald-400"/> {isAr ? "سجل المدفوعات والتسويات" : "Payment History"}
                              {creditHistories[credit.id] && creditHistories[credit.id].length > 0 && (
                                <span className="text-xs font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
                                  {creditHistories[credit.id].length}
                                </span>
                              )}
                            </h4>
                            {credit.status !== "paid" && (
                              <button
                                onClick={() => handleOpenPaymentModal(credit)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Plus size={15} /> {isAr ? "تسجيل سداد" : "Record Payment"}
                              </button>
                            )}
                          </div>
                          
                          {loadingHistories[credit.id] ? (
                            <div className="flex justify-center items-center py-8 bg-[#0B1121] rounded-xl border border-slate-800">
                              <Loader2 className="animate-spin text-indigo-400 mr-2" size={20} />
                              <span className="text-xs text-slate-400 font-medium">{isAr ? "جاري تحميل سجل السداد والأصناف..." : "Loading payments & PO items..."}</span>
                            </div>
                          ) : creditHistories[credit.id] && creditHistories[credit.id].length > 0 ? (
                            <div className="space-y-2">
                              {creditHistories[credit.id].map((payment, idx) => {
                                const receiptImg = payment.bankTransferReceiptUrl || payment.receiptUrl;
                                return (
                                  <div key={payment.id || idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0B1121] p-3.5 rounded-xl border border-slate-800 shadow-sm gap-3 hover:border-slate-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                                        <CheckCircle size={18} />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-bold text-white font-mono tracking-tight text-base">
                                            EGP {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </p>
                                          {payment.hasReturn && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                              <RotateCcw size={10} />
                                              {isAr ? `خصم مرتجع: ${Number(payment.returnDeductionAmount || payment.returnDetails?.returnAmount || 0).toLocaleString()} ج.م` : `RTV: EGP ${Number(payment.returnDeductionAmount || payment.returnDetails?.returnAmount || 0).toLocaleString()}`}
                                            </span>
                                          )}
                                          {payment.grossAmount && Number(payment.grossAmount) > Number(payment.amount) && (
                                            <span className="text-[11px] text-slate-500 font-mono">
                                              ({isAr ? "إجمالي الدين المسدد:" : "Gross Settled:"} EGP {Number(payment.grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                          <Calendar size={12}/> <span>{payment.date || "Completed"}</span> 
                                          <span className="text-slate-600">•</span> 
                                          <span className="uppercase font-semibold text-slate-300">{payment.method || "CASH"}</span>
                                          {payment.createdBy && (
                                            <>
                                              <span className="text-slate-600">•</span>
                                              <span className="text-slate-500 font-mono text-[11px]">{payment.createdBy.split('@')[0]}</span>
                                            </>
                                          )}
                                          {payment.hasReturn && (payment.returnTransferOutNumber || payment.returnDetails?.transferOutNumber) && (
                                            <>
                                              <span className="text-slate-600">•</span>
                                              <span className="text-amber-400 font-mono text-[11px]">TR-{payment.returnTransferOutNumber || payment.returnDetails?.transferOutNumber}</span>
                                            </>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                      {receiptImg && (
                                        <button 
                                          onClick={() => setPreviewImage({ url: receiptImg, title: `Payment Receipt - Inv #${credit.invoiceNumber || ""}` })}
                                          className="text-xs font-bold px-3 py-1.5 bg-blue-950/60 text-blue-400 border border-blue-800/60 rounded-xl hover:bg-blue-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                                          title="View Receipt Image"
                                        >
                                          <FileText size={13}/> {isAr ? "عرض الإيصال" : "Receipt"}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handlePrintPaymentReceipt(credit, payment)}
                                        className="text-xs font-bold px-3 py-1.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 rounded-xl hover:bg-indigo-900/60 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                                        title={isAr ? "طباعة إيصال السداد الرسمي" : "Print Official Payment Voucher"}
                                      >
                                        <Printer size={13}/> {isAr ? "طباعة الإيصال" : "Print Receipt"}
                                      </button>
                                      {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && !payment.isSettlement && (
                                        <button
                                          onClick={() => handleDeleteCreditPayment(credit, payment)}
                                          className="text-xs font-bold p-1.5 bg-rose-950/40 text-rose-400 border border-rose-800/50 rounded-xl hover:bg-rose-900/50 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                                          title={isAr ? "حذف الدفعة" : "Delete Payment"}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                      <span className="text-xs font-bold px-2.5 py-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                                        <CheckCircle size={12}/> {isAr ? "مسدد" : "Paid"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-800/80 px-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "إجمالي المسدد" : "Total Paid"}</span>
                                <span className="text-base font-black text-emerald-400 tracking-tight font-mono">EGP {credit.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-[#0B1121] rounded-xl border border-dashed border-slate-800">
                              <p className="text-sm font-bold text-slate-500">{isAr ? "لا توجد مدفوعات مسجلة حتى الآن" : "No payments recorded yet"}</p>
                            </div>
                          )}

                          {/* PO Items & Image Area */}
                          <div className="border-t border-slate-800 pt-6 mt-6">
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-2">
                                <ImageIcon className="text-indigo-400" size={18} />
                                <h4 className="font-bold text-white text-base">
                                  {isAr ? "تفاصيل أمر الشراء والأصناف (PO Items)" : "Purchase Order Details"}
                                </h4>
                                {credit.poNumber && (
                                  <span className="text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-bold">
                                    PO: {credit.poNumber}
                                  </span>
                                )}
                              </div>
                              {(!creditPOItems[credit.id] || creditPOItems[credit.id].length === 0) && !credit.poImageUrl && (
                                <button
                                  onClick={() => setSelectedCreditForPoUpload(credit)}
                                  className="text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus size={14}/> {isAr ? "إرفاق PO / فاتورة" : "+ Add PO"}
                                </button>
                              )}
                            </div>

                            {/* PO Items Table */}
                            {creditPOItems[credit.id] && creditPOItems[credit.id].length > 0 && (
                              <div className="overflow-x-auto border border-slate-800 bg-[#0B1121] rounded-2xl mb-5 shadow-sm">
                                <table className="w-full text-sm text-left">
                                  <thead className="text-xs text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase font-bold tracking-wider">
                                    <tr>
                                      <th className="px-4 py-3">#</th>
                                      <th className="px-4 py-3">Barcode</th>
                                      <th className="px-4 py-3">Description / اسم الصنف</th>
                                      <th className="px-4 py-3 text-center">Qty</th>
                                      <th className="px-4 py-3 text-right">Unit Price</th>
                                      <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {creditPOItems[credit.id].map((item: any, idx: number) => (
                                      <tr key={idx} className="border-b border-slate-850/60 last:border-0 font-medium hover:bg-slate-900/40 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{item.barcode || "N/A"}</td>
                                        <td className="px-4 py-2.5 text-white font-bold">{item.description || item.itemName || "N/A"}</td>
                                        <td className="px-4 py-2.5 text-center text-indigo-300 font-bold">{item.quantity}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-300 font-mono">{Number(item.unitPrice || 0).toFixed(2)}</td>
                                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400 font-mono">{(Number(item.quantity || 1) * Number(item.unitPrice || 0)).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Scanned PO Image Preview & Gallery */}
                            {(credit.poImageUrl || credit.poUrl || (credit.poUrls && credit.poUrls.length > 0)) && (
                              <div className="mt-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                  <ImageIcon size={14} className="text-indigo-400" />
                                  {isAr ? "مرفقات ومستندات الفاتورة وأمر الشراء" : "Scanned PO & Invoice Documents"}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {[
                                    ...(credit.poImageUrl ? [credit.poImageUrl] : []),
                                    ...(credit.poUrl ? [credit.poUrl] : []),
                                    ...(credit.poUrls || []),
                                    ...(credit.invoiceUrl ? [credit.invoiceUrl] : []),
                                    ...(credit.invoiceUrls || [])
                                  ].filter((v, i, a) => a.indexOf(v) === i).map((imgUrl, imgIdx) => (
                                    <div 
                                      key={imgIdx}
                                      onClick={() => setPreviewImage({ url: imgUrl, title: `Document ${imgIdx + 1} - ${credit.companyName}` })}
                                      className="relative group border border-slate-800 rounded-2xl overflow-hidden bg-[#0B1121] aspect-video cursor-pointer hover:border-indigo-500/80 transition-all shadow-md"
                                    >
                                      <img 
                                        src={imgUrl} 
                                        alt={`PO Doc ${imgIdx + 1}`} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                        <Eye size={18} className="text-white" />
                                        <span className="text-xs font-bold text-white">{isAr ? "عرض" : "View"}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {(!creditPOItems[credit.id] || creditPOItems[credit.id].length === 0) && !credit.poImageUrl && !credit.poUrl && (!credit.poUrls || credit.poUrls.length === 0) && (
                              <div className="text-center py-6 bg-[#0B1121] rounded-xl border border-dashed border-slate-800">
                                <p className="text-xs font-bold text-slate-500">{isAr ? "لا يوجد أمر شراء أو أصناف مرفقة" : "No PO items or documents attached"}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredCredits.length === 0 && (
            <div className="text-center py-16 bg-[#0B1121] rounded-3xl border border-slate-800 border-dashed">
              <AlertCircle className="mx-auto text-slate-600 mb-3" size={48} />
              <p className="text-slate-300 font-bold text-lg">No credits found.</p>
              <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
            </div>
          )}

        </div>
        ) : viewMode === 'board' ? (
          /* KANBAN BOARD VIEW */
          <div className="h-[700px] overflow-hidden flex gap-4">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <DroppableColumn 
                id="open" 
                title="Open Invoices" 
                credits={filteredCredits.filter(c => c.status === 'open' && !c.onSalesOnly)} 
                onSelect={(c) => setSelectedSupplierProfile(c.companyName)} 
              />
              <DroppableColumn 
                id="pending" 
                title="Pending Payment" 
                credits={filteredCredits.filter(c => c.status === 'pending' && !c.onSalesOnly)} 
                onSelect={(c) => setSelectedSupplierProfile(c.companyName)} 
              />
              <DroppableColumn 
                id="paid" 
                title="Paid Invoices" 
                credits={filteredCredits.filter(c => c.status === 'paid' && !c.onSalesOnly)} 
                onSelect={(c) => setSelectedSupplierProfile(c.companyName)} 
              />
            </DndContext>
          </div>
        ) : (
          /* COMPANY LIABILITIES & TOTAL CREDITS OWED LEDGER VIEW */
          <div className="space-y-6">
            
            {/* Top Overview KPI Banner */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              
              <div className="bg-gradient-to-br from-rose-950/40 to-slate-900 border border-rose-800/40 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Total Owed (المديونية)</span>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-rose-300 font-mono tracking-tight">
                  EGP {companyOverallStats.totalRemainingDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-rose-400/70 font-semibold mt-1">Outstanding to all suppliers</p>
              </div>

              <div className="bg-gradient-to-br from-red-950/50 to-slate-900 border border-red-700/50 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Total Overdue (متأخرات)</span>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-red-400 font-mono tracking-tight">
                  EGP {companyOverallStats.totalOverdue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-red-400/70 font-semibold mt-1">Passed collection deadline</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/40 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Total Paid (تم سداده)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
                  EGP {companyOverallStats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-emerald-400/70 font-semibold mt-1">Full + partial settlements</p>
              </div>

              <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-800/40 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Partial Paid (مسدد جزئياً)</span>
                  <CreditCard className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-amber-300 font-mono tracking-tight">
                  EGP {companyOverallStats.totalPartialPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-amber-400/70 font-semibold mt-1">Across active open invoices</p>
              </div>

              <div className="col-span-2 md:col-span-1 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Creditor Companies</span>
                  <Building className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                    {companyOverallStats.activeCreditorsCount} <span className="text-xs text-slate-500 font-sans">/ {companyOverallStats.totalCompaniesCount}</span>
                  </p>
                  <p className="text-[10px] text-teal-400 font-semibold mt-1">Live Reactive Sync</p>
                </div>
              </div>

            </div>

            {/* Sorting & Expand Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Sort Companies:</span>
                <select 
                  value={companySortBy}
                  onChange={(e) => setCompanySortBy(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-indigo-500"
                >
                  <option value="owed">Highest Owed First (الأعلى مديونية)</option>
                  <option value="overdue">Highest Overdue First (الأكثر تأخيراً)</option>
                  <option value="name">Alphabetical (أبجدياً)</option>
                  <option value="invoices">Most Invoices (الأكثر فواتير)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const allOpen: Record<string, boolean> = {};
                    filteredCompanies.forEach(c => { allOpen[c.companyName] = true; });
                    setExpandedCompanies(allOpen);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                >
                  Expand All
                </button>
                <button 
                  onClick={() => setExpandedCompanies({})}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Company Cards List */}
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-16 bg-[#0B1121] rounded-3xl border border-slate-800 border-dashed">
                <Building className="mx-auto text-slate-600 mb-3" size={48} />
                <p className="text-slate-300 font-bold text-lg">No companies found matching criteria.</p>
                <p className="text-slate-500 text-sm">All company liabilities are settled or adjust search filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCompanies.map((c) => {
                  const isExpanded = !!expandedCompanies[c.companyName];
                  const hasOverdue = c.overdueAmount > 0;
                  const hasPartial = c.partialInvoicesCount > 0;
                  const paidPct = c.totalInvoiced > 0 ? Math.min(100, Math.round((c.totalPaid / c.totalInvoiced) * 100)) : 0;
                  const initials = c.companyName.substring(0, 2).toUpperCase();

                  return (
                    <div 
                      key={c.companyName}
                      className={`bg-[#0B1121] border rounded-2xl shadow-xl transition-all overflow-hidden ${
                        hasOverdue ? 'border-red-900/60 shadow-red-950/10' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Card Header */}
                      <div 
                        onClick={() => setExpandedCompanies(prev => ({ ...prev, [c.companyName]: !prev[c.companyName] }))}
                        className="p-4 sm:p-5 cursor-pointer hover:bg-slate-900/40 transition-colors"
                      >
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                          
                          {/* Left: Avatar & Name */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-700/50 flex items-center justify-center font-black text-indigo-300 text-base shadow-inner shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-white text-base sm:text-lg tracking-tight truncate">
                                  {c.companyName}
                                </h3>
                                {hasOverdue && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                                    <AlertTriangle size={11} />
                                    EGP {c.overdueAmount.toLocaleString()} Overdue
                                  </span>
                                )}
                                {hasPartial && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    {c.partialInvoicesCount} Partial ({c.partialPaidAmount.toLocaleString()} EGP paid)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {c.totalInvoicesCount} Total Invoices • {c.openInvoicesCount + c.partialInvoicesCount} Active Debt • {c.fullyPaidCount} Fully Paid
                              </p>
                            </div>
                          </div>

                          {/* Right: Key Figures Grid */}
                          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-between w-full lg:w-auto">
                            
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Currently Owed</p>
                              <p className="text-base sm:text-lg font-black font-mono text-rose-400">
                                EGP {c.totalRemainingDue.toLocaleString()}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Paid</p>
                              <p className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                                EGP {c.totalPaid.toLocaleString()}
                              </p>
                            </div>

                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gross Total</p>
                              <p className="text-sm font-semibold font-mono text-slate-300">
                                EGP {c.totalInvoiced.toLocaleString()}
                              </p>
                            </div>

                            <div className="p-2 bg-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>

                          </div>

                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 flex">
                          <div 
                            style={{ width: `${paidPct}%` }}
                            className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full transition-all duration-500"
                            title={`Paid: ${paidPct}%`}
                          />
                          <div 
                            style={{ width: `${100 - paidPct}%` }}
                            className={`${hasOverdue ? 'bg-red-500/80' : 'bg-rose-500/40'} h-full transition-all duration-500`}
                            title={`Remaining: ${100 - paidPct}%`}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mt-1">
                          <span>{paidPct}% Settled</span>
                          <span>{100 - paidPct}% Outstanding</span>
                        </div>

                      </div>

                      {/* Expanded Invoices Table */}
                      {isExpanded && (
                        <div className="border-t border-slate-800/80 bg-slate-950/70 p-4 sm:p-5 animate-in fade-in slide-in-from-top-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/60">
                                  <th className="p-2.5 font-bold">Invoice / PO</th>
                                  <th className="p-2.5 font-bold">Issue Date</th>
                                  <th className="p-2.5 font-bold">Collection Due</th>
                                  <th className="p-2.5 font-bold text-right">Gross Total</th>
                                  <th className="p-2.5 font-bold text-right">Paid Amount</th>
                                  <th className="p-2.5 font-bold text-right text-rose-400">Remaining</th>
                                  <th className="p-2.5 font-bold text-center">Status</th>
                                  <th className="p-2.5 font-bold text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {c.invoices.map((inv) => {
                                  const gross = Number(inv.amountDue || 0) + Number(inv.tax || 0);
                                  const paid = Number(inv.paidAmount || 0);
                                  const remaining = Math.max(0, gross - paid);
                                  const colDate = inv.collectionDate ? inv.collectionDate.substring(0, 10) : "";
                                  
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const dueObj = colDate ? new Date(colDate) : null;
                                  if (dueObj) dueObj.setHours(0, 0, 0, 0);
                                  const diffDays = dueObj ? Math.round((dueObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                                  const isInvOverdue = remaining > 0 && diffDays !== null && diffDays < 0 && inv.status !== 'paid';

                                  return (
                                    <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                                      
                                      <td className="p-2.5 font-mono">
                                        <div className="font-bold text-white">#{inv.invoiceNumber || "N/A"}</div>
                                        {inv.poNumber && <div className="text-[10px] text-teal-400">PO: {inv.poNumber}</div>}
                                      </td>

                                      <td className="p-2.5 font-mono text-slate-400 whitespace-nowrap">
                                        {inv.date || "N/A"}
                                      </td>

                                      <td className="p-2.5 whitespace-nowrap">
                                        <div className="font-mono text-slate-300">{colDate || "N/A"}</div>
                                        {isInvOverdue ? (
                                          <span className="text-[9px] font-black text-red-400 flex items-center gap-0.5">
                                            <AlertTriangle size={10} />
                                            {Math.abs(diffDays!)}d overdue
                                          </span>
                                        ) : diffDays !== null && diffDays <= 3 && remaining > 0 ? (
                                          <span className="text-[9px] font-bold text-amber-400">
                                            Due in {diffDays}d
                                          </span>
                                        ) : null}
                                      </td>

                                      <td className="p-2.5 text-right font-mono font-bold text-slate-200 whitespace-nowrap">
                                        {gross.toLocaleString()} EGP
                                      </td>

                                      <td className="p-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                        {paid > 0 ? `${paid.toLocaleString()} EGP` : "-"}
                                      </td>

                                      <td className="p-2.5 text-right font-mono font-black text-rose-400 whitespace-nowrap">
                                        {remaining > 0 ? `${remaining.toLocaleString()} EGP` : "0 EGP"}
                                      </td>

                                      <td className="p-2.5 text-center">
                                        {inv.status === 'paid' || remaining === 0 ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                            Paid
                                          </span>
                                        ) : isInvOverdue ? (
                                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                                            Overdue
                                          </span>
                                        ) : paid > 0 ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                            Partial
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                            Open
                                          </span>
                                        )}
                                      </td>

                                      <td className="p-2.5 text-center">
                                        {remaining > 0 && (
                                          <button 
                                            onClick={() => handleOpenPaymentModal(inv)}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 mx-auto shadow-sm"
                                            title="Record Payment for this invoice"
                                          >
                                            <CreditCard size={13} />
                                            <span>سداد (Pay)</span>
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

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
        </div>
      </div>

      {/* ADD CREDIT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-[#0B1121] text-slate-100 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/60" dir={isAr ? "rtl" : "ltr"}>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {isAr ? "تسجيل آجل / مديونية جديدة" : "Record New Credit"}
                  </h2>
                  <p className="text-xs font-bold text-indigo-400 mt-1 uppercase tracking-wider">
                    {isAr ? "ادخل البيانات أو اسحب صورة أمر الشراء" : "Fill in details or upload PO"}
                  </p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all shadow-sm cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCredit} className="flex flex-col flex-1 min-h-0" dir={isAr ? "rtl" : "ltr"}>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  <div 
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 ${isProcessingPo ? 'border-indigo-500 bg-indigo-950/30 scale-[0.98]' : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-900/60'}`}
                >
                  {isProcessingPo ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-indigo-400">
                      <div className="p-3 bg-indigo-950 rounded-full mb-2 border border-indigo-800">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                      <span className="font-black text-lg tracking-tight text-white">{isAr ? "جاري قراءة أمر الشراء بالذكاء الاصطناعي..." : "Reading Purchase Order..."}</span>
                      <span className="text-sm font-medium text-indigo-400/80">{isAr ? "سيتم استخراج البيانات تلقائياً" : "Extracting details automatically"}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <div className="p-4 bg-slate-900 border border-slate-800 shadow-sm rounded-full mb-2 text-indigo-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                      <span className="font-black text-lg text-white tracking-tight">{isAr ? "اسحب صورة امر الشراء أو الفاتورة هنا" : "Paste or Drop PO Image Here"}</span>
                      <span className="text-sm font-medium text-slate-400">{isAr ? "سيتم استخراج كافة البيانات بالذكاء الاصطناعي" : "We'll automatically extract the details using AI"}</span>
                      <button
                        type="button"
                        onClick={handlePastePoImageButtonClick}
                        className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-700 hover:border-indigo-500 hover:shadow-md text-indigo-300 font-bold rounded-xl transition-all text-sm group cursor-pointer"
                      >
                        <ClipboardPaste size={16} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                        {isAr ? "لصق من الحافظة" : "Paste from Clipboard"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/60 p-5 rounded-3xl border border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم الفاتورة * " : "Invoice # *"}</label>
                    <input required type="text" className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-medium text-white placeholder:text-slate-500" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم أمر الشراء (PO)" : "PO #"}</label>
                    <input type="text" className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-medium text-white placeholder:text-slate-500" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "الشركة / المورد *" : "Company *"}</label>
                      <button type="button" onClick={() => setShowAddSupplier(true)} className="text-[10px] text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer">
                        {isAr ? "+ مورد جديد" : "+ New Supplier"}
                      </button>
                    </div>
                    <select required className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-medium text-white" value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                      <option value="" className="bg-slate-900">{isAr ? "-- اختر المورد --" : "Select a supplier..."}</option>
                      {suppliers.map(s => <option key={s.id} value={s.name} className="bg-slate-900">{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "المبلغ المستحق (قبل الضريبة) *" : "Amount Due (Before Tax) *"}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">EGP</span>
                      <input required type="number" step="0.01" className="w-full pl-12 pr-4 p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-black text-white" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "قيمة الضريبة" : "Tax Amount"}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">EGP</span>
                      <input type="number" step="0.01" className="w-full pl-12 pr-4 p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-bold text-white" value={tax} onChange={(e) => setTax(e.target.value)} />
                    </div>
                  </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "تاريخ التحصيل المتوقع" : "Collection Date"}</label>
                      <input required type="date" className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-medium text-white" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[14, 15, 30, 45].map(days => (
                          <button 
                            key={days} 
                            type="button" 
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + days);
                              setCollectionDate(d.toISOString().split('T')[0]);
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 rounded-lg hover:bg-indigo-900 transition-colors cursor-pointer"
                          >
                            +{days} {isAr ? "يوم" : "Days"}
                          </button>
                        ))}
                      </div>
                    </div>

                  {/* Total Sum Preview Box (Amount Due + Tax) */}
                  <div className="md:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border border-emerald-800/40 flex items-center justify-between shadow-xs transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        <Calculator size={18} />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                          {isAr ? "إجمالي المبلغ المستحق (شامل الضريبة)" : "Total Amount Due (Incl. Tax)"}
                        </span>
                        <span className="text-xs text-emerald-400/80 font-medium">
                          {(parseFloat(tax) || 0) > 0 ? (
                            isAr 
                              ? `${(parseFloat(amountDue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(tax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ضريبة`
                              : `${(parseFloat(amountDue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(tax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tax`
                          ) : (
                            isAr ? "بدون ضريبة إضافية" : "No tax added"
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono tracking-tight">
                        EGP {((parseFloat(amountDue) || 0) + (parseFloat(tax) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {poItems && poItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-300 mb-2">{isAr ? "الأصناف المستخرجة" : "Extracted PO Items"}</h4>
                    <div className="bg-[#0B1121] rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-sm" dir={isAr ? "rtl" : "ltr"}>
                          <thead className="bg-slate-950 border-b border-slate-800 sticky top-0">
                            <tr>
                              <th className="p-3 font-bold text-slate-400 uppercase text-[10px] tracking-wider">{isAr ? "الوصف" : "Description"}</th>
                              <th className="p-3 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-center">{isAr ? "الكمية" : "Qty"}</th>
                              <th className="p-3 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-right">{isAr ? "السعر" : "Price"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poItems.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/60 transition-colors">
                                <td className="p-3 text-white font-medium text-xs">{item.description || item.barcode || 'Unknown Item'}</td>
                                <td className="p-3 text-slate-300 font-bold text-xs text-center">{item.quantity || 0}</td>
                                <td className="p-3 text-indigo-400 font-bold text-xs text-right whitespace-nowrap">{item.unitPrice ? `${item.unitPrice} EGP` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={onSalesOnly} onChange={(e) => setOnSalesOnly(e.target.checked)} className="peer sr-only" />
                      <div className="w-6 h-6 rounded-md border-2 border-slate-700 bg-slate-900 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors"></div>
                      <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-slate-300 font-bold group-hover:text-white transition-colors">{isAr ? "مبيعات فقط" : "On Sales Only"}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} className="peer sr-only" />
                      <div className="w-6 h-6 rounded-md border-2 border-slate-700 bg-slate-900 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors"></div>
                      <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-slate-300 font-bold group-hover:text-white transition-colors">{isAr ? "خاضع للضريبة؟" : "Is Taxable?"}</span>
                  </label>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "توقيع المدير المسؤول *" : "Manager Signature *"}</label>
                    {(managerSignature || hasSigned) && (
                      <button type="button" onClick={() => { sigPadRef.current?.clear(); setHasSigned(false); setManagerSignature(""); }} className="text-[10px] bg-rose-950/60 border border-rose-800/60 text-rose-300 px-2 py-1 rounded font-bold uppercase hover:bg-rose-900/60 transition-colors">
                        {isAr ? "مسح التوقيع" : "Clear Signature"}
                      </button>
                    )}
                  </div>
                  <div className="border border-slate-700 bg-slate-950 rounded-xl overflow-hidden relative shadow-inner" style={{ height: "150px" }}>
                    {managerSignature && !hasSigned ? (
                      <img src={managerSignature} alt="Saved Signature" className="w-full h-full object-contain p-4" />
                    ) : (
                      <SignaturePad 
                        // @ts-expect-error: dynamic import ref typing mismatch
                        ref={sigPadRef} 
                        canvasProps={{ className: "w-full h-full cursor-crosshair" }} 
                        onBegin={() => setHasSigned(true)}
                        onEnd={() => {
                          if (sigPadRef.current) {
                            setManagerSignature(sigPadRef.current.toDataURL());
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/60 mt-auto">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-bold hover:bg-slate-700 hover:text-white transition-all shadow-sm cursor-pointer">{isAr ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all cursor-pointer">
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    {isAr ? "حفظ الدين" : "Save Credit"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAKE PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && selectedCreditForPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-[#0B1121] text-slate-100 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh] relative"
            >
              {/* Skeuomorphic Overlays */}
              {isCoinDropping && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <CoinDropWallet isDropping={isCoinDropping} onComplete={() => setShowPaymentModal(false)} />
                </div>
              )}
              {isReceiptPrinting && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <PosReceiptPrinter isPrinting={isReceiptPrinting} />
                </div>
              )}
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/60" dir={isAr ? "rtl" : "ltr"}>
                <h2 className="text-2xl font-black text-white tracking-tight">{isAr ? "سداد مديونية مورد / آجل" : "Make Credit Payment"}</h2>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleProcessPayment} className="flex flex-col flex-1 min-h-0" dir={isAr ? "rtl" : "ltr"}>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 p-5 rounded-2xl border border-indigo-900/50 shadow-inner">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">{isAr ? "سداد لحساب" : "Paying For"}</p>
                    <p className="text-lg text-white font-black tracking-tight">{selectedCreditForPayment.companyName}</p>
                    <p className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-1"><FileText size={14}/> {isAr ? "فاتورة رقم:" : "Inv:"} {selectedCreditForPayment.invoiceNumber}</p>
                    
                    <div className="bg-[#0B1121] p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">{isAr ? "المبلغ المتبقي" : "Remaining Balance"}</span>
                      <span className="text-2xl font-black text-indigo-400 font-mono tracking-tight">EGP {((selectedCreditForPayment.amountDue + selectedCreditForPayment.tax) - selectedCreditForPayment.paidAmount).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Purchase Order (PO) Details & Document Card */}
                  <div className="bg-[#0B1121] p-4.5 rounded-2xl border border-indigo-500/30 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                          <FileText size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-2">
                            {isAr ? "بيانات أمر الشراء والتوريد (P.O.)" : "Purchase Order (PO) Details"}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                              {isAr ? "ينتقل تلقائياً لسند الصرف" : "Carried to Payment"}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {isAr ? "سيتم ربط رقم الـ PO وصور المستندات والأصناف بالكامل مع إيصال الصرف المالي" : "PO number, items & documents are linked with the payment voucher"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "رقم أمر الشراء / التوريد (PO Number)" : "PO Number / Reference"}
                        </label>
                        <input 
                          type="text"
                          placeholder={isAr ? "مثال: PO-45012 أو إذن توريد" : "e.g. PO-45012"}
                          className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-mono font-bold text-white text-sm"
                          value={paymentPoNumber}
                          onChange={(e) => setPaymentPoNumber(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "مستند / صورة أمر الشراء (PO Image)" : "PO Document / Image"}
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-indigo-500 rounded-xl p-2 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition-colors">
                            <Upload size={14} className="text-indigo-400" />
                            <span>{paymentPoImageUrl ? (isAr ? "تغيير صورة الـ PO" : "Change PO Image") : (isAr ? "رفع صورة الـ PO" : "Upload PO Image")}</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadPaymentPo(e.target.files[0]);
                                }
                              }} 
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handlePastePaymentPo}
                            title={isAr ? "لصق من الحافظة" : "Paste from clipboard"}
                            className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                          >
                            <ClipboardPaste size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Attached Items & Thumbnail Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        {paymentPoItems && paymentPoItems.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowPaymentItemsDrawer(!showPaymentItemsDrawer)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-bold flex items-center gap-1.5 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                          >
                            <CheckCircle size={12} />
                            <span>{isAr ? `${paymentPoItems.length} صنف مسجل بأمر الشراء` : `${paymentPoItems.length} PO Items Attached`}</span>
                            <ChevronDown size={12} className={`transition-transform ${showPaymentItemsDrawer ? "rotate-180" : ""}`} />
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                            <AlertCircle size={12} /> {isAr ? "لا توجد أصناف مستخرجة مسجلة" : "No itemized products attached"}
                          </span>
                        )}

                        {paymentPoImageUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ url: paymentPoImageUrl, title: `PO - ${selectedCreditForPayment.companyName}` })}
                            className="px-2.5 py-1 rounded-lg bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-bold flex items-center gap-1.5 hover:bg-indigo-900/60 transition-colors cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>{isAr ? "معاينة صورة الـ PO" : "Preview PO Image"}</span>
                          </button>
                        )}
                      </div>

                      {isProcessingPaymentPo && (
                        <span className="text-[11px] text-indigo-400 font-bold flex items-center gap-1 animate-pulse">
                          <Loader2 size={12} className="animate-spin" /> {isAr ? "جاري معالجة أمر الشراء..." : "Processing PO image..."}
                        </span>
                      )}
                    </div>

                    {/* Expandable Items Preview */}
                    {showPaymentItemsDrawer && paymentPoItems && paymentPoItems.length > 0 && (
                      <div className="overflow-x-auto max-h-44 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 mt-2">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-bold">
                            <tr>
                              <th className="px-3 py-1.5">#</th>
                              <th className="px-3 py-1.5">Barcode</th>
                              <th className="px-3 py-1.5">Description</th>
                              <th className="px-3 py-1.5 text-center">Qty</th>
                              <th className="px-3 py-1.5 text-right">Price</th>
                              <th className="px-3 py-1.5 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentPoItems.map((it: any, itIdx: number) => (
                              <tr key={itIdx} className="border-b border-slate-850/50 last:border-0 font-medium">
                                <td className="px-3 py-1 text-slate-500 font-mono">{itIdx + 1}</td>
                                <td className="px-3 py-1 text-slate-400 font-mono">{it.barcode || "N/A"}</td>
                                <td className="px-3 py-1 text-white font-bold">{it.description || it.itemName || "Item"}</td>
                                <td className="px-3 py-1 text-center text-indigo-300 font-bold">{it.quantity}</td>
                                <td className="px-3 py-1 text-right text-slate-300 font-mono">{Number(it.unitPrice || 0).toFixed(2)}</td>
                                <td className="px-3 py-1 text-right text-emerald-400 font-mono font-bold">{(Number(it.quantity || 1) * Number(it.unitPrice || 0)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mb-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "التاريخ *" : "Date *"}</label>
                        <input required type="date" className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-bold text-white" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "الوقت *" : "Time *"}</label>
                        <input required type="time" className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-bold text-white" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "طريقة التحصيل *" : "Payment Method *"}</label>
                      <select className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-bold text-white appearance-none cursor-pointer" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="cash">{isAr ? "💵 كاش (نقداً)" : "💵 Cash / نقدي"}</option>
                        <option value="bank_transfer">{isAr ? "🏦 تحويل بنكي" : "🏦 Bank Transfer / تحويل بنكي"}</option>
                        <option value="visa">{isAr ? "💳 فيزا (بطاقة)" : "💳 Visa / فيزا"}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "المبلغ المراد سداده من المديونية *" : "Gross Debt Amount to Settle *"}</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black">EGP</span>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          min="0.01" 
                          placeholder="0.00" 
                          className="w-full pl-16 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 transition-all outline-none font-black text-white text-lg font-mono" 
                          value={paymentAmount} 
                          onChange={(e) => setPaymentAmount(e.target.value)} 
                        />
                      </div>
                    </div>

                    {paymentMethod === 'bank_transfer' && (
                      <div className="bg-blue-950/40 p-4 rounded-xl border border-blue-900/60 mb-4 mt-2">
                        <label className="block text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">{isAr ? "إيصال التحويل البنكي *" : "Bank Transfer Receipt *"}</label>
                        <div className="flex flex-col gap-2">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setBankTransferFile(e.target.files[0]);
                              }
                            }}
                            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-900/80 file:text-blue-300 hover:file:bg-blue-800"
                          />
                          {bankTransferFile ? (
                            <p className="text-xs font-medium text-blue-300 break-all bg-blue-900/50 p-2 rounded-lg border border-blue-800 inline-flex items-center gap-1"><CheckCircle2 size={12}/> {bankTransferFile.name}</p>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-blue-400">{isAr ? "أو:" : "Or: "}</span>
                              <button 
                                type="button" 
                                onClick={handlePasteBankReceipt}
                                className="text-[10px] text-blue-300 bg-blue-900/60 hover:bg-blue-800 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-blue-800 cursor-pointer"
                              >
                                <ClipboardPaste size={10}/> {isAr ? "لصق من الحافظة" : "Paste from Clipboard"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GOODS RETURN (RTV) DEDUCTION INTERACTIVE CARD */}
                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <div className={`p-5 rounded-2xl border transition-all duration-300 ${hasReturn ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-400 dark:border-amber-600/60 shadow-lg shadow-amber-500/5' : 'bg-slate-900/60 border-slate-800'}`}>
                      {/* Question Header & Toggle Switch */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${hasReturn ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-4 ring-amber-500/15' : 'bg-slate-800 text-slate-400'}`}>
                            <RotateCcw size={22} className={hasReturn ? 'rotate-[-30deg] transition-transform duration-300' : ''} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base sm:text-lg font-black text-white">
                                {isAr ? "هل يوجد مرتجع بضاعة مرتبط بسداد هذه المديونية؟ (RTV)" : "Is there a Goods Return (RTV) for this credit payment?"}
                              </h3>
                              {hasReturn && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white animate-pulse">
                                  {isAr ? "يوجد خصم مرتجع" : "RTV Deduction Active"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {isAr
                                ? "في حالة وجود بضاعة مرتجعة، سيتم خصم قيمتها من المبلغ المطلوب سداده نقداً، وتسوية الدين بالكامل، وطباعة إيصال مرتجع رسمي A4 تلقائياً مع إيصال السداد، وإغلاق المرتجع في السيستم."
                                : "If goods are returned, their value will be deducted from cash outflow while clearing full credit debt, an official A4 RTV receipt printed, and return closed."}
                            </p>
                          </div>
                        </div>

                        {/* Yes / No Toggle Buttons */}
                        <div className="flex items-center bg-slate-800 p-1 rounded-xl self-start sm:self-center shrink-0 border border-slate-700">
                          <button
                            type="button"
                            onClick={() => {
                              setHasReturn(false);
                              setReturnAmount("");
                              setReturnTransferOutNumber("");
                              setReturnReason("");
                              setReturnItems([]);
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!hasReturn ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                          >
                            {isAr ? "لا، لا يوجد" : "No Return"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHasReturn(true);
                              if (!returnTransferOutNumber) {
                                setReturnTransferOutNumber(`TR-${Date.now().toString().slice(-6)}`);
                              }
                              if (!returnAgentName && selectedCreditForPayment.supplierRepName) setReturnAgentName(selectedCreditForPayment.supplierRepName);
                              if (!returnAgentNationalId && selectedCreditForPayment.supplierNationalId) setReturnAgentNationalId(selectedCreditForPayment.supplierNationalId);
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${hasReturn ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
                          >
                            <RotateCcw size={13} />
                            {isAr ? "نعم، يوجد مرتجع" : "Yes, Return"}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Return Details Inputs */}
                      <AnimatePresence>
                        {hasReturn && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="mt-6 pt-6 border-t border-amber-500/20 space-y-6 overflow-hidden"
                          >
                            {/* Segmented Source Switcher: Choose from Pending vs Add New */}
                            <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner">
                              <button
                                type="button"
                                onClick={() => setReturnSource("pending")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
                                  returnSource === "pending"
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/20'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                <FileText size={15} />
                                <span>{isAr ? "اختيار من المرتجعات المعلقة للشركة" : "Select Pending Return"}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  returnSource === "pending" ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {matchingPendingReturns.length}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setReturnSource("new");
                                  setSelectedPendingReturn(null);
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
                                  returnSource === "new"
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/20'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                <Plus size={15} />
                                <span>{isAr ? "تسجيل مرتجع جديد الآن" : "Create New Return"}</span>
                              </button>
                            </div>

                            {/* PENDING RETURNS BROWSER & SELECTOR */}
                            {returnSource === "pending" && (
                              <div className="space-y-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                                {/* Search & Filter Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  <div className="relative flex-1">
                                    <Search size={14} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder={isAr ? "بحث برقم المرتجع (RTV)، إذن الخروج (TR)، أو اسم المورد..." : "Search RTV #, TR #, or supplier..."}
                                      value={pendingReturnSearchQuery}
                                      onChange={(e) => setPendingReturnSearchQuery(e.target.value)}
                                      className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    {pendingReturnSearchQuery && (
                                      <button
                                        type="button"
                                        onClick={() => setPendingReturnSearchQuery("")}
                                        className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                      >
                                        <X size={13} />
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setShowAllSuppliersPending(!showAllSuppliersPending)}
                                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                        showAllSuppliersPending
                                          ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                                      }`}
                                    >
                                      <Layers size={13} />
                                      {showAllSuppliersPending
                                        ? (isAr ? "عرض مرتجعات المورد المحدد" : "Selected Supplier Only")
                                        : (isAr ? `عرض كل المرتجعات (${availablePendingReturns.length})` : `All Returns (${availablePendingReturns.length})`)}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={fetchPendingReturnsList}
                                      disabled={loadingPendingReturns}
                                      title={isAr ? "تحديث القائمة" : "Refresh"}
                                      className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                                    >
                                      <RefreshCw size={13} className={loadingPendingReturns ? "animate-spin" : ""} />
                                    </button>
                                  </div>
                                </div>

                                {/* Loading Spinner */}
                                {loadingPendingReturns && (
                                  <div className="py-6 flex flex-col items-center justify-center text-slate-400 space-y-2">
                                    <Loader2 size={22} className="animate-spin text-amber-500" />
                                    <p className="text-xs font-bold">{isAr ? "جاري جلب المرتجعات المعلقة من السيستم..." : "Loading pending returns..."}</p>
                                  </div>
                                )}

                                {/* Empty State */}
                                {!loadingPendingReturns && matchingPendingReturns.length === 0 && (
                                  <div className="p-5 rounded-xl bg-slate-900/80 border border-dashed border-amber-500/30 text-center space-y-2.5">
                                    <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                                      <PackageOpen size={20} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-black text-white">
                                        {isAr ? `لا توجد مرتجعات معلقة مسجلة لشركة "${selectedCreditForPayment?.companyName || 'المورد'}"` : `No pending returns for "${selectedCreditForPayment?.companyName || 'Supplier'}"`}
                                      </h4>
                                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                                        {isAr
                                          ? "يمكنك الضغط على زر 'تسجيل مرتجع جديد الآن' لإدخال بيانات المرتجع يدوياً وخصمه فوراً."
                                          : "You can click 'Create New Return' to enter return details manually."}
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReturnSource("new");
                                          setSelectedPendingReturn(null);
                                        }}
                                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1"
                                      >
                                        <Plus size={13} />
                                        {isAr ? "تسجيل مرتجع جديد الآن" : "Create New Return"}
                                      </button>
                                      {availablePendingReturns.length > 0 && !showAllSuppliersPending && (
                                        <button
                                          type="button"
                                          onClick={() => setShowAllSuppliersPending(true)}
                                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                                        >
                                          {isAr ? `عرض كل المرتجعات (${availablePendingReturns.length})` : `Show All (${availablePendingReturns.length})`}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Pending Returns Cards Grid */}
                                {!loadingPendingReturns && matchingPendingReturns.length > 0 && (
                                  <div className="grid sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                                    {matchingPendingReturns.map((ticket) => {
                                      const isSelected = selectedPendingReturn?.id === ticket.id;
                                      const itemsCount = ticket.items?.length || 0;
                                      return (
                                        <div
                                          key={ticket.id}
                                          onClick={() => handleSelectPendingReturn(ticket)}
                                          className={`relative p-3 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                                            isSelected
                                              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/20'
                                              : 'bg-slate-900/90 border-slate-800 hover:border-amber-400/50'
                                          }`}
                                        >
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-slate-950 text-amber-400 border border-slate-800">
                                                  {ticket.returnNumber}
                                                </span>
                                                {ticket.transferOutNumber && (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                                                    TR: {ticket.transferOutNumber}
                                                  </span>
                                                )}
                                              </div>
                                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                                isSelected ? 'bg-amber-500 text-white' : 'border-2 border-slate-600'
                                              }`}>
                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                              </div>
                                            </div>

                                            <div>
                                              <p className="text-xs font-black text-white line-clamp-1">
                                                {ticket.supplier}
                                              </p>
                                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                                {ticket.reason || "مرتجع بضاعة معلق"}
                                              </p>
                                            </div>

                                            {itemsCount > 0 && (
                                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                <span>{itemsCount} {isAr ? "صنف مفصل" : "items"}</span>
                                                {ticket.agentName && <span>• {ticket.agentName}</span>}
                                              </div>
                                            )}
                                          </div>

                                          <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 font-medium">
                                              {ticket.date ? new Date(ticket.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : ''}
                                            </span>
                                            <div className="text-right">
                                              <span className="text-[10px] text-slate-400 font-bold block">{isAr ? "قيمة المرتجع" : "Amount"}</span>
                                              <span className="text-xs sm:text-sm font-mono font-black text-amber-400">
                                                EGP {Number(ticket.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Selected Return Callout Badge */}
                                {selectedPendingReturn && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-center gap-2 text-amber-200">
                                      <CheckCircle2 size={17} className="text-amber-400 shrink-0" />
                                      <div>
                                        <span className="font-black">
                                          {isAr ? `تم ربط المرتجع المعلق (${selectedPendingReturn.returnNumber})` : `Linked to Return (${selectedPendingReturn.returnNumber})`}
                                        </span>
                                        <span className="opacity-80 block text-[11px]">
                                          {isAr ? "سيتم إغلاق وتسوية هذا المرتجع فور حفظ السداد، وطباعة إيصال المرتجع الرسمي A4." : "Will be settled and closed automatically upon saving."}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectPendingReturn(selectedPendingReturn)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-950/40 text-red-400 font-bold text-[11px] transition-colors shrink-0 border border-slate-700"
                                    >
                                      {isAr ? "إلغاء التحديد" : "Deselect"}
                                    </button>
                                  </motion.div>
                                )}
                              </div>
                            )}

                            {/* Main Return Questions Grid */}
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Question 1: Return Amount */}
                              <div className="bg-[#0B1121] p-4 rounded-xl border border-amber-400/40 shadow-xs">
                                <label className="block text-xs font-black text-amber-400 uppercase tracking-wider mb-1.5">
                                  {isAr ? "١. قيمة خصم المرتجع (ج.م) *" : "1. Return Deduction Amount (EGP) *"}
                                </label>
                                <input
                                  type="number"
                                  required={hasReturn}
                                  placeholder="0.00"
                                  step="0.01"
                                  min="0.01"
                                  max={parseFloat(paymentAmount) || undefined}
                                  value={returnAmount}
                                  onChange={(e) => setReturnAmount(e.target.value)}
                                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-amber-400/50 focus:ring-2 focus:ring-amber-500 outline-none font-mono font-black text-amber-400 text-lg"
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                  {isAr ? "المبلغ المستحق خصمه من السداد النقدي" : "Amount to deduct from cash payout"}
                                </span>
                              </div>

                              {/* Question 2: TR Number */}
                              <div className="bg-[#0B1121] p-4 rounded-xl border border-amber-400/40 shadow-xs">
                                <label className="block text-xs font-black text-slate-200 uppercase tracking-wider mb-1.5">
                                  {isAr ? "٢. رقم إذن خروج البضاعة (TR Number)" : "2. Outbound Transfer # (TR)"}
                                </label>
                                <input
                                  type="text"
                                  placeholder={isAr ? "مثال: TR-94821 (تلقائي إن تُرك فارغاً)" : "e.g. TR-94821 (Auto-generated if blank)"}
                                  value={returnTransferOutNumber}
                                  onChange={(e) => setReturnTransferOutNumber(e.target.value)}
                                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-white text-sm"
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                  {isAr ? "الرقم الدفتري أو الإلكتروني لإذن الخروج (يتم إنشاؤه تلقائياً)" : "Official outbound transfer manifest # (Auto-assigned)"}
                                </span>
                              </div>

                              {/* Question 3: Return Reason */}
                              <div className="bg-[#0B1121] p-4 rounded-xl border border-amber-400/40 shadow-xs sm:col-span-2 lg:col-span-1">
                                <label className="block text-xs font-black text-slate-200 uppercase tracking-wider mb-1.5">
                                  {isAr ? "٣. سبب الإرجاع *" : "3. Return Reason *"}
                                </label>
                                <input
                                  type="text"
                                  placeholder={isAr ? "بضاعة تالفة / منتهية الصلاحية / راكدة / تسوية دين" : "Damaged / Expired / Slow moving / Debt settlement"}
                                  value={returnReason}
                                  onChange={(e) => setReturnReason(e.target.value)}
                                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none font-medium text-white text-sm"
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                  {isAr ? "يظهر رسمياً على إيصال المرتجع" : "Will appear on RTV receipt"}
                                </span>
                              </div>
                            </div>

                            {/* Representative / Driver for Return Handover */}
                            <div className="bg-[#0B1121] p-4 rounded-xl border border-slate-800">
                              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-3">
                                {isAr ? "بيانات مندوب / سائق استلام المرتجع (اختياري - للإيصال)" : "Representative Handover Details"}
                              </h4>
                              <div className="grid sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? "اسم المندوب المستلم" : "Rep Name"}</label>
                                  <input
                                    type="text"
                                    placeholder={selectedCreditForPayment.supplierRepName || (isAr ? "مندوب المورد" : "Representative")}
                                    value={returnAgentName}
                                    onChange={(e) => setReturnAgentName(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? "الرقم القومي (١٤ رقم)" : "National ID (14 digits)"}</label>
                                  <input
                                    type="text"
                                    maxLength={14}
                                    placeholder={selectedCreditForPayment.supplierNationalId || (isAr ? "الرقم القومي" : "National ID")}
                                    value={returnAgentNationalId}
                                    onChange={(e) => setReturnAgentNationalId(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? "رقم الهاتف المحمول" : "Mobile Number"}</label>
                                  <input
                                    type="tel"
                                    placeholder="01XXXXXXXXX"
                                    value={returnAgentMobile}
                                    onChange={(e) => setReturnAgentMobile(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Optional Itemized Return Items */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-400">
                                  {isAr ? `أصناف المرتجع التفصيلية (${returnItems.length}) - اختياري` : `Itemized Return Items (${returnItems.length}) - Optional`}
                                </span>
                                <button
                                  type="button"
                                  onClick={handleAddReturnItem}
                                  className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus size={13} /> {isAr ? "إضافة صنف مرتجع" : "Add Return Item"}
                                </button>
                              </div>

                              {returnItems.length > 0 && (
                                <div className="overflow-x-auto border border-amber-500/20 rounded-xl mb-3">
                                  <table className="w-full text-xs text-left" dir={isAr ? "rtl" : "ltr"}>
                                    <thead className="bg-amber-950/40 text-amber-200 uppercase font-black text-[10px]">
                                      <tr>
                                        <th className="p-2.5">{isAr ? "الباركود" : "Barcode"}</th>
                                        <th className="p-2.5">{isAr ? "اسم الصنف" : "Item Name"}</th>
                                        <th className="p-2.5 text-center w-20">{isAr ? "الكمية" : "Qty"}</th>
                                        <th className="p-2.5 text-right w-24">{isAr ? "السعر" : "Price"}</th>
                                        <th className="p-2.5 text-right w-24">{isAr ? "الإجمالي" : "Total"}</th>
                                        <th className="p-2.5 text-center w-10"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-900/30">
                                      {returnItems.map((ritem, rIdx) => (
                                        <tr key={rIdx} className="bg-slate-900/60">
                                          <td className="p-1.5">
                                            <input
                                              type="text"
                                              placeholder="Barcode"
                                              value={ritem.barcode}
                                              onChange={(e) => handleReturnItemChange(rIdx, 'barcode', e.target.value)}
                                              className="w-full p-1.5 rounded bg-slate-800 text-xs border border-slate-700 text-white"
                                            />
                                          </td>
                                          <td className="p-1.5">
                                            <input
                                              type="text"
                                              placeholder={isAr ? "اسم الصنف المرتجع" : "Item description"}
                                              value={ritem.itemName}
                                              onChange={(e) => handleReturnItemChange(rIdx, 'itemName', e.target.value)}
                                              className="w-full p-1.5 rounded bg-slate-800 text-xs border border-slate-700 text-white"
                                            />
                                          </td>
                                          <td className="p-1.5">
                                            <input
                                              type="number"
                                              min="1"
                                              value={ritem.quantity}
                                              onChange={(e) => handleReturnItemChange(rIdx, 'quantity', e.target.value)}
                                              className="w-full p-1.5 rounded bg-slate-800 text-xs border border-slate-700 text-center font-bold text-white"
                                            />
                                          </td>
                                          <td className="p-1.5">
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={ritem.unitPrice}
                                              onChange={(e) => handleReturnItemChange(rIdx, 'unitPrice', e.target.value)}
                                              className="w-full p-1.5 rounded bg-slate-800 text-xs border border-slate-700 text-right font-bold text-white"
                                            />
                                          </td>
                                          <td className="p-1.5 text-right font-mono font-black text-amber-400">
                                            {(ritem.totalPrice || 0).toFixed(2)}
                                          </td>
                                          <td className="p-1.5 text-center">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveReturnItem(rIdx)}
                                              className="p-1 text-red-400 hover:bg-red-950/50 rounded transition-colors cursor-pointer"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Net Payout Real-Time Accounting Reconciliation Banner */}
                            {(() => {
                              const gross = parseFloat(paymentAmount) || 0;
                              const ret = parseFloat(returnAmount) || 0;
                              const net = Math.max(0, gross - ret);
                              const isOverLimit = ret > gross && gross > 0;

                              return (
                                <div className={`p-4 rounded-2xl border transition-all ${isOverLimit ? 'bg-red-950/40 border-red-500' : 'bg-gradient-to-r from-slate-900 to-indigo-950/40 text-white border-slate-700 shadow-xl'}`}>
                                  {isOverLimit ? (
                                    <div className="flex items-center gap-3 text-red-400">
                                      <AlertTriangle size={22} className="shrink-0" />
                                      <div>
                                        <p className="font-black text-sm">{isAr ? "تنبيه: قيمة المرتجع تتجاوز إجمالي المبلغ المسدد!" : "Warning: Return exceeds payment amount!"}</p>
                                        <p className="text-xs text-red-300/80">{isAr ? "يرجى تعديل قيمة المرتجع لتكون أقل من أو تساوي المبلغ المراد سداده." : "Adjust return amount to be less than or equal to settlement amount."}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                      <div className="space-y-1 text-center sm:text-right">
                                        <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">
                                          {isAr ? "المعادلة المحاسبية للتسوية والسداد" : "Accounting Settlement Formula"}
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap text-sm font-bold font-mono justify-center sm:justify-start">
                                          <span className="text-slate-300">{isAr ? "إجمالي سداد الدين:" : "Gross Settled:"} EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                          <span className="text-amber-400">- {isAr ? "مرتجع RTV:" : "RTV:"} EGP {ret.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                          <span className="text-emerald-400">= {isAr ? "الصافي النقدي المنصرف:" : "Net Cash Paid:"} EGP {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      </div>
                                      <div className="text-center sm:text-left shrink-0 bg-[#0B1121] px-4 py-2.5 rounded-xl border border-emerald-500/40 shadow-inner">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">{isAr ? "الصافي المنصرف من الخزينة" : "Net Safe Outflow"}</span>
                                        <span className="text-xl font-black font-mono text-emerald-400">
                                          EGP {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/60 mt-auto">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-bold hover:bg-slate-700 hover:text-white transition-all shadow-sm cursor-pointer">{isAr ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all cursor-pointer">
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    {isAr ? "تأكيد التحصيل" : "Confirm Payment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddSupplier && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0B1121] text-slate-100 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-800 flex flex-col max-h-[95vh] overflow-y-auto custom-scrollbar"
              dir={isAr ? "rtl" : "ltr"}
            >
              <h3 className="text-xl font-black text-white mb-4 tracking-tight">{isAr ? "إضافة مورد جديد" : "Add New Supplier"}</h3>
              <input 
                type="text" 
                value={newSupplierName} 
                onChange={(e) => setNewSupplierName(e.target.value)} 
                placeholder={isAr ? "مثال: كوكاكولا مصر" : "e.g. COCA COLA EG"} 
                className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-white placeholder:text-slate-500 font-medium mb-6 outline-none" 
                autoFocus 
              />
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowAddSupplier(false)} 
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button 
                  onClick={handleAddSupplier} 
                  disabled={!newSupplierName.trim()} 
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  {isAr ? "حفظ المورد" : "Save Supplier"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedCreditForPoUpload && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0B1121] text-slate-100 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh]"
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/60">
                <h2 className="text-xl font-black text-white tracking-tight">{isAr ? "إضافة أمر شراء للدين" : "Add PO to Credit"}</h2>
                <button 
                  onClick={() => setSelectedCreditForPoUpload(null)} 
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                <p className="text-sm text-slate-400 mb-6 font-medium">
                  {isAr 
                    ? "قم برفع أو سحب أو لصق صورة أمر الشراء. سيتم استخراج الأصناف وتحديثها تلقائياً بالذكاء الاصطناعي." 
                    : "Upload, drag-and-drop, or paste a purchase order image. We'll automatically extract the products and sync them with the catalog."}
                </p>

                <div 
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${uploadingPoToOldCredit ? 'border-indigo-500 bg-indigo-950/40' : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-900/60'}`}
                >
                  {uploadingPoToOldCredit ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-indigo-400">
                      <Loader2 className="h-10 w-10 animate-spin" />
                      <span className="font-bold text-lg text-white">{isAr ? "جاري معالجة المستند..." : "Processing Document..."}</span>
                      <span className="text-sm text-indigo-400">{isAr ? "استخراج الأصناف ومطابقتها..." : "Extracting details and syncing items..."}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <ImageIcon className="h-12 w-12 text-slate-500" />
                      <span className="font-bold text-lg text-white">{isAr ? "اسحب صورة امر الشراء هنا" : "Paste or Drop PO Image Here"}</span>
                      <span className="text-sm text-slate-400">{isAr ? "اضغط Ctrl+V / Cmd+V للصق مباشرة" : "Cmd+V / Ctrl+V to paste directly"}</span>
                      <button
                        type="button"
                        onClick={handlePastePoImageButtonClick}
                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors text-sm border border-slate-700 cursor-pointer"
                      >
                        <ClipboardPaste size={18} />
                        {isAr ? "لصق من الحافظة" : "Paste from Clipboard"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* View Items Modal - Tear-off Digital Receipt */}
    <AnimatePresence>
      {selectedCreditForView && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          
          <div className="relative w-full max-w-2xl flex flex-col items-center">
            {/* Printer Slot Hardware */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="w-[102%] h-6 bg-slate-800 dark:bg-black rounded-full z-50 relative flex items-center justify-center shadow-2xl border-b-2 border-slate-900"
              style={{ boxShadow: 'inset 0px -4px 6px rgba(0,0,0,0.4), 0 10px 15px -3px rgba(0,0,0,0.3)' }}
            >
              <div className="w-[98%] h-2 bg-black rounded-full" style={{ boxShadow: 'inset 0 4px 4px rgba(0,0,0,0.9)' }} />
              {/* Printing light indicator */}
              <motion.div 
                animate={{ opacity: [0.2, 1, 0.2] }} 
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="absolute right-4 w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" 
              />
            </motion.div>

            <motion.div 
              initial={{ clipPath: 'inset(0% -10% 100% -10%)', y: -20, opacity: 0.8 }}
              animate={{ clipPath: 'inset(-10% -10% -10% -10%)', y: 0, opacity: 1 }}
              exit={{ clipPath: 'inset(0% -10% 100% -10%)', y: -20, opacity: 0, transition: { duration: 0.3 } }}
              transition={{ 
                duration: 2.2, 
                ease: "linear", 
                opacity: { duration: 0.2 } 
              }}
              className="relative w-full flex flex-col -mt-2"
            >
            
            {/* Tear-off Top Edge */}
            <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(-45deg, transparent 12px, #ffffff 0), linear-gradient(45deg, transparent 12px, #ffffff 0)' }} className="w-full absolute -top-[15px] left-0 right-0 z-10 drop-shadow-sm block dark:hidden" />
            <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(-45deg, transparent 12px, #0f172a 0), linear-gradient(45deg, transparent 12px, #0f172a 0)' }} className="w-full absolute -top-[15px] left-0 right-0 z-10 drop-shadow-sm hidden dark:block" />

            {/* Receipt Body */}
            <div className="bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col relative z-20" dir={isAr ? "rtl" : "ltr"}>
              
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <FileText className="text-blue-500" size={24} /> {isAr ? "إيصال الآجل والمديونية" : "Credit Receipt"}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">
                    {selectedCreditForView.companyName} • {new Date(selectedCreditForView.createdAt?.toDate ? selectedCreditForView.createdAt.toDate() : selectedCreditForView.createdAt || Date.now()).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
                    {selectedCreditForView.poNumber && ` • PO: ${selectedCreditForView.poNumber}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                    <button
                      onClick={() => {
                        const c = selectedCreditForView;
                        setSelectedCreditForView(null);
                        handleOpenEditCredit(c);
                      }}
                      className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer mr-1"
                    >
                      <Pencil size={14} /> {isAr ? "تعديل الفاتورة" : "Edit Invoice"}
                    </button>
                  )}
                  {selectedCreditForView.poUrl && (
                    <a 
                      href={selectedCreditForView.poUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mr-2"
                    >
                      <ImageIcon size={14} /> {isAr ? "عرض الصورة" : "View Image"}
                    </a>
                  )}
                  <button 
                    onClick={() => setSelectedCreditForView(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                {/* Audit Trail / Edit History */}
                {selectedCreditForView.isEdited && selectedCreditForView.editHistory && selectedCreditForView.editHistory.length > 0 && (
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4.5 mb-4 shadow-xs">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black">
                        <Pencil size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                          {isAr ? "سجل التعديلات (Audit Log)" : "Audit Trail / Modification History"}
                        </h4>
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium">
                          {isAr 
                            ? `تم التعديل بواسطة ${selectedCreditForView.lastEditedBy || 'Admin'} في ${new Date(selectedCreditForView.lastEditedAt!).toLocaleString('ar-EG')}`
                            : `Last edited by ${selectedCreditForView.lastEditedBy || 'Admin'} on ${new Date(selectedCreditForView.lastEditedAt!).toLocaleString()}`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedCreditForView.editHistory.map((hist: any, hIdx: number) => (
                        <div key={hIdx} className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-3 border border-amber-100 dark:border-amber-900/30 text-xs">
                          <div className="flex justify-between items-center mb-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                            <span>👤 {hist.editedBy || "Admin"}</span>
                            <span>🕒 {new Date(hist.editedAt).toLocaleString(isAr ? "ar-EG" : "en-US")}</span>
                          </div>
                          <div className="space-y-1">
                            {hist.changes && hist.changes.length > 0 ? (
                              hist.changes.map((ch: string, cIdx: number) => (
                                <div key={cIdx} className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                  <span>{ch}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-700 dark:text-slate-200 font-medium">{hist.summary || "Modified"}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "الشركة / المورد" : "Company / Supplier"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedCreditForView.companyName}>{selectedCreditForView.companyName}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "التاريخ" : "Date"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{new Date(selectedCreditForView.createdAt?.toDate ? selectedCreditForView.createdAt.toDate() : selectedCreditForView.createdAt || Date.now()).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "تاريخ التحصيل المتوقع" : "Collection Date"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedCreditForView.collectionDate || (isAr ? "غير متاح" : "N/A")}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "خاضع للضريبة" : "Taxable"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
                      {selectedCreditForView.isTaxable ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No")}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "إجمالي المبلغ المستحق" : "Total Amount Due"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedCreditForView.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "قيمة الضريبة" : "Tax Amount"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedCreditForView.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم الفاتورة" : "Invoice Number"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedCreditForView.invoiceNumber || (isAr ? "غير متاح" : "N/A")}>{selectedCreditForView.invoiceNumber || (isAr ? "غير متاح" : "N/A")}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم أمر الشراء (PO)" : "PO Number"}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedCreditForView.poNumber || (isAr ? "غير متاح" : "N/A")}>{selectedCreditForView.poNumber || (isAr ? "غير متاح" : "N/A")}</p>
                  </div>
                </div>

            {(() => {
              const urls = selectedCreditForView.poUrls && selectedCreditForView.poUrls.length > 0 
                ? selectedCreditForView.poUrls 
                : (selectedCreditForView.poUrl ? [selectedCreditForView.poUrl] : []);

              if (urls.length > 0) {
                return (
                  <div className="mb-8">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">{isAr ? "مرفقات فواتير / أمر شراء المورد" : "Supplier Invoice(s) / PO"}</h3>
                    <div className="flex flex-col gap-4">
                      {urls.map((url: string, index: number) => (
                        <div key={index} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm max-h-64 relative bg-slate-50 dark:bg-slate-900 flex justify-center items-center group">
                          <img 
                            src={url} 
                            alt={`Supplier Invoice Page ${index + 1}`} 
                            className="object-contain max-h-64 w-full"
                          />
                          <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-full text-white text-xs font-bold tracking-wider z-10">
                            {isAr ? `صفحة ${index + 1}` : `PAGE ${index + 1}`}
                          </div>
                          <a 
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2 w-full h-full z-20 cursor-pointer"
                          >
                            <ImageIcon size={20} /> {isAr ? `عرض الصفحة ${index + 1} كاملة` : `View Full Page ${index + 1}`}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div className="mb-8 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 text-center">{isAr ? "فاتورة المورد / أمر الشراء غير مرفق" : "Missing Supplier Invoice / PO"}</h3>
                  <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
                    <QRCode 
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/cashier/upload-invoice/${selectedCreditForView.id}?type=credit`} 
                      size={140}
                      level="H"
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-500 text-center max-w-xs">
                    {isAr ? "امسح كود QR بهاتفك أو قم بلصق صورة الفاتورة (Ctrl+V) لرفعها مباشرة." : "Scan this QR code with your phone or paste (Ctrl+V) an image to upload the missing invoice."}
                  </p>
                  {isPasting && (
                    <p className="text-xs text-indigo-500 font-bold mt-2 animate-pulse">{isAr ? "جاري رفع الصورة الملصقة..." : "Uploading pasted image..."}</p>
                  )}
                </div>
              );
            })()}

                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">{isAr ? `الأصناف والمحتويات (${selectedCreditForView.items?.length || 0})` : `Products / Items (${selectedCreditForView.items?.length || 0})`}</h3>
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">{isAr ? "الباركود" : "Barcode"}</th>
                        <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                        <th className="px-4 py-3 text-center">{isAr ? "الكمية" : "Qty"}</th>
                        <th className="px-4 py-3 text-right">{isAr ? "سعر الوحدة" : "Unit Price"}</th>
                        <th className="px-4 py-3 text-right">{isAr ? "الإجمالي" : "Total"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCreditForView.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 font-medium">
                          <td className="px-4 py-3 text-slate-500">{item.barcode || item.code || (isAr ? "غير متاح" : "N/A")}</td>
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{item.description || item.name || (isAr ? "غير متاح" : "N/A")}</td>
                          <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-300">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-300">{Number(item.price || item.unitPrice || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-300">{Number(item.total || (item.quantity * (item.price || item.unitPrice || 0))).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
              
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 mt-auto">
                 <button onClick={() => {
                    setSelectedCreditForPrint(selectedCreditForView);
                    setTimeout(() => handlePrintPdf(selectedCreditForView), 100);
                 }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer">
                   {isPrinting ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                   {isPrinting ? (isAr ? "جاري إنشاء PDF..." : "Generating PDF...") : (isAr ? "طباعة نسخة كاملة" : "Print All (Copy)")}
                 </button>
              </div>

            </div>

            {/* Tear-off Bottom Edge */}
            <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(45deg, transparent 12px, #ffffff 0), linear-gradient(-45deg, transparent 12px, #ffffff 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm block dark:hidden" />
            <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(45deg, transparent 12px, #0f172a 0), linear-gradient(-45deg, transparent 12px, #0f172a 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm hidden dark:block" />

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>

    {/* EDIT CREDIT MODAL (ADMIN ONLY) */}
    <AnimatePresence>
      {showEditCreditModal && editingCredit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl relative my-auto border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-amber-100 dark:border-amber-900/30 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-transparent dark:from-amber-950/20 dark:to-transparent" dir={isAr ? "rtl" : "ltr"}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                  <Pencil size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isAr ? "تعديل فاتورة الآجل (خاص بالإدارة)" : "Edit Credit Invoice (Admin Only)"}
                  </h2>
                  <p className="text-xs font-bold text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    {isAr ? "سيتم تسجيل وتتبع كافة التعديلات تلقائياً في سجل الرقابة" : "All modifications will be tracked automatically in the audit log"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowEditCreditModal(false); setEditingCredit(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditCredit} className="flex flex-col flex-1 min-h-0" dir={isAr ? "rtl" : "ltr"}>
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "التاريخ *" : "Date *"}
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "الشركة / المورد *" : "Company / Supplier *"}
                    </label>
                    <select
                      required
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="">{isAr ? "-- اختر المورد --" : "Select a supplier..."}</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {editCompanyName && !suppliers.some(s => s.name === editCompanyName) && (
                        <option value={editCompanyName}>{editCompanyName}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "المبلغ المستحق (قبل الضريبة) *" : "Amount Due (Before Tax) *"}
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={editAmountDue}
                      onChange={(e) => setEditAmountDue(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-black text-indigo-600 dark:text-indigo-400 text-lg outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "قيمة الضريبة" : "Tax Amount"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editTax}
                      onChange={(e) => setEditTax(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-lg outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                {/* Real-time Calculation Box */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                      <Calculator size={18} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                        {isAr ? "إجمالي المبلغ المستحق المعدل (شامل الضريبة)" : "Total Updated Due (Incl. Tax)"}
                      </span>
                      <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                        {(parseFloat(editTax) || 0) > 0 ? (
                          isAr 
                            ? `${(parseFloat(editAmountDue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(editTax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ضريبة`
                            : `${(parseFloat(editAmountDue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(editTax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tax`
                        ) : (
                          isAr ? "بدون ضريبة إضافية" : "No tax added"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      EGP {((parseFloat(editAmountDue) || 0) + (parseFloat(editTax) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "رقم الفاتورة" : "Invoice #"}
                    </label>
                    <input
                      type="text"
                      value={editInvoiceNumber}
                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "رقم أمر الشراء (PO)" : "PO #"}
                    </label>
                    <input
                      type="text"
                      value={editPoNumber}
                      onChange={(e) => setEditPoNumber(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "تاريخ التحصيل المتوقع" : "Expected Collection Date"}
                    </label>
                    <input
                      type="date"
                      value={editCollectionDate}
                      onChange={(e) => setEditCollectionDate(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editOnSalesOnly}
                        onChange={(e) => setEditOnSalesOnly(e.target.checked)}
                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                      />
                      {isAr ? "سداد من المبيعات فقط (Sales Only)" : "On Sales Only"}
                    </label>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowEditCreditModal(false); setEditingCredit(null); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-7 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      <Pencil size={16} />
                      {isAr ? "حفظ التعديلات" : "Save Changes"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* QR Upload Modal for Credit Record */}
    <AnimatePresence>
        {savedCreditForQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative"
            >
              <button
                onClick={() => setSavedCreditForQR(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                title={isAr ? "إغلاق للعودة للنظام" : "Close & return to system"}
              >
                <X size={18} />
              </button>

              <div className="p-6 text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                  <ImageIcon size={28} />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                  {isAr ? "إرفاق صورة الفاتورة الورقية" : "Attach Credit Paper Invoice"}
                </h2>
                <p className="text-xs text-slate-500 font-medium mb-4 max-w-[320px]">
                  {isAr
                    ? `امسح رمز QR بالهاتف أو اضغط زر اللصق من الحافظة (Ctrl+V) لشركة ${savedCreditForQR.companyName}`
                    : `Scan QR with phone or click button to paste invoice image from clipboard for ${savedCreditForQR.companyName}`}
                </p>

                <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 inline-block mb-4 shadow-sm">
                  <QRCode
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/cashier/upload-invoice/${savedCreditForQR.id}?type=credit`}
                    size={170}
                    level="H"
                  />
                </div>

                <input
                  type="file"
                  ref={qrFileInputRef}
                  onChange={handleQrFileSelected}
                  accept="image/*"
                  className="hidden"
                />

                <div className="w-full space-y-2 mb-2">
                  <button
                    onClick={handlePasteFromClipboardButton}
                    disabled={isPasting}
                    className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/20 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                  >
                    {isPasting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <ClipboardPaste className="w-4 h-4" />
                    )}
                    <span>
                      {isAr ? "لصق الفاتورة من الحافظة (Ctrl+V)" : "Paste Invoice from Clipboard (Ctrl+V)"}
                    </span>
                  </button>

                  <button
                    onClick={() => qrFileInputRef.current?.click()}
                    disabled={isPasting}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>{isAr ? "اختيار صورة الفاتورة من الجهاز" : "Select Invoice Image File"}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 mt-1 font-semibold flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                  {isPasting ? (isAr ? "جاري الرفع وإغلاق النافذة..." : "Uploading & returning to system...") : (isAr ? "يتم إغلاق النافذة والعودة للنظام فور اللصق" : "Modal closes & system resumes automatically upon pasting")}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    {selectedCreditForPrint && (() => {
      const cBranchStr = ((selectedCreditForPrint as any).branchId || (selectedCreditForPrint as any).storeId || currentBranch || "").toLowerCase();
      const isOlaBranch = cBranchStr.includes("ola") || cBranchStr.includes("koronfol");
      const companyNameDisplay = isOlaBranch ? "ANH Trade" : "El Masreya for Trade";
      const branchNameDisplay = isOlaBranch ? "Ola El Koronfol" : "El Alamein 4";
      const branchNameHeaderDisplay = isOlaBranch ? "CIRCLE K OLA EL KORONFOL" : "CIRCLE K EL-ALAMEIN 4";

      return (
      <div id="single-credit-print-wrapper" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div id="print-credit-container" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header like Shift Report */}
          <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>{branchNameHeaderDisplay}</h1>
                <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT APPROVAL REPORT</p>
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '60px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Auth</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#000', lineHeight: 1, whiteSpace: 'nowrap' }}>{selectedCreditForPrint.createdBy?.split('@')[0] || "SYS"}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">تقرير اعتماد فاتورة آجلة</span>
              </div>
            </div>
          </div>

          {/* Intro Text */}
          <div style={{ padding: '30px 30px 15px', textAlign: 'right', direction: 'rtl' }}>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#000', fontWeight: 'bold' }}>
              تُقر إدارة الفرع بأن الطلب الموضح أدناه قد تم تنفيذه وفق نظام الآجل، وذلك بناءً على الاتفاق المسبق مع المورد. وتفاصيل الطلب كالتالي:
            </p>
          </div>

          {/* 2x3 Grid Data */}
          <div style={{ padding: '0 30px', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
            <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
              {/* Row 1 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#f9f9f9' }}>
                <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Our Company</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم شركتنا</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{companyNameDisplay}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice Company</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم الشركة للفاتورة</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedCreditForPrint.companyName}</div>
                </div>
              </div>
              {/* Row 2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice #</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الفاتورة</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedCreditForPrint.invoiceNumber || '-'}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>PO #</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الأمر</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedCreditForPrint.poNumber || '-'}</div>
                </div>
              </div>
              {/* Row 3 */}
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Branch</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم الفرع</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{branchNameDisplay}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Date</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>التاريخ</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                    {new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Paragraph */}
          <div style={{ padding: '20px 30px', textAlign: 'center', direction: 'rtl', position: 'relative', zIndex: 10 }}>
            <p style={{ margin: '0 auto', fontSize: '13px', lineHeight: '1.8', color: '#000', fontWeight: 'bold', maxWidth: '650px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', border: '1px dashed #000' }}>
              أتعهد أنا مدير الفرع بأن هذه الفاتورة الآجلة تم اعتمادها بناءً على استلام البضائع أو الخدمات كاملة، وتخضع لسياسة التحصيل المتفق عليها مع الإدارة المالية.
            </p>
          </div>

          {/* Financial Section */}
          <div style={{ padding: '10px 30px', position: 'relative', zIndex: 10 }}>
            <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Financial Details & Collection Date</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead style={{ backgroundColor: '#fff', borderBottom: '1px solid #000' }}>
                  <tr>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Invoice Value <br/><span style={{ fontSize: '10px' }}>قيمة الفاتورة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Tax <br/><span style={{ fontSize: '10px' }}>الضريبة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Total <br/><span style={{ fontSize: '10px' }}>الإجمالي</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Taxable <br/><span style={{ fontSize: '10px' }}>خاضع للضريبة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Date of Collection <br/><span style={{ fontSize: '10px' }}>تاريخ التحصيل</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: '#fff' }}>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedCreditForPrint.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedCreditForPrint.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>EGP {Number(selectedCreditForPrint.amountDue + (selectedCreditForPrint.tax || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', textAlign: 'center', fontSize: '12px' }}>{selectedCreditForPrint.isTaxable ? '(Yes) نعم' : '(No) لا'}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>{selectedCreditForPrint.collectionDate || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Stamp */}
          <div style={{ padding: '0 30px', marginTop: '50px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '4px', position: 'relative', zIndex: 10, minHeight: '140px' }}>
              <div style={{ width: '40%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold' }}>
                  I officially approve this credit invoice for future payment as per the agreed terms.
                </p>
                <div>
                  <div style={{ position: 'relative', height: '40px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                    {selectedCreditForPrint.managerSignature ? (
                      <img src={selectedCreditForPrint.managerSignature} alt="Manager Signature" style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', maxHeight: '45px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ SIGNATURE ]
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>Manager Signature / توقيع المدير</p>
                </div>
              </div>

              <div style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {/* The specific blue stamp from the Shift Report */}
                <div style={{ 
                  border: '3px solid #000080', 
                  borderRadius: '4px', 
                  padding: '10px 15px', 
                  transform: 'rotate(-2deg)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontFamily: '"Arial Black", Impact, "Arial Rounded MT Bold", sans-serif',
                  opacity: 0.85,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,128,0.2), 0 0 0 1px rgba(0,0,128,0.2)'
                }}>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: '#000080', letterSpacing: '1px', lineHeight: 1.2 }}>Circle k</span>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: '#000080', letterSpacing: '0.5px', lineHeight: 1.2 }}>{branchNameDisplay}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Approved Stamp (placed in the large empty area at the bottom) */}
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyItems: 'flex-start', paddingLeft: '50px', minHeight: '180px' }}>
            <div style={{ transform: 'rotate(-10deg)', opacity: 0.85 }}>
              <div style={{ border: '5px solid #16a34a', borderRadius: '50%', width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#16a34a', backgroundColor: 'transparent', boxShadow: 'inset 0 0 0 2px rgba(22, 163, 74, 0.2), 0 0 0 2px rgba(22, 163, 74, 0.2)' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>APPROVED</span>
                <span style={{ fontSize: '18px', fontWeight: '900', borderBottom: '2px solid #16a34a', paddingBottom: '4px', marginBottom: '6px' }}>معتمد للآجل</span>
                <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>CREDIT INVOICE</span>
                <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px' }}>
                  {new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
            <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
              CREDIT ID: {selectedCreditForPrint.id} | PRINTED: {new Date().toLocaleString()} | AUTHORIZED: {selectedCreditForPrint.createdBy?.split('@')[0] || "SYS"}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE 1 OF 1</p>
          </div>

        </div>
      </div>
    ); })()}

    {/* Printable Single Payment Receipt Voucher */}
    {selectedPaymentForPrint && (() => {
      const { credit, payment } = selectedPaymentForPrint;
      const isOlaBranch = (credit.storeId || currentBranch || "").toLowerCase().includes("ola");
      const branchNameDisplay = isOlaBranch ? "Ola El Koronfol" : "El Alamein 4";
      const branchNameHeaderDisplay = isOlaBranch ? "CIRCLE K OLA EL KORONFOL" : "CIRCLE K EL-ALAMEIN 4";
      const totalDue = Number(credit.amountDue || 0) + Number(credit.tax || 0);
      const paidThisPayment = Number(payment.amount || 0);
      const isReturnDeducted = !!payment.hasReturn || Number(payment.returnDeductionAmount || 0) > 0;
      const returnDeduction = Number(payment.returnDeductionAmount || payment.returnDetails?.returnAmount || 0);
      const grossDebtSettled = Number(payment.grossAmount || payment.grossTotal || (paidThisPayment + returnDeduction));
      const cumulativePaid = Number(credit.paidAmount || 0);
      const remainingBalance = Math.max(0, totalDue - cumulativePaid);
      const refId = payment.id ? (payment.id.startsWith("settlement_") ? `SETTLE-${payment.id.slice(-6)}` : `PAY-${payment.id.slice(0, 8).toUpperCase()}`) : `PAY-${Date.now().toString().slice(-6)}`;
      const returnNumDisplay = payment.returnDetails?.returnNumber || payment.returnNumber || `RTV-${credit.invoiceNumber || (payment.id ? payment.id.slice(0, 6) : Date.now().toString().slice(-6))}`;
      const trNumDisplay = payment.returnDetails?.transferOutNumber || payment.returnTransferOutNumber || "";

      const qrValue = JSON.stringify({
        ref: refId,
        supplier: credit.companyName,
        inv: credit.invoiceNumber,
        paid: paidThisPayment,
        gross: grossDebtSettled,
        rtv: returnDeduction,
        date: payment.date || new Date().toISOString().split("T")[0],
        branch: branchNameDisplay,
        status: isReturnDeducted ? "OFFICIALLY_SETTLED_WITH_RTV" : "OFFICIALLY_SETTLED"
      });

      return (
        <div id="single-payment-print-wrapper" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          {/* Page 1: Official Credit Payment Receipt Voucher */}
          <div id="print-payment-container" className="print-page" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            
            {/* Official Header */}
            <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626' }}>
                  <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>{branchNameHeaderDisplay}</h1>
                  <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT PAYMENT RECEIPT VOUCHER</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '70px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>REF #</p>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#000', lineHeight: 1, fontFamily: 'monospace' }}>{refId}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }} dir="rtl">
                    {isReturnDeducted ? "إيصال سداد دين وتسوية مرتجع" : "إيصال سداد دفعة آجلة"}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Confirmation Text */}
            <div style={{ padding: '20px 30px 10px', textAlign: 'right', direction: 'rtl' }}>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#000', fontWeight: 'bold' }}>
                {isReturnDeducted
                  ? "تُقر إدارة الفرع بأنه قد تم تسوية المديونية المستحقة للمورد بموجب سداد نقدي ومقاصة مرتجع بضاعة معتمد (RTV) طبقاً للبيان المالي المعتمد أدناه:"
                  : "تُقر إدارة الفرع بأنه قد تم استلام وتسجيل دفعة السداد الموضحة تفاصيلها أدناه لصالح المورد المذكور، وتعتبر هذه الوثيقة إشعاراً رسمياً بالسداد والتسوية المالية:"}
              </p>
            </div>

            {/* Main Financial Payment Highlight Box */}
            <div style={{ padding: '0 30px', marginBottom: '15px' }}>
              {isReturnDeducted ? (
                <div style={{ border: '2px solid #000', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#000', borderBottom: '1.5px solid #000' }}>
                        <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #000', width: '25%' }}>
                          إجمالي الدين المسدد<br /><span style={{ fontSize: '8px', color: '#666' }}>GROSS SETTLED DEBT</span>
                        </th>
                        <th style={{ padding: '8px 6px', fontWeight: '900', borderRight: '1px solid #000', width: '25%', backgroundColor: '#fffbeb', color: '#b45309' }}>
                          خصم مرتجع بضاعة RTV<br /><span style={{ fontSize: '8px', color: '#d97706' }}>LESS: RETURN DEDUCTION</span>
                        </th>
                        <th style={{ padding: '8px 6px', fontWeight: '900', borderRight: '1px solid #000', width: '25%', backgroundColor: '#f0fdf4', color: '#15803d' }}>
                          الصافي المنصرف نقداً<br /><span style={{ fontSize: '8px', color: '#166534' }}>NET CASH PAID</span>
                        </th>
                        <th style={{ padding: '8px 6px', fontWeight: '800', width: '25%' }}>
                          طريقة السداد / الحالة<br /><span style={{ fontSize: '8px', color: '#666' }}>METHOD / STATUS</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ backgroundColor: '#ffffff' }}>
                        <td style={{ padding: '10px 6px', borderRight: '1px solid #000', fontWeight: '700', fontSize: '14px', fontFamily: 'monospace' }}>
                          EGP {grossDebtSettled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 6px', borderRight: '1px solid #000', fontWeight: '900', fontSize: '15px', fontFamily: 'monospace', color: '#b45309', backgroundColor: '#fffbeb' }}>
                          - EGP {returnDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 6px', borderRight: '1px solid #000', fontWeight: '900', fontSize: '18px', fontFamily: 'monospace', color: '#15803d', backgroundColor: '#f0fdf4' }}>
                          EGP {paidThisPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 6px', fontWeight: '800', fontSize: '11px', color: '#16a34a' }}>
                          {payment.method ? String(payment.method).toUpperCase() : 'CASH / نقدي'}<br />
                          <span style={{ fontSize: '9px' }}>تسوية بعد المقاصة</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #16a34a', borderRadius: '8px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase', display: 'block' }}>Payment Amount / المبلغ المسدد</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#15803d', fontFamily: 'monospace', marginTop: '2px' }}>
                      EGP {paidThisPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase', display: 'block' }}>Payment Method / طريقة السداد</span>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#14532d', textTransform: 'uppercase', marginTop: '2px' }}>
                      {payment.method || 'CASH / نقدي'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tafqeet & Clearance Ribbons */}
            <div style={{ padding: '0 30px', marginBottom: '15px' }}>
              <div
                dir="rtl"
                style={{
                  backgroundColor: isReturnDeducted ? '#fffbeb' : '#f8fafc',
                  border: isReturnDeducted ? '1.5px dashed #f59e0b' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: isReturnDeducted ? '#92400e' : '#0f172a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: isReturnDeducted ? '#b45309' : '#dc2626' }}>
                      {isReturnDeducted ? 'الصافي المنصرف بالحروف: ' : 'المبلغ بالحروف: '}
                    </span>
                    <span>
                      فقط وقدره {numberToArabicWords(paidThisPayment)} جنيهاً مصرياً لا غير{isReturnDeducted ? ' (صافي بعد خصم المرتجع)' : ''}.
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    {isReturnDeducted ? `تم تسوية دين بقيمة: ${numberToArabicWords(grossDebtSettled)} ج.م` : ''}
                  </div>
                </div>
                {isReturnDeducted && (
                  <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #fcd34d', fontSize: '10px', color: '#b45309' }}>
                    <span>✓ مقاصة وتسوية مرتجع: </span>
                    <span>
                      تم خصم إشعار مرتجع بضاعة رسمي #{returnNumDisplay} {trNumDisplay ? `(إذن خروج: TR-${trNumDisplay})` : ''} بقيمة EGP {returnDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })} ج.م ومرفق بالصفحة التالية أصل إيصال المرتجع معتمداً.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Credit & Supplier Details Grid */}
            <div style={{ padding: '0 30px', marginBottom: '15px' }}>
              <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Row 1 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#f9f9f9' }}>
                  <div style={{ flex: 1, padding: '10px 15px', borderRight: '1px solid #000' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Supplier Company / المورد</span>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#000', display: 'block', marginTop: '2px' }}>{credit.companyName}</span>
                  </div>
                  <div style={{ flex: 1, padding: '10px 15px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Payment Date / تاريخ السداد</span>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#000', display: 'block', marginTop: '2px' }}>{payment.date || new Date().toISOString().split("T")[0]}</span>
                  </div>
                </div>
                {/* Row 2 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                  <div style={{ flex: 1, padding: '10px 15px', borderRight: '1px solid #000' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Invoice # / رقم الفاتورة</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>{credit.invoiceNumber || '-'}</span>
                  </div>
                  <div style={{ flex: 1, padding: '10px 15px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>PO # / رقم أمر الشراء</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>{payment.poNumber || credit.poNumber || '-'}</span>
                  </div>
                </div>
                {/* Row 3: Account Balance Position */}
                <div style={{ display: 'flex', backgroundColor: '#fcfcfc' }}>
                  <div style={{ flex: 1, padding: '10px 15px', borderRight: '1px solid #000' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Total Invoice Due</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#000' }}>EGP {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ flex: 1, padding: '10px 15px', borderRight: '1px solid #000' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Total Cumulative Paid</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a' }}>EGP {cumulativePaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ flex: 1, padding: '10px 15px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Remaining Balance</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: remainingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                      EGP {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stamp & Verification QR */}
            <div style={{ padding: '10px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <QRCode value={qrValue} size={64} level="M" />
                <div>
                  <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace' }}>DOC ID: {refId}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#666' }}>SYSTEM VERIFIED TRANSACTION</p>
                </div>
              </div>

              <div style={{ transform: 'rotate(-5deg)', opacity: 0.9 }}>
                <div style={{ border: '4px solid #16a34a', borderRadius: '50%', width: '120px', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>PAID</span>
                  <span style={{ fontSize: '13px', fontWeight: '900', borderBottom: '1px solid #16a34a', paddingBottom: '2px', marginBottom: '2px' }}>تم السداد</span>
                  <span style={{ fontSize: '8px', fontWeight: 'bold' }}>{payment.date || new Date().toISOString().split("T")[0]}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: 'auto', padding: '15px 30px 25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
                <div style={{ width: '200px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '40px', fontWeight: 'bold' }}>Store Receiving Officer</p>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', margin: 0 }}>{payment.createdBy || credit.createdBy || "Authorized Officer"}</p>
                  </div>
                </div>

                <div style={{ width: '200px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '40px', fontWeight: 'bold' }}>Supplier Representative</p>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', margin: 0 }}>Receiver Signature</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: '15px', borderTop: '1px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '8px', color: '#555', fontFamily: 'monospace', margin: 0 }}>
                  TRANSACTION ID: {refId} | GENERATED: {new Date().toLocaleString()} | ANH ENTERPRISE PORTAL
                </p>
                <p style={{ fontSize: '9px', fontWeight: 'bold', margin: 0 }}>
                  PAGE 1 OF {isReturnDeducted ? (payment.bankTransferReceiptUrl ? 3 : 2) : (payment.bankTransferReceiptUrl ? 2 : 1)}
                </p>
              </div>
            </div>

          </div>

          {/* Page 2: Official Egyptian Arabic Full A4 Goods Return (RTV) Receipt */}
          {isReturnDeducted && (
            <div
              className="print-page"
              id={`credit-payment-${payment.id || 'new'}-return-receipt`}
              style={{
                width: '794px',
                minHeight: '1123px',
                padding: '40px',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                pageBreakInside: 'avoid',
                pageBreakAfter: 'always',
                overflow: 'hidden'
              }}
            >
              <ReturnReceiptContent
                data={{
                  ...(payment.returnDetails || {}),
                  supplier: credit.companyName,
                  branchId: credit.storeId || currentBranch,
                  storeId: credit.storeId || currentBranch,
                  totalPrice: returnDeduction,
                  returnNumber: returnNumDisplay,
                  transferOutNumber: trNumDisplay,
                  agentName: payment.returnDetails?.agentName || payment.supplierRepName || "",
                  agentNationalId: payment.returnDetails?.agentNationalId || payment.supplierNationalId || "",
                  agentMobile: payment.returnDetails?.agentMobile || "",
                  items: (payment.returnDetails?.items && payment.returnDetails.items.length > 0)
                    ? payment.returnDetails.items
                    : [{
                        barcode: "N/A",
                        itemName: payment.returnDetails?.reason || "بضاعة مرتجعة مخصومة من سداد المديونية بموجب إذن خروج",
                        quantity: 1,
                        unitPrice: returnDeduction,
                        totalPrice: returnDeduction
                      }],
                  settlementMethod: "money",
                  paymentTiming: "now",
                  isSettled: true,
                  settledByVoucher: credit.invoiceNumber || credit.id,
                  paymentVoucherNumber: credit.invoiceNumber || credit.id,
                  returnedAt: payment.returnDetails?.returnedAt || payment.date,
                  date: payment.date || new Date().toISOString().split("T")[0],
                }}
                currentBranch={currentBranch}
              />
            </div>
          )}

          {/* Page 3: Bank Transfer Receipt Attachment (if applicable) */}
          {payment.bankTransferReceiptUrl && (
            <div
              className="print-page"
              style={{
                width: '794px',
                minHeight: '1123px',
                padding: '40px',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                pageBreakInside: 'avoid',
                pageBreakAfter: 'avoid'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>BANK TRANSFER RECEIPT ATTACHMENT</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>Ref: {refId} | Supplier: {credit.companyName}</p>
                </div>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }} dir="rtl">مرفق إشعار التحويل البنكي</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #999', borderRadius: '8px', padding: '10px', backgroundColor: '#fafafa' }}>
                <img 
                  src={payment.bankTransferReceiptUrl} 
                  alt="Bank Transfer Receipt" 
                  style={{ maxHeight: '900px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}
        </div>
      );
    })()}

    {/* In-App Image Preview Modal */}
    {previewImage && (
      <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-[#0B1121] border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#070C18]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ImageIcon size={16} className="text-indigo-400" />
              {previewImage.title}
            </h3>
            <div className="flex items-center gap-2">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors"
                title="Open in new tab / Download"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/40">
            <img 
              src={previewImage.url} 
              alt={previewImage.title}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
            />
          </div>
        </div>
      </div>
    )}

    {selectedCreditForPrint && (() => {
      const urls = selectedCreditForPrint.poUrls && selectedCreditForPrint.poUrls.length > 0 
        ? selectedCreditForPrint.poUrls 
        : (selectedCreditForPrint.poUrl ? [selectedCreditForPrint.poUrl] : []);

      return urls.map((url: string, index: number) => (
        <div key={`invoice-page-${index}`} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id={`print-credit-invoice-page-${index}`} style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>Supplier Invoice {urls.length > 1 ? `(Page ${index + 1})` : ''}</h1>
                <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>Inv: {selectedCreditForPrint.invoiceNumber || 'N/A'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0 }}>مرفق الفاتورة</h1>
                <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>{selectedCreditForPrint.companyName}</p>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ccc', borderRadius: '12px', padding: '20px', backgroundColor: '#fafafa' }}>
              <img 
                src={url} 
                alt={`Supplier Invoice Full Page ${index + 1}`} 
                style={{ maxHeight: '900px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
              />
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '12px' }}>
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      ));
    })()}

    {selectedCreditForPrint && selectedCreditForPrint.items && selectedCreditForPrint.items.length > 0 && Array.from({ length: Math.ceil(selectedCreditForPrint.items.length / 22) }).map((_, pageIndex) => {
      const itemsChunk = selectedCreditForPrint.items!.slice(pageIndex * 22, (pageIndex + 1) * 22);
      const totalPages = Math.ceil(selectedCreditForPrint.items!.length / 22) + 1; // +1 for the main page
      const currentPageNum = pageIndex + 2;

      return (
        <div key={`items-page-${pageIndex}`} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id={`print-credit-items-page-${pageIndex}`} style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT APPROVAL REPORT (ITEMS)</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">ملحق الأصناف</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 30px', flexGrow: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', textAlign: 'left', fontSize: '11px', fontFamily: 'monospace' }}>
                <thead style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #000' }}>
                  <tr>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '5%' }}>#</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '25%' }}>Barcode</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '40%' }}>Description</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '10%', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '10%', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px', width: '10%', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsChunk.map((item: any, idx: number) => {
                    const globalIdx = pageIndex * 22 + idx + 1;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'center' }}>{globalIdx}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000' }}>{item.barcode || item.code || "-"}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', fontWeight: 'bold' }}>{item.description || item.name || "-"}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>{Number(item.price || item.unitPrice || 0).toFixed(2)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.total || (item.quantity * (item.price || item.unitPrice || 0))).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                CREDIT ID: {selectedCreditForPrint.id} | PRINTED: {new Date().toLocaleString()}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE {currentPageNum} OF {totalPages}</p>
            </div>
          </div>
        </div>
      );
    })}
    <AnimatePresence>
      {selectedSupplierData && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            onClick={() => setSelectedSupplierProfile(null)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-[70] border-l border-slate-200 dark:border-slate-800 flex flex-col"
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight flex items-center gap-2">
                <Building className="text-indigo-600" size={24} />
                {selectedSupplierData.name} Profile
              </h2>
              <button onClick={() => setSelectedSupplierProfile(null)} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Trust Score Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-inner ${selectedSupplierData.trustScore >= 80 ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : selectedSupplierData.trustScore >= 50 ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-red-500 bg-red-50 text-red-600'}`}>
                  <span className="text-2xl font-black">{selectedSupplierData.trustScore}%</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Trust Score</h3>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {selectedSupplierData.trustScore >= 80 ? 'Excellent Partner' : selectedSupplierData.trustScore >= 50 ? 'Average Partner' : 'High Risk Partner'}
                  </p>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 mb-8 h-64 flex flex-col">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Relationship Metrics</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={selectedSupplierData.radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Supplier" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Volume</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">EGP {selectedSupplierData.totalVolume.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Current Debt</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">EGP {selectedSupplierData.totalDebt.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm col-span-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Average Payment Speed</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{selectedSupplierData.avgDaysToPay} Days</p>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

      {/* Hidden Bulk Print Render Container for Credits */}
      {bulkCreditsForPrint.length > 0 && (
        <div id="bulk-credit-print-wrapper" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -9999, pointerEvents: 'none' }}>
          {/* Cover Page */}
          <div id="pdf-bulk-cover-credits" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0', textTransform: 'uppercase' }}>BULK CREDITS EXPORT</h1>
              <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>Generated: {new Date().toLocaleString()}</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', padding: '20px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Credits Included</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{bulkCreditsForPrint.length}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Outstanding Due</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#eab308' }}>
                  EGP {bulkCreditsForPrint.reduce((acc, c) => acc + (c.amountDue + c.tax - c.paidAmount), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Supplier</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Ref (Inv / PO)</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {bulkCreditsForPrint.map((c, idx) => {
                   const total = c.amountDue + c.tax;
                   const remaining = total - c.paidAmount;
                   return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px' }}>{idx + 1}</td>
                    <td style={{ padding: '10px' }}>{c.date}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{c.companyName}</td>
                    <td style={{ padding: '10px' }}>{c.invoiceNumber || c.poNumber || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', textTransform: 'uppercase' }}>{c.status}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                      {total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                      {remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Render individual credits & their invoices */}
          {bulkCreditsForPrint.map((c) => {
            const urls = c.invoiceUrls && c.invoiceUrls.length > 0 
              ? c.invoiceUrls 
              : (c.invoiceUrl ? [c.invoiceUrl] : []);

            return (
              <div key={`bulk-cred-${c.id}`}>
                <div id={`pdf-bulk-credit-${c.id}`} style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'absolute', top: '15px', right: '15px', border: '1px solid #ccc', padding: '5px', fontSize: '10px', fontWeight: 'bold', color: '#666', zIndex: 50, backgroundColor: '#fff' }}>
                    BULK PRINT: REF {c.id.substring(0, 8)}
                  </div>
                  {/* Standard Receipt Header */}
                  <div style={{ padding: '20px 30px 10px', display: 'flex', justifyItems: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                      </div>
                      <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                        <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT INVOICE RECORD</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                        <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">إشعار آجل</span>
                      </div>
                    </div>
                  </div>

                  {/* Body ... we will reuse a simplified version of the receipt layout */}
                  <div style={{ padding: '20px 30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                       <div>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Supplier Name / المورد</p>
                         <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{c.companyName}</p>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Date / التاريخ</p>
                         <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{c.date}</p>
                       </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                       <div>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Invoice Value / القيمة</p>
                         <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>EGP {Number(c.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                       <div>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Tax / الضريبة</p>
                         <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>EGP {Number(c.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Due / الإجمالي المستحق</p>
                         <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#eab308', fontFamily: 'monospace' }}>EGP {(Number(c.amountDue) + Number(c.tax || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                    </div>
                  </div>
                </div>

                {urls.map((url: string, index: number) => (
                  <div key={`bulk-cred-${c.id}-invoice-${index}`} id={`pdf-bulk-credit-${c.id}-invoice-${index}`} style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
                      <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>Supplier Invoice {urls.length > 1 ? `(Page ${index + 1})` : ''}</h1>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>Inv: {c.invoiceNumber || 'N/A'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0 }}>مرفق الفاتورة</h1>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>{c.companyName}</p>
                      </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ccc', borderRadius: '12px', padding: '20px', backgroundColor: '#fafafa' }}>
                      <img 
                        src={url} 
                        alt={`Supplier Invoice Full Page ${index + 1}`} 
                        style={{ maxHeight: '900px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

    </>
  );
}
