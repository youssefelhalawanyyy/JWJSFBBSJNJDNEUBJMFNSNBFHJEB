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

// Branch Corporate Metadata for Egyptian Commercial Law
export const getBranchLegalMetadata = (storeId?: string, currentBranch?: string) => {
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

export function LegalGuaranteeSlipContent({
  selectedForPrint,
  getBranchLegalInfo,
  numberToArabicWords,
  isPrint = false,
}: {
  selectedForPrint: any;
  getBranchLegalInfo?: (storeId?: string) => any;
  numberToArabicWords: (num: number) => string;
  isPrint?: boolean;
}) {
  if (!selectedForPrint) return null;

  const branchInfo = getBranchLegalInfo 
    ? getBranchLegalInfo(selectedForPrint.storeId) 
    : getBranchLegalMetadata(selectedForPrint.storeId);

  const amountNum = Number(selectedForPrint.amount || 0);
  const tafqeet = numberToArabicWords(amountNum);
  const creditLimitNum = selectedForPrint.creditLimit ? Number(selectedForPrint.creditLimit) : 0;

  return (
    <div 
      className={`w-full bg-white text-black flex flex-col justify-between select-none box-border border-[2.5px] border-black p-3.5 ${
        isPrint ? "h-[285mm] max-h-[285mm]" : "min-h-[1050px]"
      }`}
      style={{
        boxSizing: "border-box",
        fontFamily: "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      }}
      dir="rtl"
    >
      <div className="border border-black p-3 h-full flex flex-col justify-between box-border">
        
        {/* 1. Official National & Corporate Header */}
        <div className="shrink-0 border-b-2 border-black pb-2">
          <div className="grid grid-cols-12 items-center gap-2">
            
            {/* Right: State & Entity */}
            <div className="col-span-4 text-right space-y-0.5">
              <p className="text-xs font-black text-black">جمهورية مصر العربية</p>
              <p className="text-[9px] text-gray-700">وزارة التموين والتجارة الداخلية - مصلحة السجل التجاري</p>
              <p className="text-[11px] font-bold text-black">{branchInfo.companyNameAr}</p>
              <p className="text-[9.5px] text-gray-800">{branchInfo.branchTitleAr}</p>
              <p className="text-[8.5px] text-gray-600 font-mono">
                سجل تجاري: {branchInfo.commReg} | بطاقة ضريبية: {branchInfo.taxId}
              </p>
            </div>

            {/* Center: Legal Deed Official Seal Emblem */}
            <div className="col-span-4 flex flex-col items-center justify-center text-center">
              <div className="border-2 border-black rounded-xl px-3 py-1 bg-gray-50 flex flex-col items-center justify-center shadow-xs w-full max-w-[210px]">
                <div className="flex items-center gap-1.5 text-[10.5px] font-black text-black">
                  <Scale className="w-3.5 h-3.5 text-black" />
                  <span>سند تجاري وقانوني رسمي</span>
                </div>
                <span className="text-[10px] font-black text-rose-800 mt-0.5">
                  سند استلام شيك ضمان بنكي مشروط
                </span>
                <span className="text-[7.5px] font-mono tracking-widest text-gray-600 uppercase">
                  OFFICIAL GUARANTEE DEED
                </span>
              </div>
              <p className="text-[8px] text-gray-600 mt-1 font-semibold">
                توكيل سيركل كي مصر - الدائرة المالية
              </p>
            </div>

            {/* Left: Metadata & QR Verification */}
            <div className="col-span-4 flex items-center justify-end gap-2">
              <div className="text-left text-[9px] font-mono leading-tight space-y-0.5">
                <p className="font-bold text-black">
                  REF: CHQ-{selectedForPrint.chequeNumber || selectedForPrint.id?.slice(0, 8)?.toUpperCase()}
                </p>
                <p className="text-gray-800">
                  DATE: {selectedForPrint.chequeDate || new Date().toISOString().substring(0, 10)}
                </p>
                <p className="text-emerald-800 font-bold text-[8.5px]">
                  TYPE: أمانة وضمان تجاري مقيد
                </p>
                <p className="text-[8px] text-gray-500">
                  STATUS: ساري ومقيد بحساب
                </p>
              </div>
              <div className="p-1 border border-black rounded bg-white shrink-0 shadow-xs">
                <QRCode 
                  value={`CHQ-${selectedForPrint.chequeNumber || selectedForPrint.id}-${selectedForPrint.amount}-${selectedForPrint.bankName}`} 
                  size={44} 
                />
              </div>
            </div>

          </div>
        </div>

        {/* 2. Official Deed Title Banner */}
        <div className="shrink-0 my-1.5 border-2 border-black bg-gray-100 text-black py-1.5 px-3 rounded text-center shadow-xs">
          <h1 className="text-xs font-black tracking-wide text-black">
            إقرار وسند استلام شيك بنكي مسحوب على سبيل أمانة الضمان التجاري والائتماني
          </h1>
          <p className="text-[8.5px] font-bold text-gray-700 font-sans mt-0.5">
            صادر وموثق طبقاً لأحكام قانون التجارة المصري رقم 17 لسنة 1999، والقانون المدني، والمادة 341 من قانون العقوبات
          </p>
        </div>

        {/* 3. Contracting Parties Legal Identity Cards (Two Columns) */}
        <div className="shrink-0 grid grid-cols-2 gap-2 text-[9.5px] leading-tight">
          {/* First Party (Drawer) */}
          <div className="border border-black rounded p-2 bg-gray-50/80">
            <div className="font-black text-[10px] text-black border-b border-gray-300 pb-1 mb-1 flex items-center justify-between">
              <span>الطرف الأول (الساحب / المدين الائتماني):</span>
              <span className="text-[8px] bg-gray-200 px-1.5 py-0.2 rounded text-gray-800 font-bold">جهة التحرير</span>
            </div>
            <div className="space-y-0.5">
              <p><strong>اسم المنشأة: </strong>{branchInfo.companyNameAr}</p>
              <p><strong>الفرع والنشاط: </strong>{branchInfo.branchTitleAr}</p>
              <p><strong>السجل التجاري: </strong><span className="font-mono font-bold">{branchInfo.commReg}</span> | <strong>البطاقة الضريبية: </strong><span className="font-mono font-bold">{branchInfo.taxId}</span></p>
              <p><strong>المقر التجاري: </strong>{branchInfo.address}</p>
              <p><strong>الممثل القانوني: </strong>{branchInfo.managerTitle}</p>
            </div>
          </div>

          {/* Second Party (Beneficiary / Supplier) */}
          <div className="border border-black rounded p-2 bg-gray-50/80">
            <div className="font-black text-[10px] text-black border-b border-gray-300 pb-1 mb-1 flex items-center justify-between">
              <span>الطرف الثاني (المستفيد / الدائن ومندوب الاستلام):</span>
              <span className="text-[8px] bg-gray-200 px-1.5 py-0.2 rounded text-gray-800 font-bold">جهة الاستلام</span>
            </div>
            <div className="space-y-0.5">
              <p><strong>الشركة المستفيدة (الموردة): </strong><span className="font-bold">{selectedForPrint.receiverCompanyName || "الشركة الموردة المعتمدة"}</span></p>
              <p><strong>المندوب المستلم (رباعي): </strong><span className="font-bold">{selectedForPrint.receiverName || "مندوب التوريد المفوض"}</span></p>
              <p><strong>الرقم القومي (14 رقماً): </strong><span className="font-mono font-bold tracking-wider">{selectedForPrint.nationalId || ".............................."}</span></p>
              <p><strong>الصفة والتفويض: </strong>مندوب تسليم وتوريد مفوض باستلام الشيك والتحصيل</p>
              <p className="truncate"><strong>ملاحظات التوريد: </strong>{selectedForPrint.notes || "تغطية توريدات البضائع بموجب أوامر التوريد المعتمدة"}</p>
            </div>
          </div>
        </div>

        {/* 4. Cheque & Banking Guarantee Specifications Table */}
        <div className="shrink-0 border-2 border-black rounded overflow-hidden text-[9.5px]">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-black bg-gray-100">
                <td className="p-1.5 border-l border-black font-bold text-gray-700 w-1/4">رقم الشيك البنكي:</td>
                <td className="p-1.5 border-l border-black font-mono font-black text-sm text-black w-1/4">
                  {selectedForPrint.chequeNumber}
                </td>
                <td className="p-1.5 border-l border-black font-bold text-gray-700 w-1/4">البنك المسحوب عليه:</td>
                <td className="p-1.5 font-bold text-black w-1/4">
                  {selectedForPrint.bankName}
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1.5 border-l border-black font-bold text-gray-700">تاريخ تحرير الشيك:</td>
                <td className="p-1.5 border-l border-black font-mono font-bold text-black">
                  {selectedForPrint.chequeDate}
                </td>
                <td className="p-1.5 border-l border-black font-bold text-gray-700">قيمة الشيك بالأرقام:</td>
                <td className="p-1.5 font-mono font-black text-sm text-black">
                  EGP {amountNum.toLocaleString()} ج.م
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-50/60">
                <td className="p-1.5 border-l border-black font-bold text-gray-700">الحد الائتماني المغطى:</td>
                <td className="p-1.5 border-l border-black font-mono font-bold text-black">
                  {creditLimitNum > 0 ? `EGP ${creditLimitNum.toLocaleString()} ج.م` : "حد التوريد الآجل المعتمد"}
                </td>
                <td className="p-1.5 border-l border-black font-bold text-gray-700">طبيعة وسند الشيك:</td>
                <td className="p-1.5 font-bold text-rose-800">
                  شيك أمانة وضمان تجاري مقيد (غير قابل للصرف الفوري)
                </td>
              </tr>
              <tr className="bg-gray-100">
                <td className="p-1.5 border-l border-black font-bold text-gray-700">المبلغ بالحروف والتفقيط:</td>
                <td colSpan={3} className="p-1.5 font-black text-black text-[10px]">
                  فقط وقدره {tafqeet}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 5. The 6 Strict Legal Articles */}
        <div className="shrink-0 border border-black rounded p-2 text-[8px] leading-relaxed space-y-1 text-justify bg-white">
          <p className="font-black text-[9px] text-black border-b border-gray-300 pb-0.5 flex items-center justify-between">
            <span>البنود والشروط القانونية الحاكمة والمحكمة (وفقاً لأحكام قانون التجارة المصري رقم 17 لسنة 1999 والقانون المدني وقانون العقوبات):</span>
            <span className="text-[7.5px] font-bold text-slate-500">سند أمانة وضمان قطعي</span>
          </p>
          <p>
            <strong>المادة الأولى (صفة الأمانة والضمان الائتماني): </strong>
            يقر الطرف الثاني (الشركة المستفيدة ومندوبها المفوض بالاستلام والتوقيع) بأن هذا الشيك البنكي قد سُلِّم إليه على سبيل <strong>الأمانة والوديعة والضمان والتأمين التجاري فقط</strong> لتغطية وتأمين الحد الائتماني الممنوح للطرف الأول لتوريد بضائع بالآجل، وأنه ليس شيكاً واجب الوفاء الفوري أو أداة سداد نقدي حال في تاريخه، ولا يمثل مديونية قائمة أو مستقلة بذاتها في ذمة الطرف الأول.
          </p>
          <p>
            <strong>المادة الثانية (حظر التقديم البنكي أو التظهير أو نقل الملكية للغير): </strong>
            يحظر حظراً باتاً وقاطعاً على الطرف الثاني تقديم هذا الشيك للبنك المسحوب عليه للصرف أو وضعه في غرفة المقاصة الإلكترونية أو تظهيره أو رهنه أو حوالة حقه لأي طرف ثالث، طالما أن التعامل التجاري بين الطرفين قائم ومستمر والطرف الأول منتظم في سداد فواتير البضائع المسلمة إليه طبقاً للمدد الائتمانية المقررة.
          </p>
          <p>
            <strong>المادة الثالثة (قصر المطالبة على العجز الفعلي بعد الإعذار الرسمي ومطابقة الحسابات): </strong>
            في حال حدوث أي توقف أو إخلال مثبت بالسداد من قبل الطرف الأول، يلتزم الطرف الثاني بإجراء مطابقة حسابية خطية وتوجيه إخطار كتابي رسمي بعلم الوصول للطرف الأول بمهلة سداد لا تقل عن 15 يوماً، ولا يجوز للطرف الثاني بأي حال من الأحوال المطالبة إلا بصافي قيمة العجز الفعلي للبضائع الموردة غير المسددة فقط بعد خصم كافة المرتجعات والدفعات النقدية والبنكية.
          </p>
          <p>
            <strong>المادة الرابعة (الالتزام الفوري برد أصل الشيك وسقوط حجيته): </strong>
            يلتزم الطرف الثاني برد وتسليم أصل هذا الشيك فوراً إلى الطرف الأول بمجرد انتهاء التعامل التجاري أو تقديم شيك ضمان بديل أو تصفية الحساب، ويُعد أي سداد بموجب إيصالات استلام أو تحويلات بنكية مسقطاً لأي التزام يغطيه هذا الشيك، ويعتبر الشيك لاغياً ومعدوم الأثر بمجرد الوفاء.
          </p>
          <p>
            <strong>المادة الخامسة (المسؤولية الجنائية والمدنية وخيانة الأمانة طبقاً للمادة 341 عقوبات): </strong>
            يقر الطرف الثاني بأن إيداع هذا الشيك لديه كان على سبيل الوديعة والأمانة لغرض الضمان الائتماني فقط، وأي استخدام أو تظهير أو صرف له خلافاً للغرض المخصص له يُعد جريمة خيانة أمانة واستعمال محرر في غير ما أُعد له معاقب عليها بنص المادة 341 من قانون العقوبات وقانون التجارة المصري رقم 17 لسنة 1999، ويتحمل المودع لديه المسؤولية الجنائية والمدنية والتعويض عن كافة الأضرار التجارية.
          </p>
          <p>
            <strong>المادة السادسة (الاختصاص القضائي والقوة الثبوتية): </strong>
            يُعد هذا السند حجة كتابية قطعية وملزمة لطرفيه وموقعيه، وتختص المحاكم الاقتصادية والتجارية بجمهورية مصر العربية بنظر أي نزاع قد ينشأ عنه، ويُعتبر توقيع وبصمة مندوب الطرف الثاني إقراراً رسمياً ملزماً ونافذاً في مواجهة الشركة الموردة.
          </p>
        </div>

        {/* 6. Signatures, Seals & Fingerprint Section (4 Dedicated Boxes) */}
        <div className="shrink-0 border-t-2 border-black pt-1.5">
          <div className="grid grid-cols-4 gap-2 text-[9px] leading-snug">
            {/* Box 1: Receiver info & Signature */}
            <div className="border border-black rounded p-1.5 flex flex-col justify-between h-28 bg-gray-50/50">
              <div>
                <p className="font-black text-[9px] text-black border-b border-gray-300 pb-0.5">المندوب المستلم (الطرف الثاني):</p>
                <p className="mt-1 truncate"><strong>الاسم: </strong>{selectedForPrint.receiverName || "................................"}</p>
                <p className="truncate"><strong>الرقم القومي: </strong><span className="font-mono font-bold">{selectedForPrint.nationalId || "........................"}</span></p>
                <p className="mt-0.5"><strong>التوقيع: </strong>................................</p>
              </div>
              <p className="text-[7.5px] text-gray-500 text-center">أقر باستلام أصل الشيك وخضوعه لبنود الضمان</p>
            </div>

            {/* Box 2: Receiver Right Thumbprint */}
            <div className="border border-black rounded p-1.5 flex flex-col justify-between h-28 bg-gray-50/50 text-center">
              <p className="font-black text-[9px] text-black border-b border-gray-300 pb-0.5">بصمة إبهام المستلم:</p>
              <div className="h-16 border-2 border-dashed border-gray-400 rounded flex flex-col items-center justify-center text-[8.5px] text-gray-500 bg-white">
                <span className="font-bold text-gray-700">بصمة إبهام اليد اليمنى</span>
                <span className="text-[7px] text-gray-400 font-mono">RIGHT THUMBPRINT</span>
              </div>
              <p className="text-[7.5px] text-gray-400">توثيق هوية المستلم بالبصمة الحية</p>
            </div>

            {/* Box 3: Supplier Official Seal */}
            <div className="border border-black rounded p-1.5 flex flex-col justify-between h-28 bg-gray-50/50 text-center">
              <p className="font-black text-[9px] text-black border-b border-gray-300 pb-0.5">خاتم الشركة الموردة:</p>
              <div className="h-16 border-2 border-dashed border-gray-400 rounded flex flex-col items-center justify-center text-[8.5px] text-gray-500 bg-white">
                <span className="font-bold text-gray-700">خاتم الشركة الموردة الرسمي</span>
                <span className="text-[7px] text-gray-400 font-mono">SUPPLIER OFFICIAL STAMP</span>
              </div>
              <p className="text-[7.5px] text-gray-400">ختم النسر / الختم التجاري للشركة</p>
            </div>

            {/* Box 4: Circle K Drawer Seal & Management Approval */}
            <div className="border border-black rounded p-1.5 flex flex-col justify-between h-28 bg-gray-50/50 text-center">
              <p className="font-black text-[9px] text-black border-b border-gray-300 pb-0.5">اعتماد وخاتم الساحب:</p>
              <div className="h-16 border-2 border-dashed border-gray-400 rounded flex flex-col items-center justify-center text-[8.5px] text-gray-500 bg-white">
                <span className="font-bold text-gray-800">خاتم المنشأة التجاري والضريبي</span>
                <span className="text-[7px] text-gray-500 font-mono">CR: {branchInfo.commReg} | TAX: {branchInfo.taxId}</span>
                <span className="text-[7px] font-bold text-rose-800 mt-0.5">إدارة الحسابات والمالية</span>
              </div>
              <p className="text-[7.5px] text-gray-400">صادر عن المنظومة المالية المعتمدة</p>
            </div>
          </div>
        </div>

        {/* 7. Security Ledger & Verification Footer */}
        <div className="shrink-0 border-t border-black pt-1 flex justify-between items-center text-[8px] text-gray-600 font-mono">
          <span>توثيق رسمي إلكتروني مشفر عبر منظومة Circle K Financial Verification Ledger</span>
          <span className="font-bold text-black font-sans">صفحة 1 من 1 (محرر رسمي كامل - A4)</span>
          <span>UID: SEC-{selectedForPrint.chequeNumber || selectedForPrint.id?.slice(0, 8)?.toUpperCase()} | {new Date().toISOString().replace('T', ' ').slice(0, 19)}</span>
        </div>

      </div>
    </div>
  );
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

    await new Promise(resolve => setTimeout(resolve, 400));
    let element = document.getElementById("pdf-legal-guarantee-slip");
    if (!element) {
      await new Promise(resolve => setTimeout(resolve, 400));
      element = document.getElementById("pdf-legal-guarantee-slip");
    }

    try {
      if (element) {
        const canvas = await html2canvas(element, { 
          scale: 2, 
          useCORS: true, 
          logging: false, 
          imageTimeout: 15000,
          backgroundColor: "#ffffff",
          windowWidth: 794,
          windowHeight: 1123,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          width: 794,
          height: 1123,
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        // Full A4 page in millimeters: 210 x 297 with zero margins for exact full page fit
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");
        pdf.save(`Guarantee_Cheque_${target.chequeNumber || target.id}.pdf`);
        toast.success("Legal Guarantee Cheque PDF downloaded (Full A4)!");
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
              <div className="p-6 overflow-y-auto bg-slate-950/80 flex justify-center items-start">
                <div className="w-full max-w-[794px] bg-white text-black rounded-xl shadow-2xl overflow-hidden p-6" dir="rtl">
                  <LegalGuaranteeSlipContent
                    selectedForPrint={selectedForPrint}
                    getBranchLegalInfo={getBranchLegalInfo}
                    numberToArabicWords={numberToArabicWords}
                    isPrint={false}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Printable Native Container for window.print() & PDF generation (Guaranteed Single A4 Page) */}
          <div 
            id="single-cheque-print-wrapper" 
            className="fixed top-0 left-0 -z-50 pointer-events-none print:z-[99999] print:pointer-events-auto bg-white text-black p-0 m-0"
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @page {
                size: A4 portrait;
                margin: 0mm !important;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 210mm !important;
                  height: 297mm !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #single-cheque-print-wrapper {
                  display: block !important;
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 210mm !important;
                  height: 297mm !important;
                  max-height: 297mm !important;
                  overflow: hidden !important;
                  page-break-after: avoid !important;
                  page-break-inside: avoid !important;
                  break-after: avoid !important;
                  break-inside: avoid !important;
                }
                #pdf-legal-guarantee-slip {
                  width: 210mm !important;
                  height: 297mm !important;
                  max-height: 297mm !important;
                  min-height: 297mm !important;
                  overflow: hidden !important;
                }
              }
            `}} />
            <div 
              id="pdf-legal-guarantee-slip" 
              className="w-[210mm] max-w-[210mm] mx-auto bg-white text-black font-sans text-right box-border select-none" 
              dir="rtl"
              style={{ 
                width: "210mm", 
                height: "297mm", 
                maxHeight: "297mm", 
                minHeight: "297mm", 
                boxSizing: "border-box", 
                padding: "6mm 8mm",
                overflow: "hidden" 
              }}
            >
              <LegalGuaranteeSlipContent
                selectedForPrint={selectedForPrint}
                getBranchLegalInfo={getBranchLegalInfo}
                numberToArabicWords={numberToArabicWords}
                isPrint={true}
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
