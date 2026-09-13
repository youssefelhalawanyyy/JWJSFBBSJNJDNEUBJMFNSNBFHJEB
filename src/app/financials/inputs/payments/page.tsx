"use client";

import QRCodeLib from "qrcode";

function numberToArabicWords(num: number): string {
  num = Math.floor(Math.abs(num));
  if (num === 0) return "صفر";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function getBelow100(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return tens[t];
    return ones[o] + " و" + tens[t];
  }

  function getBelow1000(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h === 0) return getBelow100(rest);
    const hText = hundreds[h] || "";
    if (rest === 0) return hText;
    const restText = getBelow100(rest);
    return restText ? hText + " و" + restText : hText;
  }

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push("مليار");
    else if (billions === 2) parts.push("ملياران");
    else if (billions >= 3 && billions <= 10) parts.push(getBelow100(billions) + " مليارات");
    else parts.push(getBelow1000(billions) + " مليار");
  }

  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(getBelow100(millions) + " ملايين");
    else parts.push(getBelow1000(millions) + " مليون");
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(getBelow100(thousands) + " آلاف");
    else parts.push(getBelow1000(thousands) + " ألف");
  }

  if (remainder > 0) {
    parts.push(getBelow1000(remainder));
  }

  return parts.join(" و");
}

function OfficialPaymentReceipt({
  payment,
  elementId = "pdf-receipt",
  qrUrl,
  currentBranch
}: {
  payment: any;
  elementId?: string;
  qrUrl?: string;
  currentBranch?: string;
}) {
  const pBranchStr = (payment.branchId || payment.storeId || currentBranch || "").toLowerCase();
  const isOlaBranch = pBranchStr.includes("ola") || pBranchStr.includes("koronfol");
  const companyNameDisplay = isOlaBranch ? "شركة إيه إن إتش تريد (ش.ذ.م.م)" : "الشركة المصرية للتجارة (ش.م.م)";
  const branchNameDisplay = isOlaBranch ? "Ola El Koronfol" : "El Alamein 4";
  const branchNameHeaderDisplay = isOlaBranch ? "CIRCLE K OLA EL KORONFOL" : "CIRCLE K EL-ALAMEIN 4";
  const branchNameArDisplay = isOlaBranch ? "علا القرنفل" : "العلمين 4";
  const crNumber = isOlaBranch ? "219405 / استثمار القاهرة" : "184920 / استثمار الإسكندرية";
  const taxNumber = isOlaBranch ? "618-932-147" : "542-108-392";
  const isBank = payment.method === 'bank_transfer' || payment.method === 'bank' || !!payment.bankTransferReceiptUrl;
  const paymentMethodLabelAr = isBank
    ? 'تحويل بنكي رسمي'
    : (payment.method === 'cheque' ? 'شيك بنكي معتمد' : 'نقداً من خزينة الفرع');
  const paymentMethodLabelEn = isBank
    ? 'BANK TRANSFER'
    : (payment.method === 'cheque' ? 'CASHIER CHEQUE' : 'CASH PAYMENT');
  const isReturnDeducted = !!payment.hasReturn || Number(payment.returnDeductionAmount || 0) > 0;
  const returnDeductionNum = Number(payment.returnDeductionAmount || 0);
  const grossInvoiceNum = Number(payment.grossAmount || (Number(payment.total || 0) + returnDeductionNum));
  const formattedGross = grossInvoiceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedReturnDeduction = returnDeductionNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedAmount = Number(payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedTax = Number(payment.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedTotal = Number(payment.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const voucherIdShort = payment.id ? payment.id.substring(0, 10).toUpperCase() : Date.now().toString().slice(-8);

  return (
    <div
      id={elementId}
      className="print-page"
      style={{
        width: '210mm',
        height: '297mm',
        maxHeight: '297mm',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Tahoma", Arial, sans-serif',
        boxSizing: 'border-box',
        padding: '8mm 10mm',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        pageBreakAfter: 'avoid',
        breakAfter: 'avoid'
      }}
    >
      {/* Watermark Security Seal (Ultra faint - Eco Ink) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-25deg)',
          opacity: 0.022,
          pointerEvents: 'none',
          zIndex: 0,
          textAlign: 'center',
          userSelect: 'none'
        }}
      >
        <div style={{ fontSize: '100px', fontWeight: '900', color: '#000000', lineHeight: 1 }}>CIRCLE K</div>
        <div style={{ fontSize: '34px', fontWeight: '800', color: '#000000', letterSpacing: '4px', marginTop: '10px' }}>OFFICIAL RELEASE • سند مبرئ للذمة</div>
      </div>

      {/* Outer Border Frame (Fills Full A4 Page) */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          border: '1.5px solid #0f172a',
          padding: '3px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            border: '1px solid #94a3b8',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 16px',
            boxSizing: 'border-box'
          }}
        >
          {/* 1. TOP EXECUTIVE HEADER */}
          <div style={{ paddingBottom: '10px', borderBottom: '1.5px solid #0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Brand Left */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '31%' }}>
                <div style={{ width: '46px', height: '46px', backgroundColor: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', lineHeight: 1, fontFamily: '"Arial Black", Impact, sans-serif' }}>K</span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#dc2626', letterSpacing: '0.5px', textTransform: 'uppercase' }}>CIRCLE K EGYPT</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', fontWeight: '800', color: '#0f172a' }}>{branchNameHeaderDisplay}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '9px', fontWeight: '700', color: '#64748b' }}>سلسلة متاجر ومحطات سيركل كيه - فرع {branchNameArDisplay}</p>
                </div>
              </div>

              {/* Document Title Center */}
              <div style={{ textAlign: 'center', width: '38%' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.25 }} dir="rtl">
                  {isBank ? 'سند تحويل بنكي ومخالصة مالية مبرئة للذمة' : 'سند صرف نقدي ومخالصة مالية مبرئة للذمة'}
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: '9px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {isBank ? 'OFFICIAL BANK TRANSFER VOUCHER & LEGAL RELEASE' : 'OFFICIAL CASH DISBURSEMENT VOUCHER & LEGAL CLEARANCE'}
                </p>
                <div style={{ display: 'inline-block', border: '1px solid #0f172a', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '9px', fontWeight: '800', padding: '2px 10px', borderRadius: '3px', marginTop: '4px', letterSpacing: '0.4px' }}>
                  طريقة السداد: {paymentMethodLabelAr} • أصل معتمد للحسابات
                </div>
              </div>

              {/* Legal Authority & Metadata Right */}
              <div style={{ width: '31%', textAlign: 'right', direction: 'rtl' }}>
                <p style={{ margin: 0, fontSize: '11.5px', fontWeight: '800', color: '#0f172a' }}>{companyNameDisplay}</p>
                <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#475569', fontWeight: '700' }}>س.ت: {crNumber} • ب.ض: {taxNumber}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '700' }}>رقم السند:</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', backgroundColor: '#f8fafc', padding: '2px 8px', borderRadius: '3px', border: '1px solid #cbd5e1' }}>
                    PAY-{voucherIdShort}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px', fontSize: '9.5px', fontWeight: '700', color: '#334155' }}>
                  <span>التاريخ: {payment.date}</span>
                  <span style={{ color: '#047857', fontWeight: '800' }}>• {paymentMethodLabelAr}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. INVOICE & VENDOR BENTO DOSSIER (CLEAN, SPACIOUS & LESS ZAHMA) */}
          <div style={{ display: 'flex', gap: '14px', width: '100%', minHeight: '175px' }}>
            {/* Beneficiary Details (Right Box in RTL) */}
            <div style={{ flex: 1, border: '1.5px solid #0f172a', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ borderBottom: '1.5px solid #0f172a', backgroundColor: '#f8fafc', color: '#0f172a', padding: '6px 12px', fontSize: '10.5px', fontWeight: '800', display: 'flex', justifyContent: 'space-between', direction: 'rtl' }}>
                <span>الجهة المستفيدة / بيانات الشركة الموردة والمستلم</span>
                <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '700' }}>PAYEE & SUPPLIER INFO</span>
              </div>
              <div style={{ padding: '10px 12px', direction: 'rtl', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '6px' }}>
                {/* COMPANY NAME - HIGH IMPACT CLARITY */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px' }}>
                  <span style={{ fontSize: '11px', color: '#475569', fontWeight: '800' }}>الشركة الموردة:</span>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.3px', textAlign: 'left' }}>
                    {payment.companyName || '—'}
                  </span>
                </div>
                {/* REPRESENTATIVE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '700' }}>
                    {isBank ? 'جهة التحويل / الصرف:' : 'المندوب المستلم:'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                    {isBank
                      ? (payment.supplierRepName || "التحويل للحساب البنكي الرسمي للمورد")
                      : (payment.supplierRepName || "مندوب الشركة المعتمد")}
                  </span>
                </div>
                {/* NATIONAL ID */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '700' }}>
                    {isBank ? 'طبيعة العملية:' : 'الرقم القومي:'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', fontFamily: isBank ? 'inherit' : 'monospace', color: '#0f172a' }}>
                    {isBank
                      ? (payment.supplierNationalId || "سداد إلكتروني معتمد بالحساب المؤسسي")
                      : (payment.supplierNationalId || "مرفق بالصورة")}
                  </span>
                </div>
                {/* ATTACHED NATIONAL ID NOTICE (NOT ATTACHED WHEN PAID BY BANK) */}
                {isBank ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '5px 10px' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#1e40af' }}>
                      ℹ️ سداد بنكي مؤسسي مباشر - لا يلزم بطاقة رقم قومي
                    </span>
                    <span style={{ fontSize: '8px', color: '#3b82f6', fontWeight: '800' }}>[ BANK DIRECT PAY • NO ID REQ ]</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '5px 10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>
                      ✓ مرفق معه صورة بطاقة الرقم القومي للمورد
                    </span>
                    <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '800' }}>[ ID COPY ATTACHED ]</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice & P.O. Details (Left Box in RTL) */}
            <div style={{ flex: 1, border: '1.5px solid #0f172a', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ borderBottom: '1.5px solid #0f172a', backgroundColor: '#f8fafc', color: '#0f172a', padding: '6px 12px', fontSize: '10.5px', fontWeight: '800', display: 'flex', justifyContent: 'space-between', direction: 'rtl' }}>
                <span>بيانات الفاتورة ومستندات التوريد والسداد</span>
                <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '700' }}>INVOICE & PAYMENT DETAILS</span>
              </div>
              <div style={{ padding: '10px 12px', direction: 'rtl', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '6px' }}>
                {/* INVOICE NUMBER - HIGH IMPACT CLARITY */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 10px' }}>
                  <span style={{ fontSize: '11px', color: '#475569', fontWeight: '800' }}>رقم الفاتورة الضريبية:</span>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', backgroundColor: '#ffffff', border: '1.5px solid #0f172a', padding: '2px 12px', borderRadius: '4px' }}>
                    {payment.invoiceNumber || '—'}
                  </span>
                </div>
                {/* PO NUMBER - HIGH IMPACT CLARITY */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '800' }}>رقم أمر التوريد (P.O.):</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '1px 8px', borderRadius: '3px' }}>
                    {payment.poNumber ? payment.poNumber : 'غير محدد (None)'}
                  </span>
                </div>
                {/* PAYMENT METHOD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '700' }}>طريقة السداد المعتمدة:</span>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: '#047857' }}>
                    {paymentMethodLabelAr} ({paymentMethodLabelEn})
                  </span>
                </div>
                {/* SAFE & CATEGORY */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '700' }}>خزينة الصرف / البند:</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#334155' }}>
                    {payment.category || 'مشتريات وبضائع'} • {isBank ? 'الحساب البنكي الرسمي' : `خزينة فرع ${branchNameArDisplay}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FINANCIAL SETTLEMENT TABLE */}
          <div style={{ border: '1.5px solid #0f172a', borderRadius: '4px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderBottom: '1.5px solid #0f172a' }}>
                  {isReturnDeducted ? (
                    <>
                      <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '22%' }}>
                        إجمالي الفاتورة الأصلية<br /><span style={{ fontSize: '8px', color: '#64748b' }}>GROSS INVOICE TOTAL</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '15%' }}>
                        ضريبة القيمة المضافة<br /><span style={{ fontSize: '8px', color: '#64748b' }}>VAT / TAX</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '23%', backgroundColor: '#fffbeb', color: '#b45309' }}>
                        خصم مرتجع بضاعة RTV<br /><span style={{ fontSize: '8px', color: '#d97706' }}>LESS: RETURN DEDUCTION</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '24%', backgroundColor: '#f1f5f9' }}>
                        الصافي المسدد والمنصرف<br /><span style={{ fontSize: '8px', color: '#0f172a' }}>NET CASH DISBURSED</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '800', width: '16%' }}>
                        حالة التسوية<br /><span style={{ fontSize: '8px', color: '#64748b' }}>SETTLEMENT STATUS</span>
                      </th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '22%' }}>
                        قيمة الفاتورة الصافية<br /><span style={{ fontSize: '8.5px', color: '#64748b' }}>NET INVOICE VALUE</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '18%' }}>
                        ضريبة القيمة المضافة<br /><span style={{ fontSize: '8.5px', color: '#64748b' }}>VAT / TAX AMOUNT</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '26%', backgroundColor: '#f1f5f9' }}>
                        إجمالي المسدد والمنصرف<br /><span style={{ fontSize: '8.5px', color: '#0f172a' }}>TOTAL DISBURSED AMOUNT</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '18%' }}>
                        طريقة السداد<br /><span style={{ fontSize: '8.5px', color: '#64748b' }}>PAYMENT METHOD</span>
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: '800', width: '16%' }}>
                        حالة السداد<br /><span style={{ fontSize: '8.5px', color: '#64748b' }}>SETTLEMENT STATUS</span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  {isReturnDeducted ? (
                    <>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13.5px', fontFamily: 'monospace' }}>
                        EGP {formattedGross}
                      </td>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13.5px', fontFamily: 'monospace' }}>
                        EGP {formattedTax}
                      </td>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '900', fontSize: '15px', fontFamily: 'monospace', color: '#b45309', backgroundColor: '#fffbeb' }}>
                        - EGP {formattedReturnDeduction}
                      </td>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '900', fontSize: '20px', fontFamily: 'monospace', color: '#0f172a', backgroundColor: '#f8fafc' }}>
                        EGP {formattedTotal}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: '800', fontSize: '10.5px', color: '#16a34a' }}>
                        مسددة بعد المقاصة<br /><span style={{ fontSize: '8px' }}>PAID AFTER RTV</span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13.5px', fontFamily: 'monospace' }}>
                        EGP {formattedAmount}
                      </td>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13.5px', fontFamily: 'monospace' }}>
                        EGP {formattedTax}
                      </td>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '900', fontSize: '20px', fontFamily: 'monospace', color: '#0f172a', backgroundColor: '#f8fafc' }}>
                        EGP {formattedTotal}
                      </td>
                      <td style={{ padding: '12px 8px', borderRight: '1px solid #cbd5e1', fontWeight: '800', fontSize: '11.5px' }}>
                        {paymentMethodLabelAr}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: '800', fontSize: '11px', color: '#16a34a' }}>
                        مسددة بالكامل ١٠٠٪<br /><span style={{ fontSize: '8.5px' }}>PAID IN FULL</span>
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>

            {/* Tafqeet Legal Words Ribbon */}
            <div
              dir="rtl"
              style={{
                backgroundColor: '#ffffff',
                borderTop: '1px solid #0f172a',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                fontWeight: '800'
              }}
            >
              <div>
                <span style={{ color: '#dc2626' }}>{isReturnDeducted ? 'الصافي المنصرف بالحروف: ' : 'المبلغ بالحروف: '}</span>
                <span style={{ color: '#0f172a' }}>فقط وقدره {numberToArabicWords(Number(payment.total))} جنيهاً مصرياً لا غير{isReturnDeducted ? ' (صافي بعد خصم المرتجع)' : ''}.</span>
              </div>
              <div style={{ fontSize: '9px', color: '#475569', fontWeight: '700' }}>
                طريقة السداد: {paymentMethodLabelAr} بالعملة الرسمية لجمهورية مصر العربية
              </div>
            </div>

            {isReturnDeducted && (
              <div
                dir="rtl"
                style={{
                  backgroundColor: '#fffbeb',
                  borderTop: '1px dashed #f59e0b',
                  padding: '6px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '9.5px',
                  color: '#92400e',
                  fontWeight: '800'
                }}
              >
                <div>
                  <span style={{ color: '#b45309' }}>✓ مقاصة وتسوية مرتجع: </span>
                  <span>
                    تم خصم إشعار مرتجع بضاعة رسمي #{payment.returnNumber || payment.returnDetails?.returnNumber || 'RTV'}
                    {payment.transferOutNumber ? ` (إذن تحويل خارجي: TR-${payment.transferOutNumber})` : ''} بقيمة {formattedReturnDeduction} ج.م ومرفق أصل الإشعار معتمد.
                  </span>
                </div>
                <span style={{ fontSize: '8px', color: '#b45309', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  [ RTV DEDUCTION APPLIED • ATTACHED ON PAGE 2 ]
                </span>
              </div>
            )}
          </div>

          {/* 4. COMPREHENSIVE EGYPTIAN LEGAL DISCHARGE & WAIVER (LESS ZAHMA, EXECUTIVE STYLE) */}
          <div
            style={{
              border: '1px solid #0f172a',
              borderRadius: '4px',
              padding: '10px 14px',
              backgroundColor: '#ffffff',
              position: 'relative'
            }}
          >
            <div
              dir="rtl"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #cbd5e1',
                paddingBottom: '4px',
                marginBottom: '6px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#0f172a' }}>
                ⚖️ إقرار استلام ومخالصة مالية مبرئة للذمة باتة ونهائية (وفقاً لأحكام القانون المدني رقم ١٣١ لسنة ١٩٤٨ وقانون التجارة رقم ١٧ لسنة ١٩٩٩):
              </span>
              <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                IRREVOCABLE LEGAL RELEASE & WAIVER
              </span>
            </div>

            <div dir="rtl" style={{ fontSize: '9.5px', lineHeight: '1.7', color: '#1e293b', fontWeight: '700', textAlign: 'justify' }}>
              {isBank ? (
                <>
                  أقر أنا الموقع أدناه، بصفتي الممثل القانوني والمفوض عن الجهة/الشركة الموردة الموضحة بياناتها بهذا السند، بأنه تم تنفيذ أمر التحويل البنكي الإلكتروني لحساب شركتنا بقيمة الفاتورة المذكورة أعلاه وقدرها ({formattedTotal} ج.م - {numberToArabicWords(Number(payment.total))} جنيهاً مصرياً لا غير) عبر طريقة السداد ({paymentMethodLabelAr}). وبموجب هذا السند وإشعار التحويل المرفق، تعتبر هذه الفاتورة مسددة بالكامل، وتبرأ ذمة شركة سيركل كيه و{companyNameDisplay} إبراءً ذمة تاماً وباتاً ونهائياً وشاملاً كافة المستحقات المالية، مع إسقاط أي حق للمطالبة بأي مبالغ إضافية أو فروق أسعار أو فوائد أو تعويضات أمام أي جهة قضائية أو إدارية في جمهورية مصر العربية.
                </>
              ) : (
                <>
                  « أقر أنا الموقع أدناه، بصفتي الممثل القانوني والمفوض رسمياً عن الشركة الموردة الموضحة بياناتها بهذا السند، بأننا استلمنا من إدارة شركة (سيركل كيه / {companyNameDisplay} - فرع {branchNameArDisplay}) كامل قيمة الفاتورة/المطالبة الموضحة أعلاه وقدرها (<span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#0f172a' }}>{formattedTotal} ج.م</span> - {numberToArabicWords(Number(payment.total))} جنيهاً مصرياً لا غير) عبر طريقة السداد ({paymentMethodLabelAr}) بصورة تامة وناجزة، وبناءً عليه: يعتبر توقيعنا على هذا السند بمثابة <strong>مخالصة مالية تامة وباتة ونهائية، وإبراء ذمة شامل ومطلق وناجز لا رجعة فيه ولا طعن عليه بأي وجه من الوجوه</strong> لشركة سيركل كيه والشركة المشغلة وإدارتها ومسؤوليها من كامل قيمة هذه الفاتورة، مع إسقاط وتنازل نهائي وبات عن أي حق للمطالبة بأي مبالغ إضافية، فروق أسعار، تعويضات، غرامات، أو فوائد تأخير حالياً أو مستقبلاً أمام أية جهة قضائية أو تحكيمية أو حكومية في جمهورية مصر العربية، مع الإقرار بالصفة والأهلية القانونية الكاملة في التوقيع والاستلام. »
                </>
              )}
            </div>
          </div>

          {/* 5. DUAL SIGNATURE, SEALS & VERIFICATION GRID (TALL, NO FINGERPRINT BOX, LUXURIOUS) */}
          <div style={{ display: 'flex', gap: '12px', border: '1.5px solid #0f172a', borderRadius: '4px', padding: '12px 14px', backgroundColor: '#ffffff', minHeight: '245px' }}>
            {/* Supplier Signature (Right Side in RTL) - TALL & WIDE */}
            <div style={{ width: '43%', direction: 'rtl', borderLeft: '1px dashed #cbd5e1', paddingLeft: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ border: '1px solid #0f172a', backgroundColor: '#f8fafc', color: '#0f172a', padding: '4px 8px', fontSize: '10.5px', fontWeight: '800', textAlign: 'center', borderRadius: '3px', marginBottom: '8px' }}>
                  {isBank ? 'الطرف الأول: إشعار السداد والتحويل البنكي للمورد' : 'الطرف الأول: استلام ومخالصة مندوب المورد'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '9.5px', fontWeight: '700' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>{isBank ? 'الجهة المستفيدة:' : 'اسم المستلم:'} </span>
                    <span style={{ color: '#0f172a', fontWeight: '800', fontSize: '11px' }}>
                      {isBank ? (payment.companyName || 'الشركة الموردة') : (payment.supplierRepName || "مندوب الشركة المعتمد")}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>{isBank ? 'قناة التحويل:' : 'الرقم القومي:'} </span>
                    <span style={{ color: '#0f172a', fontWeight: '800', fontFamily: isBank ? 'inherit' : 'monospace', fontSize: '11px' }}>
                      {isBank ? 'الحساب البنكي المؤسسي المعتمد' : (payment.supplierNationalId || "مرفق بالصورة")}
                    </span>
                  </div>
                  {/* Arabic Attached National ID Confirmation / Bank Notice */}
                  {isBank ? (
                    <div style={{ border: '1px solid #bfdbfe', borderRadius: '3px', padding: '3px 8px', backgroundColor: '#eff6ff', fontSize: '9px', fontWeight: '800', color: '#1e40af', marginTop: '2px' }}>
                      ℹ️ سداد بنكي إلكتروني رسمي - لا يتطلب توقيع المندوب
                    </div>
                  ) : (
                    <div style={{ border: '1px dashed #0f172a', borderRadius: '3px', padding: '3px 8px', backgroundColor: '#f8fafc', fontSize: '9px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      ✓ مرفق معه صورة بطاقة الرقم القومي للمورد
                    </div>
                  )}
                </div>
              </div>

              {/* Wide Dedicated Signing Box - Full Width (No Fingerprint Box) */}
              {isBank ? (
                <div style={{ marginTop: '10px' }}>
                  <div
                    style={{
                      height: '105px',
                      border: '1.5px solid #2563eb',
                      borderRadius: '4px',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '8px 12px',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '16px' }}>🏦</span>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#1e40af' }}>
                        سداد إلكتروني معتمد بالحساب البنكي
                      </span>
                    </div>
                    <p style={{ margin: '2px 0', fontSize: '10px', fontWeight: '800', color: '#1d4ed8', lineHeight: 1.4 }}>
                      لا يتطلب توقيع المندوب<br />
                      {payment.bankTransferReceiptUrl ? '(إشعار التحويل البنكي الرسمي مرفق بالصفحة التالية)' : '(مسدد بموجب أمر تحويل بنكي رسمي معتمد)'}
                    </p>
                    <span style={{ fontSize: '7.5px', fontWeight: '800', color: '#3b82f6', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: '3px' }}>
                      ELECTRONIC SETTLEMENT • NO SUPPLIER SIGNATURE REQUIRED
                    </span>
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: '9.5px', fontWeight: '900', textAlign: 'center', color: '#1e40af' }}>
                    مسدد ومقيد رسمياً بحساب المورد بموجب إشعار التحويل البنكي
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ height: '105px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.5px' }}>[ مساحة توقيع وخاتم المستلم المعتمد / RECIPIENT SIGNATURE & STAMP ]</span>
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: '9.5px', fontWeight: '900', textAlign: 'center', color: '#0f172a' }}>
                    توقيع المستلم بما يفيد المخالصة التامة واستلام كامل مستحقات الفاتورة
                  </p>
                </div>
              )}
            </div>

            {/* Store Custody & Management (Center) */}
            <div style={{ width: '32%', direction: 'rtl', borderLeft: '1px dashed #cbd5e1', paddingLeft: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ border: '1px solid #0f172a', backgroundColor: '#f8fafc', color: '#0f172a', padding: '4px 8px', fontSize: '10.5px', fontWeight: '800', textAlign: 'center', borderRadius: '3px', marginBottom: '8px' }}>
                  الطرف الثاني: الاعتماد والصرف من الخزينة
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '9.5px', fontWeight: '700' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>أمين الخزينة: </span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{payment.createdBy?.split('@')[0] || "مسؤول الخزينة"}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>طريقة الصرف: </span>
                    <span style={{ color: '#047857', fontWeight: '800' }}>{paymentMethodLabelAr}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>مدير الفرع: </span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>معتمد إدارة الفرع</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>تاريخ الصرف: </span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{payment.date}</span>
                  </div>
                </div>
              </div>

              {/* Management Signatures */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: '105px', border: '1px solid #cbd5e1', borderRadius: '3px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '8px', color: '#94a3b8' }}>[ توقيع الخزينة ]</span>
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: '9px', fontWeight: '800', textAlign: 'center', color: '#0f172a' }}>أمين الخزينة</p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: '105px', border: '1px solid #cbd5e1', borderRadius: '3px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '8px', color: '#94a3b8' }}>[ اعتماد المدير ]</span>
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: '9px', fontWeight: '800', textAlign: 'center', color: '#0f172a' }}>مدير الفرع</p>
                </div>
              </div>
            </div>

            {/* Official Seals & Digital Verification (Left Side) */}
            <div style={{ width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '2px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
                {/* Circular Paid In Cash Seal (Crisp Outline) */}
                <div
                  style={{
                    border: `2px solid ${isBank ? '#2563eb' : '#16a34a'}`,
                    borderRadius: '50%',
                    width: '80px',
                    height: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isBank ? '#2563eb' : '#16a34a',
                    transform: 'rotate(-3deg)',
                    backgroundColor: '#ffffff',
                    boxShadow: `0 0 0 1px ${isBank ? '#2563eb' : '#16a34a'}33`,
                    flexShrink: 0
                  }}
                >
                  <span style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.6px', textTransform: 'uppercase', textAlign: 'center' }}>
                    {isBank ? 'PAID BY BANK' : 'PAID IN CASH'}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '900', borderBottom: `1px solid ${isBank ? '#2563eb' : '#16a34a'}`, paddingBottom: '1px', margin: '1px 0' }}>
                    مسدد ومعتمد
                  </span>
                  <span style={{ fontSize: '7.5px', fontWeight: '800' }}>مخالصة نهائية</span>
                </div>

                {/* Store Stamp (Crisp Outline) */}
                <div
                  style={{
                    border: '2px solid #000080',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    transform: 'rotate(2deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#ffffff',
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    flexShrink: 0
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#000080', letterSpacing: '0.5px', lineHeight: 1.1 }}>Circle K</span>
                  <span style={{ fontSize: '8.5px', fontWeight: '900', color: '#000080', letterSpacing: '0.2px', lineHeight: 1.1 }}>{branchNameDisplay}</span>
                  <span style={{ fontSize: '7px', fontWeight: '800', color: '#000080', marginTop: '1px' }}>ختم الإدارة المعتمد</span>
                </div>
              </div>

              {/* QR Code & Verification Tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code" style={{ width: "40px", height: "40px", borderRadius: '2px', border: '1px solid #cbd5e1' }} />
                ) : (
                  <div style={{ width: "40px", height: "40px", border: '1px dashed #cbd5e1', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#94a3b8' }}>QR</div>
                )}
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '8px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px', display: 'block' }}>SECURE VERIFIED</span>
                  <span style={{ fontSize: '7px', color: '#64748b', fontWeight: '700', display: 'block' }}>وثيقة مشفرة</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. SECURITY MICROPRINT & AUDIT FOOTER */}
          <div style={{ paddingTop: '6px', borderTop: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', fontWeight: '800', color: '#475569' }}>
            <div style={{ fontFamily: 'monospace' }}>
              PAYMENT REF: {payment.id} | METHOD: {paymentMethodLabelEn} | AUTH: {payment.createdBy?.split('@')[0] || "SYS"} | TIMESTAMP: {new Date().toLocaleString('ar-EG')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#dc2626' }}>لا يُعتد بأي كشط أو تعديل في هذا السند</span>
              <span style={{ color: '#0f172a', fontWeight: '900' }}>
                {isBank && payment.bankTransferReceiptUrl ? 'PAGE 1 OF 2 [الإشعار مرفق ص.٢]' : 'PAGE 1 OF 1 [صفحة واحدة معتمدة]'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BankTransferReceiptPrintPage({
  payment,
  currentBranch,
  elementId = "pdf-receipt-bank-page"
}: {
  payment: any;
  currentBranch?: string;
  elementId?: string;
}) {
  const pBranchStr = (payment.branchId || payment.storeId || currentBranch || "").toLowerCase();
  const isOlaBranch = pBranchStr.includes("ola") || pBranchStr.includes("koronfol");
  const companyNameDisplay = isOlaBranch ? "شركة إيه إن إتش تريد (ش.ذ.م.م)" : "الشركة المصرية للتجارة (ش.م.م)";
  const branchNameDisplay = isOlaBranch ? "Ola El Koronfol" : "El Alamein 4";
  const branchNameHeaderDisplay = isOlaBranch ? "CIRCLE K OLA EL KORONFOL" : "CIRCLE K EL-ALAMEIN 4";
  const branchNameArDisplay = isOlaBranch ? "علا القرنفل" : "العلمين 4";
  const formattedTotal = Number(payment.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const voucherIdShort = payment.id ? payment.id.substring(0, 10).toUpperCase() : Date.now().toString().slice(-8);

  return (
    <div
      id={elementId}
      className="print-page"
      style={{
        width: '210mm',
        height: '297mm',
        maxHeight: '297mm',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Tahoma", Arial, sans-serif',
        boxSizing: 'border-box',
        padding: '8mm 10mm',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {/* Outer Border Frame */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          border: '1.5px solid #0f172a',
          padding: '3px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            border: '1px solid #94a3b8',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 16px',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div style={{ paddingBottom: '10px', borderBottom: '1.5px solid #0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Brand Left */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '30%' }}>
                <div style={{ width: '46px', height: '46px', backgroundColor: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', lineHeight: 1, fontFamily: '"Arial Black", Impact, sans-serif' }}>K</span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#dc2626', letterSpacing: '0.5px', textTransform: 'uppercase' }}>CIRCLE K EGYPT</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', fontWeight: '800', color: '#0f172a' }}>{branchNameHeaderDisplay}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '9px', fontWeight: '700', color: '#64748b' }}>سلسلة متاجر ومحطات سيركل كيه - فرع {branchNameArDisplay}</p>
                </div>
              </div>

              {/* Title Center */}
              <div style={{ textAlign: 'center', width: '40%' }}>
                <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.25 }} dir="rtl">
                  مرفق إشعار التحويل البنكي الرسمي المعتمد
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: '9px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  OFFICIAL BANK TRANSFER CONFIRMATION RECEIPT
                </p>
                <div style={{ display: 'inline-block', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '9.5px', fontWeight: '800', padding: '2px 10px', borderRadius: '3px', marginTop: '4px' }}>
                  مرفق رسمي تابع لسند السداد رقم: PAY-{voucherIdShort}
                </div>
              </div>

              {/* Meta Right */}
              <div style={{ width: '30%', textAlign: 'right', direction: 'rtl' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>{companyNameDisplay}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '3px' }}>
                  <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>الشركة الموردة:</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '900', color: '#0f172a' }}>{payment.companyName || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>رقم الفاتورة:</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>{payment.invoiceNumber || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>المبلغ المحول:</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '900', color: '#047857', fontFamily: 'monospace' }}>EGP {formattedTotal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attached Bank Slip Image Viewer */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px dashed #94a3b8',
              borderRadius: '6px',
              padding: '14px',
              margin: '10px 0',
              backgroundColor: '#f8fafc',
              overflow: 'hidden'
            }}
          >
            <img
              src={payment.bankTransferReceiptUrl}
              alt="Bank Transfer Receipt Slip"
              style={{
                maxHeight: '820px',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
          </div>

          {/* Footer */}
          <div style={{ paddingTop: '6px', borderTop: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', fontWeight: '800', color: '#475569' }}>
            <div style={{ fontFamily: 'monospace' }}>
              ATTACHMENT REF: TRF-DOC-{voucherIdShort} | ORIGINAL VOUCHER ID: {payment.id} | TIMESTAMP: {new Date().toLocaleString('ar-EG')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#2563eb' }}>إشعار تحويل بنكي إلكتروني معتمد رسمياً</span>
              <span style={{ color: '#0f172a', fontWeight: '900' }}>PAGE 2 OF 2 [مرفق التحويل البنكي]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TiltCard } from "@/components/MobileUX/TiltCard";
import { dispatchNotificationSystem } from "@/lib/notifications";
import { notifyFinancialsUpdated } from "@/lib/financial-sync";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { db, auth, storage, dbService } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  Timestamp,
  limit,
  where,
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import {
  Plus,
  Download,
  Trash2,
  Search,
  Loader2,
  X,
  FileDown,
  Image as ImageIcon,
  Eye,
  ClipboardPaste,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Check,
  Layers,
  PackageOpen,
  RefreshCw,
  MessageCircle,
  FileText,
  PieChart as PieChartIcon,
  Printer,
  Calculator,
  Pencil,
  RotateCcw,
  Undo2,
  Sparkles,
  Package,
  Zap,
  Truck,
  Wrench,
  LayoutGrid,
  Rows,
  Activity,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  SlidersHorizontal
} from "lucide-react";
import { ReturnReceiptContent, PendingReturnTicket, groupPendingReturns } from "@/components/ReturnReceiptContent";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, AreaChart, Area } from 'recharts';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { syncProductsToMaster } from "@/lib/products-sync";
import { playPrinterSound } from "@/lib/audioCues";

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

const CATEGORY_EMOJIS: Record<string, string> = {
  order: "📦",
  credit: "📑",
  maintenance: "🔧",
  utilities: "💡",
  transportation: "🚚",
  other: "📝"
};

const METHOD_EMOJIS: Record<string, string> = {
  cash: "💵",
  visa: "💳",
  bank_transfer: "🏦"
};

// Luxury Rolling Odometer Number Component (Swiss Chronometer Effect)
function RollingNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 2
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayVal, setDisplayVal] = useState(value);
  const prevValRef = React.useRef(value);

  useEffect(() => {
    const start = prevValRef.current;
    const end = value;
    prevValRef.current = value;
    if (start === end) {
      setDisplayVal(end);
      return;
    }
    const duration = 650;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      setDisplayVal(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDisplayVal(end);
      }
    };
    const animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return (
    <span className="font-mono tabular-nums inline-block">
      {prefix}{displayVal.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// Anodized Metallic Payment Method Badges (Banknote Guilloche, Titanium Chip, Gold Foil)
function PaymentMethodBadge({ method }: { method: string }) {
  const m = method?.toLowerCase() || "cash";
  if (m === "bank_transfer" || m === "visa" || m === "card") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-indigo-950/80 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)] ring-1 ring-white/10">
        <span className="w-2.5 h-2 rounded-[2px] bg-indigo-500/30 border border-indigo-300/50 shadow-inner flex items-center justify-center">
          <span className="w-1.5 h-0.5 bg-indigo-200 block rounded-[0.5px]" />
        </span>
        <span>{m === "bank_transfer" ? "Bank Wire" : "Card / Visa"}</span>
      </span>
    );
  }
  if (m === "return" || m === "rtv") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-amber-950/80 text-amber-200 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/20">
        <RotateCcw size={10} className="text-amber-400" />
        <span>RTV Credit</span>
      </span>
    );
  }
  // Default Cash
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.18)] ring-1 ring-emerald-400/20">
      <span className="w-3 h-2 rounded-[1px] border border-emerald-400/80 bg-emerald-500/30 flex items-center justify-center text-[7px] leading-none font-mono font-bold text-emerald-200">
        $
      </span>
      <span>Cash</span>
    </span>
  );
}

export default function PaymentsRedesignPage() {
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
  const [highlightPaymentId, setHighlightPaymentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem('cached_detailed_payments');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem('cached_detailed_payments');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlMonth = urlParams.get("month");
      if (urlMonth) return urlMonth;
    }
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("search");
      const m = params.get("month");
      const h = params.get("highlight");

      if (h) {
        setHighlightPaymentId(h);
      }
      if (m) {
        setMonthFilter(m);
      }
      if (s) {
        setSearchQuery(s);
        if (!m) {
          setMonthFilter(""); // clear month filter so searched PO/invoice across all months is shown!
        }
      }
      // Clean URL params cleanly so page reload starts with a fresh clean state
      if (s || h) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("search");
          url.searchParams.delete("highlight");
          window.history.replaceState(null, "", url.toString());
        } catch (_) {}
      }
    }
  }, []);

  // Luxury UI States & Controls
  const [viewMode, setViewMode] = useState<"bento" | "ledger">("bento");
  const [timePreset, setTimePreset] = useState<"today" | "yesterday" | "this_week" | "this_month" | "last_month" | "all" | "custom">("this_month");
  
  // High-performance DOM spotlight ref (0 React re-renders on mousemove)
  const spotlightRef = useRef<HTMLDivElement>(null);

  const handleContainerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (spotlightRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      spotlightRef.current.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(244, 63, 94, 0.04), transparent 80%)`;
    }
  }, []);

  const handleSelectTimePreset = (preset: "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "all") => {
    setTimePreset(preset);
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (preset === "this_month" || preset === "today" || preset === "this_week") {
      setMonthFilter(curMonth);
    } else if (preset === "yesterday") {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestMonth = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}`;
      setMonthFilter(yestMonth);
    } else if (preset === "last_month") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      setMonthFilter(prevMonth);
    } else if (preset === "all") {
      setMonthFilter("");
    }
  };

  // Supplier Features State
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<string | null>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [savedPaymentForQR, setSavedPaymentForQR] = useState<any>(null);

  // Bulk Print State
  const [selectedBulkItems, setSelectedBulkItems] = useState<Set<string>>(new Set());
  const [isGeneratingBulkPDF, setIsGeneratingBulkPDF] = useState(false);
  const [bulkPaymentsForPrint, setBulkPaymentsForPrint] = useState<any[]>([]);

  const handleSelectBulkItem = (id: string) => {
    const newSet = new Set(selectedBulkItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedBulkItems(newSet);
  };

  const handleSelectAllBulkItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBulkItems(new Set(filteredPayments.map((p) => p.id)));
    } else {
      setSelectedBulkItems(new Set());
    }
  };

  useEffect(() => {
    if (!savedPaymentForQR) return;
    const unsub = onSnapshot(doc(db, "cash_payments", savedPaymentForQR.id), (docSnap) => {
      if (docSnap.exists() && (docSnap.data().invoiceUrl || (docSnap.data().invoiceUrls && docSnap.data().invoiceUrls.length > 0))) {
        toast.success("Invoice successfully uploaded!");
        setSavedPaymentForQR(null);
      }
    });
    return () => unsub();
  }, [savedPaymentForQR]);



  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("order");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("");
  const [categoryNote, setCategoryNote] = useState("");
  const [supplierRepName, setSupplierRepName] = useState("");
  const [supplierNationalId, setSupplierNationalId] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [bankTransferFile, setBankTransferFile] = useState<File | null>(null);

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
    const targetComp = (companyName || "").toLowerCase().replace(/[\s\-_]/g, '').trim();

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
  }, [availablePendingReturns, companyName, pendingReturnSearchQuery, showAllSuppliersPending]);

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

  // PO Extraction State
  const [poItems, setPoItems] = useState<{ barcode: string, quantity: number, description: string, unitPrice: number }[]>([]);
  const [isProcessingPo, setIsProcessingPo] = useState(false);
  const [poImageFile, setPoImageFile] = useState<File | null>(null);
  const [selectedPaymentForPoUpload, setSelectedPaymentForPoUpload] = useState<any>(null);
  const [uploadingPoToOldInvoice, setUploadingPoToOldInvoice] = useState(false);
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<any>(null);
  const [selectedPaymentForView, setSelectedPaymentForView] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  // Edit Payment State (Admin Only)
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTax, setEditTax] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editPoNumber, setEditPoNumber] = useState("");
  const [editCategory, setEditCategory] = useState("order");
  const [editCategoryNote, setEditCategoryNote] = useState("");
  const [editMethod, setEditMethod] = useState("cash");

  const qrFileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadInvoiceDataUrl = async (activeId: string, dataUrl: string) => {
    setIsPasting(true);
    // Immediately close the QR modal and return user back to system
    setSavedPaymentForQR(null);
    toast.loading(isAr ? "جاري رفع صورة الفاتورة..." : "Uploading invoice image...", { id: "invoice-upload-toast" });

    try {
      let finalDataUrl = dataUrl;
      // Fast client-side image compression if image payload is large
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
        updatedAt: new Date().toISOString()
      };

      try {
        await updateDoc(doc(db, "cash_payments", activeId), updatePayload);
        setPayments(prev => prev.map(p => p.id === activeId ? { ...p, ...updatePayload } : p));
        if (selectedPaymentForView?.id === activeId) {
          setSelectedPaymentForView((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
        }
        toast.success(isAr ? "تم رفع وإرفاق الفاتورة بنجاح! 📄✨" : "Invoice uploaded & attached successfully! 📄✨", { id: "invoice-upload-toast" });
        fetchData();
        return;
      } catch (clientErr) {
        console.warn("Direct updateDoc failed, attempting /api/upload-invoice fallback:", clientErr);
      }

      const res = await fetch("/api/upload-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: activeId,
          invoiceDataUrls: [finalDataUrl],
          type: "payment",
        }),
      });

      if (res.ok) {
        setPayments(prev => prev.map(p => p.id === activeId ? { ...p, ...updatePayload } : p));
        toast.success(isAr ? "تم رفع وإرفاق الفاتورة بنجاح! 📄✨" : "Invoice uploaded & attached successfully! 📄✨", { id: "invoice-upload-toast" });
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to upload invoice", { id: "invoice-upload-toast" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error uploading invoice", { id: "invoice-upload-toast" });
    } finally {
      setIsPasting(false);
    }
  };

  const handlePasteFromClipboardButton = async () => {
    const activeId = savedPaymentForQR?.id || (selectedPaymentForView && (!selectedPaymentForView.invoiceUrl && !((selectedPaymentForView.invoiceUrls?.length || 0) > 0)) ? selectedPaymentForView.id : null);
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

    // Fallback: click hidden file input if clipboard read is restricted
    if (qrFileInputRef.current) {
      qrFileInputRef.current.click();
    } else {
      toast.info(isAr ? "يرجى استخدام Ctrl+V للصق صورة الفاتورة أو اختيار ملف" : "Please press Ctrl+V to paste or select invoice file");
    }
  };

  const handleQrFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const activeId = savedPaymentForQR?.id || selectedPaymentForView?.id;
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
      const activeId = savedPaymentForQR?.id || (selectedPaymentForView && (!selectedPaymentForView.invoiceUrl && !((selectedPaymentForView.invoiceUrls?.length || 0) > 0)) ? selectedPaymentForView.id : null);
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
  }, [savedPaymentForQR, selectedPaymentForView]);

  useEffect(() => {
    if (selectedPaymentForPrint) {
      const urlText = `${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/handshake?data=${encodeURIComponent(JSON.stringify({
        id: selectedPaymentForPrint.id,
        amount: selectedPaymentForPrint.total,
        company: selectedPaymentForPrint.companyName,
        date: selectedPaymentForPrint.date,
        action: "verify_receipt"
      }))}`;
      QRCodeLib.toDataURL(urlText)
        .then((url: string) => setQrCodeData(url))
        .catch((err: any) => console.error(err));
    } else {
      setQrCodeData("");
    }
  }, [selectedPaymentForPrint]);

  useEffect(() => {
    if (!selectedPaymentForView?.id) return;

    const unsub = onSnapshot(doc(db, "cash_payments", selectedPaymentForView.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.invoiceUrl && data.invoiceUrl !== selectedPaymentForView.invoiceUrl) {
          setSelectedPaymentForView((prev: any) => ({ ...prev, ...data }));
          setPayments((prev) => prev.map(p => p.id === selectedPaymentForView.id ? { ...p, ...data } : p));
          toast.success("Supplier invoice uploaded via mobile!");
        }
      }
    });

    // Also enrich from linked credit if PO number, PO image, or items are missing
    const credId = selectedPaymentForView.creditId;
    const hasItems = selectedPaymentForView.items && selectedPaymentForView.items.length > 0;
    const hasPoNumber = Boolean(selectedPaymentForView.poNumber);
    const hasPoImage = Boolean(selectedPaymentForView.poImageUrl);

    if (credId && (!hasItems || !hasPoNumber || !hasPoImage)) {
      getDoc(doc(db, "credits", credId)).then((cSnap) => {
        if (cSnap.exists()) {
          const cData = cSnap.data();
          const rawItems = (cData.items && Array.isArray(cData.items) && cData.items.length > 0)
            ? cData.items
            : (selectedPaymentForView.items || []);

          const standardizedItems = rawItems.map((it: any) => {
            const itemDesc = (it.description || it.name || it.itemName || it.item || "صنف").trim();
            const itemQty = Math.max(1, Number(it.quantity ?? it.qty ?? 1) || 1);
            const itemPrice = Number(it.unitPrice ?? it.price ?? 0);
            const itemTotal = Number(it.total ?? it.totalPrice ?? (itemQty * itemPrice));
            return {
              ...it,
              barcode: (it.barcode && it.barcode !== "N/A" ? it.barcode : (it.code || "N/A")).toString().trim(),
              description: itemDesc,
              name: itemDesc,
              itemName: itemDesc,
              quantity: itemQty,
              unitPrice: itemPrice,
              price: itemPrice,
              total: itemTotal,
              totalPrice: itemTotal
            };
          });

          const resolvedPoNumber = selectedPaymentForView.poNumber || cData.poNumber || "";
          const resolvedPoImage = selectedPaymentForView.poImageUrl || cData.poImageUrl || cData.poUrl || (cData.poUrls && cData.poUrls[0]) || "";
          const resolvedInvoiceUrl = selectedPaymentForView.invoiceUrl || cData.invoiceUrl || "";

          setSelectedPaymentForView((prev: any) => {
            if (!prev || prev.id !== selectedPaymentForView.id) return prev;
            return {
              ...prev,
              items: standardizedItems.length > 0 ? standardizedItems : prev.items,
              poNumber: resolvedPoNumber,
              poImageUrl: resolvedPoImage,
              invoiceUrl: resolvedInvoiceUrl,
              invoiceUrls: prev.invoiceUrls?.length ? prev.invoiceUrls : (cData.invoiceUrls || (cData.invoiceUrl ? [cData.invoiceUrl] : [])),
            };
          });

          setPayments((prev) => prev.map(p => {
            if (p.id === selectedPaymentForView.id) {
              return {
                ...p,
                items: standardizedItems.length > 0 ? standardizedItems : p.items,
                poNumber: p.poNumber || resolvedPoNumber,
                poImageUrl: p.poImageUrl || resolvedPoImage,
              };
            }
            return p;
          }));
        }
      }).catch((err) => {
        console.error("Failed to enrich payment view from credit:", err);
      });
    }

    return () => unsub();
  }, [selectedPaymentForView?.id, selectedPaymentForView?.creditId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, currentBranch, monthFilter]);

  useEffect(() => {
    const handleSync = () => {
      if (currentUser) {
        fetchData();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("circlek_financials_updated", handleSync);
      return () => window.removeEventListener("circlek_financials_updated", handleSync);
    }
  }, [currentUser, currentBranch, monthFilter]);

  const fetchData = async () => {
    const hasCached = typeof window !== "undefined" && !!localStorage.getItem('cached_detailed_payments');
    if (!hasCached) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }
    try {
      // 1. Fetch Payments
      let q1;
      if (monthFilter) {
        const monthStart = `${monthFilter}-01`;
        const monthEnd = `${monthFilter}-31`;
        q1 = branchIds.length > 0
          ? query(collection(db, "cash_payments"), where("storeId", "in", branchIds), where("date", ">=", monthStart), where("date", "<=", monthEnd), orderBy("date", "desc"))
          : query(collection(db, "cash_payments"), where("date", ">=", monthStart), where("date", "<=", monthEnd), orderBy("date", "desc"));
      } else {
        q1 = branchIds.length > 0
          ? query(collection(db, "cash_payments"), where("storeId", "in", branchIds), orderBy("date", "desc"), limit(150))
          : query(collection(db, "cash_payments"), orderBy("date", "desc"), limit(150));
      }
      const paySnapshot = await getDocs(q1);
      const loadedPayments = paySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setPayments(loadedPayments);
      setLoading(false);

      if (typeof window !== "undefined") {
        try {
          const cleanPayments = loadedPayments.slice(0, 100).map((p: any) => {
            const { invoiceUrls, invoiceUrl, photoUrls, ...rest } = p;
            return rest;
          });
          localStorage.setItem('cached_detailed_payments', JSON.stringify(cleanPayments));
        } catch(e) {
          console.error("Failed to cache payments:", e);
        }
      }

      // 2. Extract Suppliers from cash_payments
      const uniqueSuppliers = new Set<string>();

      loadedPayments.forEach(p => {
        if (p.companyName) uniqueSuppliers.add(p.companyName.toUpperCase());
      });

      setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));

      // 3. Fetch Credits to calculate Outstanding Debt (capped to 150 to keep it lightning fast)
      const q2 = branchIds.length > 0
        ? query(collection(db, "credits"), where("storeId", "in", branchIds), orderBy("createdAt", "desc"), limit(150))
        : query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(150));
      try {
        const credSnapshot = await getDocs(q2);
        setCredits(credSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (err) {
        console.error("Failed to load credits", err);
      }
    } catch (err: any) {
      console.error(err);
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
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const name = newSupplierName.trim().toUpperCase();

    // Just add to local state, it will be persisted to cash_payments when a payment is saved
    const newSupp = { id: `sup_new_${Date.now()}`, name };
    setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyName(name);
    setShowAddSupplier(false);
    setNewSupplierName("");
    toast.success("Supplier ready to be used!");
  };
  const handlePastePoImageButtonClick = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          if (selectedPaymentForPoUpload) {
            handleUploadPoToOldInvoice(file);
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
  const handleUploadPoToOldInvoice = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }

    setUploadingPoToOldInvoice(true);
    try {
      const base64Image = await compressImage(file, 1000, 0.7);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
        signal: AbortSignal.timeout(18000)
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("RATE_LIMIT");
        throw new Error('Failed to process image');
      }
      const data = await response.json();

      let newItems: any[] = [];
      if (data.items && Array.isArray(data.items)) {
        newItems = data.items.map((it: any) => {
          const itemDesc = (it.description || it.name || it.itemName || it.item || "صنف").trim();
          const itemQty = Math.max(1, Number(it.quantity ?? it.qty ?? 1) || 1);
          const itemPrice = Number(it.unitPrice ?? it.price ?? 0);
          const itemTotal = Number(it.total ?? it.totalPrice ?? (itemQty * itemPrice));
          return {
            barcode: (it.barcode && it.barcode !== "N/A" ? it.barcode : (it.code || "N/A")).toString().trim(),
            description: itemDesc,
            name: itemDesc,
            itemName: itemDesc,
            quantity: itemQty,
            unitPrice: itemPrice,
            price: itemPrice,
            total: itemTotal,
            totalPrice: itemTotal
          };
        });
      }

      const updateData: any = {};
      if (base64Image) {
        updateData.poImageUrl = base64Image;
      }
      if (newItems.length > 0) updateData.items = newItems;
      if (data.poNumber) updateData.poNumber = data.poNumber;

      await updateDoc(doc(db, "cash_payments", selectedPaymentForPoUpload.id), updateData);

      // Sync products to the secondary Firebase db
      if (newItems.length > 0) {
        syncProductsToMaster(newItems, data.date || selectedPaymentForPoUpload.date || new Date().toISOString().split('T')[0], selectedPaymentForPoUpload.companyName);
      }

      // If linked to a credit, also sync to the credit document in Firestore
      if (selectedPaymentForPoUpload.creditId) {
        try {
          const creditRef = doc(db, "credits", selectedPaymentForPoUpload.creditId);
          await updateDoc(creditRef, updateData);
          setCredits(prev => prev.map(c => c.id === selectedPaymentForPoUpload.creditId ? { ...c, ...updateData } : c));
        } catch (cErr) {
          console.error("Failed to sync PO to credit document:", cErr);
        }
      }

      setPayments(prev => prev.map(p => {
        if (p.id === selectedPaymentForPoUpload.id) {
          return { ...p, ...updateData };
        }
        return p;
      }));

      toast.success('PO added successfully to old invoice!');
      setSelectedPaymentForPoUpload(null);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'RATE_LIMIT') {
        toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
      } else {
        toast.error('Error adding PO to old invoice.');
      }
    } finally {
      setUploadingPoToOldInvoice(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }

    setIsProcessingPo(true);
    setPoImageFile(file);
    try {
      const base64Image = await compressImage(file, 1000, 0.7);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
        signal: AbortSignal.timeout(18000)
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("RATE_LIMIT");
        throw new Error('Failed to process image');
      }
      const data = await response.json();

      if (data.poNumber) setPoNumber(data.poNumber);
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
      if (data.date) setDate(data.date);

      if (data.companyName) {
        const match = suppliers.find(s => s.name.toLowerCase().includes(data.companyName.toLowerCase()) || data.companyName.toLowerCase().includes(s.name.toLowerCase()));
        if (match) {
          setCompanyName(match.name);
        } else {
          const name = data.companyName.trim().toUpperCase();
          const newSupp = { id: `sup_new_${Date.now()}`, name };
          setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
          setCompanyName(name);
        }
      }

      if (data.amount !== undefined) setAmount(data.amount.toString());
      if (data.tax !== undefined) setTax(data.tax.toString());

      if (data.items && Array.isArray(data.items)) {
        setPoItems(data.items.map((it: any) => {
          const itemDesc = (it.description || it.name || it.itemName || it.item || "صنف").trim();
          const itemQty = Math.max(1, Number(it.quantity ?? it.qty ?? 1) || 1);
          const itemPrice = Number(it.unitPrice ?? it.price ?? 0);
          return {
            barcode: (it.barcode && it.barcode !== "N/A" ? it.barcode : (it.code || "N/A")).toString().trim(),
            description: itemDesc,
            quantity: itemQty,
            unitPrice: itemPrice,
          };
        }));
      }

      toast.success('PO processed successfully!');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'RATE_LIMIT') {
        toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
      } else {
        toast.error('Error processing PO image. Please enter manually.');
      }
    } finally {
      setIsProcessingPo(false);
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (selectedPaymentForPoUpload) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              handleUploadPoToOldInvoice(file);
            }
            break;
          }
        }
        return;
      }

      if (!showAddModal || category !== 'order') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            if (method === 'bank_transfer') {
              setBankTransferFile(file);
              toast.success("Bank transfer receipt pasted!");
            } else {
              handleImageUpload(file);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);

  }, [showAddModal, category, selectedPaymentForPoUpload, method]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (category !== 'order') return;
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setDate(new Date().toISOString().split("T")[0]);
    setMethod("cash");
    setCategory("order");
    setInvoiceNumber("");
    setPoNumber("");
    setCompanyName("");
    setNewSupplierName("");
    setAmount("");
    setTax("");
    setCategoryNote("");
    setSupplierRepName("");
    setSupplierNationalId("");
    setShowAddSupplier(false);
    setPoItems([]);
    setIsProcessingPo(false);
    setBankTransferFile(null);
    // Reset Return States
    setHasReturn(false);
    setReturnSource("pending");
    setSelectedPendingReturn(null);
    setPendingReturnSearchQuery("");
    setShowAllSuppliersPending(false);
    setReturnAmount("");
    setReturnTransferOutNumber("");
    setReturnAgentName("");
    setReturnAgentNationalId("");
    setReturnAgentMobile("");
    setReturnReason("");
    setReturnItems([]);
  };

  const handlePoItemChange = (index: number, field: 'barcode' | 'quantity' | 'description' | 'unitPrice', value: any) => {
    const newItems = [...poItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setPoItems(newItems);
  };

  const handleRemovePoItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleAddPoItem = () => {
    setPoItems([...poItems, { barcode: "", quantity: 1, description: "", unitPrice: 0 }]);
  };

  const handleReturnItemChange = (index: number, field: string, value: any) => {
    const newItems = [...returnItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? (parseInt(value) || 0) : (newItems[index].quantity || 0);
      const p = field === 'unitPrice' ? (parseFloat(value) || 0) : (newItems[index].unitPrice || 0);
      newItems[index].totalPrice = q * p;
    }
    setReturnItems(newItems);
    const sum = newItems.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
    if (sum > 0) setReturnAmount(sum.toString());
  };

  const handleRemoveReturnItem = (index: number) => {
    const newItems = returnItems.filter((_, i) => i !== index);
    setReturnItems(newItems);
    if (newItems.length > 0) {
      const sum = newItems.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
      setReturnAmount(sum.toString());
    }
  };

  const handleAddReturnItem = () => {
    setReturnItems([...returnItems, { barcode: "", itemName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !amount) {
      toast.error("Company name and amount are required.");
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const numTax = parseFloat(tax) || 0;
    const grossTotal = numAmount + numTax;
    const numReturnAmount = hasReturn ? (parseFloat(returnAmount) || 0) : 0;

    if (hasReturn) {
      if (numReturnAmount <= 0) {
        toast.error(isAr ? "برجاء إدخال قيمة خصم المرتجع بشكل صحيح." : "Please enter a valid return deduction amount.");
        return;
      }
      if (numReturnAmount > grossTotal) {
        toast.error(isAr ? "قيمة خصم المرتجع لا يمكن أن تتجاوز إجمالي قيمة الفاتورة." : "Return deduction cannot exceed gross invoice total.");
        return;
      }
    }

    // Auto-generate fallback TR Number if not provided
    const finalTransferOutNum = returnTransferOutNumber.trim() || (hasReturn ? `TR-${Date.now().toString().slice(-6)}` : "");

    const netTotal = Math.max(0, grossTotal - numReturnAmount);
    // Safe accounting: Safe balance outflow is (p.amount + p.tax)
    // To deduct exactly netTotal from the safe, set netAmount = Math.max(0, netTotal - numTax)
    const netAmount = Math.max(0, netTotal - numTax);

    try {
      setSubmitting(true);
      const poImageUrl = null;
      let bankTransferReceiptUrl = null;

      if (method === 'bank_transfer' && bankTransferFile) {
        toast.loading("Processing bank transfer receipt...", { id: "bank-upload" });
        bankTransferReceiptUrl = await compressImage(bankTransferFile, 800, 0.65);
        toast.dismiss("bank-upload");
      }

      const isOrderCategory = category === "order";
      const finalPoNumber = isOrderCategory ? poNumber.trim() : "";
      const finalPoItems = (isOrderCategory ? poItems : []).map((it: any) => {
        const itemDesc = (it.description || it.name || it.itemName || it.item || "صنف").trim();
        const itemQty = Math.max(1, Number(it.quantity ?? it.qty ?? 1) || 1);
        const itemPrice = Number(it.unitPrice ?? it.price ?? 0);
        const itemTotal = Number(it.total ?? it.totalPrice ?? (itemQty * itemPrice));
        return {
          barcode: (it.barcode && it.barcode !== "N/A" ? it.barcode : (it.code || "N/A")).toString().trim(),
          description: itemDesc,
          name: itemDesc,
          itemName: itemDesc,
          quantity: itemQty,
          unitPrice: itemPrice,
          price: itemPrice,
          total: itemTotal,
          totalPrice: itemTotal
        };
      });
      const finalPoImageUrl = isOrderCategory ? poImageUrl : "";

      const isPendingSource = hasReturn && returnSource === "pending" && !!selectedPendingReturn;
      const finalReturnNumber = isPendingSource
        ? (selectedPendingReturn.returnNumber || `RTV-${selectedPendingReturn.id.slice(-6)}`)
        : (hasReturn ? `RTV-${Date.now().toString().slice(-6)}` : null);

      const finalRepName = returnAgentName.trim() || supplierRepName.trim() || (isPendingSource ? selectedPendingReturn.agentName : "") || "مندوب الشركة المعتمد";
      const finalRepNationalId = returnAgentNationalId.trim() || supplierNationalId.trim() || (isPendingSource ? selectedPendingReturn.agentNationalId : "") || "";
      const finalRepMobile = returnAgentMobile.trim() || (isPendingSource ? selectedPendingReturn.agentMobile : "") || "";
      const finalReturnReason = returnReason.trim() || (isPendingSource ? selectedPendingReturn.reason : "") || "خصم مرتجع بضاعة من سداد المورد";

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
      const voucherRef = invoiceNumber ? `INV-${invoiceNumber}` : (finalPoNumber ? `PO-${finalPoNumber}` : `PAY-${Date.now().toString().slice(-6)}`);

      const canonicalStoreId = (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4");

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
                settledBy: currentUser?.email || "unknown",
                settledByVoucher: voucherRef,
                paymentTiming: "now",
                settlementMethod: "money",
                deductedFromPaymentDate: date,
                returnAmount: numReturnAmount,
                transferOutNumber: finalTransferOutNum || selectedPendingReturn.transferOutNumber || "",
                agentName: finalRepName,
                agentNationalId: finalRepNationalId,
                agentMobile: finalRepMobile
              }));
            } catch (updErr) {
              console.warn(`Failed to update return doc ${docId}:`, updErr);
            }
          }
          createdReturnId = selectedPendingReturn.id;
        } else {
          // Create a new settled return in supplier_returns
          const returnTimestamp = new Date().toISOString();
          const returnDocRef = await addDoc(collection(db, "supplier_returns"), cleanPayload({
            barcode: finalReturnItems[0]?.barcode || "N/A",
            itemName: finalReturnItems[0]?.itemName || finalReturnReason,
            category: "deduction_from_payment",
            supplier: companyName || "مورد",
            quantity: finalReturnItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 1,
            storeId: canonicalStoreId,
            branchId: currentBranch === "all" ? "alamein4" : currentBranch,
            status: "returned",
            createdAt: returnTimestamp,
            createdBy: currentUser?.email || "unknown",
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
            deductedFromPaymentDate: date
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
        isSettled: true,
        settlementMethod: "money",
        paymentTiming: "now",
        paymentVoucherNumber: voucherRef,
        returnedAt: (isPendingSource && selectedPendingReturn?.returnedAt) ? selectedPendingReturn.returnedAt : new Date().toISOString()
      } : null;

      const newPayment = {
        amount: hasReturn ? netAmount : numAmount,
        category,
        categoryNote,
        companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date,
        description: categoryNote,
        invoiceNumber,
        isTaxable: numTax > 0,
        method,
        poNumber: finalPoNumber,
        storeId: canonicalStoreId,
        tax: numTax,
        total: hasReturn ? netTotal : grossTotal,
        supplierRepName,
        supplierNationalId,
        // RTV Return Deduction Tracking
        hasReturn: hasReturn && numReturnAmount > 0,
        grossAmount: numAmount,
        grossTotal: grossTotal,
        returnDeductionAmount: hasReturn ? numReturnAmount : 0,
        returnNumber: finalReturnNumber || "",
        transferOutNumber: finalTransferOutNum,
        returnDetails: returnDetailsPayload,
        ...(finalPoItems.length > 0 ? { items: finalPoItems } : {}),
        ...(finalPoImageUrl ? { poImageUrl: finalPoImageUrl } : {}),
        ...(bankTransferReceiptUrl ? { bankTransferReceiptUrl } : {})
      };

      const cleanedPayment = cleanPayload(newPayment);
      let docRef;
      try {
        docRef = await addDoc(collection(db, "cash_payments"), cleanedPayment);
      } catch (addErr) {
        console.warn("Primary cash_payments addDoc failed, retrying lightweight:", addErr);
        const lightweight = { ...cleanedPayment };
        delete lightweight.poImageUrl;
        delete lightweight.bankTransferReceiptUrl;
        docRef = await addDoc(collection(db, "cash_payments"), cleanPayload(lightweight));
      }

      // Prepend to local cache so it appears immediately
      if (typeof window !== "undefined" && docRef?.id) {
        try {
          const rawCache = localStorage.getItem('cached_detailed_payments');
          const cachedList = rawCache ? JSON.parse(rawCache) : [];
          const newPaymentForCache = {
            ...cleanedPayment,
            id: docRef.id,
            createdAt: new Date().toISOString(),
          };
          const updatedCache = [newPaymentForCache, ...cachedList.filter((p: any) => p.id !== docRef.id)].slice(0, 100);
          localStorage.setItem('cached_detailed_payments', JSON.stringify(updatedCache));
        } catch (cacheErr) {
          console.warn("Could not cache new payment locally:", cacheErr);
        }
      }

      notifyFinancialsUpdated(currentBranch);

      // Dispatch Universal System Notification
      const notifBody = hasReturn
        ? `Payment logged for ${companyName}: Gross EGP ${grossTotal.toLocaleString()} - Return EGP ${numReturnAmount.toLocaleString()} = Net Paid EGP ${netTotal.toLocaleString()}.\nMethod: ${method?.replace('_', ' ').toUpperCase() || 'CASH'} • RTV: ${finalReturnNumber}`
        : `Payment of EGP ${Number(grossTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })} logged for ${companyName}.\nTax: EGP ${Number(numTax).toLocaleString()} • Method: ${method?.replace('_', ' ').toUpperCase() || 'CASH'}${invoiceNumber ? ` • Inv #: ${invoiceNumber}` : ''}${finalPoNumber ? ` • PO #: ${finalPoNumber}` : ''}`;

      dispatchNotificationSystem({
        title: hasReturn ? `💵 Payment & RTV Settled - ${companyName}` : `💵 Cash Payment Logged - ${companyName}`,
        body: notifBody,
        type: "payment",
        url: "/financials/inputs/payments",
        branchId: currentBranch,
        metadata: { companyName, totalAmount: hasReturn ? netTotal : grossTotal, grossTotal, returnDeductionAmount: numReturnAmount, method, invoiceNumber, poNumber: finalPoNumber, storeId: currentBranch }
      });

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Create Payment Record",
        "N/A",
        `Supplier: ${companyName}, Net Paid: EGP ${newPayment.total}${hasReturn ? ` (Gross: EGP ${grossTotal}, Return Deducted: EGP ${numReturnAmount})` : ''}`
      ).catch(() => {});

      // Sync products to secondary Firebase
      if (poItems.length > 0) {
        syncProductsToMaster(poItems, date, companyName);
      }

      // Sync matching credit in credits collection if invoiceNumber or credit category exists
      if (invoiceNumber && (category === "credit" || category === "order")) {
        try {
          const credQuery = query(
            collection(db, "credits"),
            where("invoiceNumber", "==", invoiceNumber.trim()),
            limit(1)
          );
          const credSnap = await getDocs(credQuery);
          if (!credSnap.empty) {
            const cDoc = credSnap.docs[0];
            const cData = cDoc.data();
            const curPaid = Number(cData.paidAmount) || 0;
            const newPaid = curPaid + grossTotal;
            const totDue = (Number(cData.amountDue) || 0) + (Number(cData.tax) || 0);
            const newSt = newPaid >= totDue ? "paid" : (newPaid > 0 ? "partial" : cData.status);
            await updateDoc(doc(db, "credits", cDoc.id), {
              paidAmount: newPaid,
              status: newSt,
              updatedAt: serverTimestamp()
            });
          }
        } catch (cErr) {
          console.warn("Could not sync credit from payments:", cErr);
        }
      }

      toast.success(hasReturn ? (isAr ? "تم حفظ السداد وتسوية المرتجع وطباعة الإيصالات!" : "Payment & Return settled successfully!") : "Payment saved & notification sent!");
      handleCloseModal();
      fetchData();
      const savedPayment = { id: docRef.id, ...newPayment, createdAt: Timestamp.now() };
      setPayments([savedPayment, ...payments]);
      setShowAddModal(false);

      // Auto Print & QR
      setSelectedPaymentForPrint(savedPayment);
      setSavedPaymentForQR(savedPayment);
      setTimeout(() => generatePDF(savedPayment), 500);

    } catch (err) {
      console.error(err);
      toast.error("Failed to save payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewFullReceipt = (url: string) => {
    const newTab = window.open();
    if (newTab) {
      newTab.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>Bank Transfer Receipt</title></head>
          <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0f172a;">
            <img src="${url}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" />
          </body>
        </html>
      `);
      newTab.document.close();
    } else {
      toast.error("Popup blocked! Please allow popups to view the receipt.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    try {
      const paymentItem = payments.find(p => p.id === id);
      await deleteDoc(doc(db, "cash_payments", id));
      notifyFinancialsUpdated(currentBranch);
      setPayments(payments.filter(p => p.id !== id));

      // Cascade delete from credit_payments and update parent credits document if linked
      if (paymentItem?.creditId || paymentItem?.category === "credit") {
        const cId = paymentItem.creditId;
        const pAmt = Number(paymentItem.amount || paymentItem.total || 0);

        try {
          // Delete any duplicate/linked docs in credit_payments
          if (cId) {
            const cpSnap = await getDocs(query(collection(db, "credit_payments"), where("creditId", "==", cId)));
            cpSnap.docs.forEach(d => {
              const dData = d.data();
              if (Math.abs(Number(dData.amount || 0) - pAmt) < 2) {
                deleteDoc(d.ref).catch(() => {});
              }
            });

            // Update parent credit document
            const creditDocRef = doc(db, "credits", cId);
            const creditSnap = await getDoc(creditDocRef);
            if (creditSnap.exists()) {
              const cData = creditSnap.data();
              const totalDue = Number(cData.amountDue || 0) + Number(cData.tax || 0);
              const newPaidAmount = Math.max(0, Number(cData.paidAmount || 0) - pAmt);
              const newStatus = newPaidAmount >= totalDue && totalDue > 0 ? "paid" : "open";
              await updateDoc(creditDocRef, {
                paidAmount: newPaidAmount,
                status: newStatus,
                updatedAt: serverTimestamp()
              });
            }
          }
        } catch (cascadeErr) {
          console.warn("Failed to cascade credit updates upon deleting payment:", cascadeErr);
        }
      }

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Delete Payment Record",
        `ID: ${id}, Supplier: ${paymentItem?.companyName || "N/A"}, Amount: EGP ${paymentItem?.total || 0}`,
        "Deleted"
      ).catch(() => {});

      toast.success("Payment deleted successfully.");
    } catch (err) {
      toast.error("Failed to delete payment.");
    }
  };

  const handleOpenEditPayment = (pay: any) => {
    const role = typeof window !== "undefined" ? localStorage.getItem("circlek_role") : null;
    if (role === "manager") {
      toast.error(isAr ? "غير مصرح. التعديل متاح للمسؤول فقط." : "Unauthorized. Edit is only available for Admin.");
      return;
    }
    setEditingPayment(pay);
    setEditDate(pay.date || new Date().toISOString().split("T")[0]);
    setEditCompanyName(pay.companyName || "");
    setEditAmount(pay.amount !== undefined ? pay.amount.toString() : "");
    setEditTax(pay.tax !== undefined ? pay.tax.toString() : "0");
    setEditInvoiceNumber(pay.invoiceNumber || "");
    setEditPoNumber(pay.poNumber || "");
    setEditCategory(pay.category || "order");
    setEditCategoryNote(pay.categoryNote || pay.description || "");
    setEditMethod(pay.method || "cash");
    setShowEditModal(true);
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
    if (role === "manager") {
      toast.error(isAr ? "غير مصرح لك بتعديل السندات" : "Unauthorized. Only Admins can edit invoices.");
      return;
    }

    if (!editCompanyName.trim() || !editAmount) {
      toast.error(isAr ? "يرجى ملء المورد والمبلغ" : "Supplier name and amount are required.");
      return;
    }

    const numAmount = parseFloat(editAmount) || 0;
    const numTax = parseFloat(editTax) || 0;
    const newTotal = numAmount + numTax;

    // Detect exact changes
    const changes: string[] = [];
    const oldAmount = Number(editingPayment.amount) || 0;
    if (oldAmount !== numAmount) {
      changes.push(`Amount (Before Tax): EGP ${oldAmount.toLocaleString()} ➔ EGP ${numAmount.toLocaleString()}`);
    }

    const oldTax = Number(editingPayment.tax) || 0;
    if (oldTax !== numTax) {
      changes.push(`Tax: EGP ${oldTax.toLocaleString()} ➔ EGP ${numTax.toLocaleString()}`);
    }

    if ((editingPayment.companyName || "") !== editCompanyName.trim()) {
      changes.push(`Supplier: "${editingPayment.companyName || 'N/A'}" ➔ "${editCompanyName.trim()}"`);
    }

    if ((editingPayment.invoiceNumber || "") !== editInvoiceNumber.trim()) {
      changes.push(`Invoice #: "${editingPayment.invoiceNumber || 'N/A'}" ➔ "${editInvoiceNumber.trim() || 'N/A'}"`);
    }

    const effectiveEditPoNumber = (editCategory === "order" || editCategory === "credit" || !!editingPayment.creditId) ? editPoNumber.trim() : "";
    if ((editingPayment.poNumber || "") !== effectiveEditPoNumber) {
      changes.push(`PO #: "${editingPayment.poNumber || 'N/A'}" ➔ "${effectiveEditPoNumber || 'None'}"`);
    }

    if ((editingPayment.date || "") !== editDate) {
      changes.push(`Date: "${editingPayment.date || 'N/A'}" ➔ "${editDate}"`);
    }

    if ((editingPayment.category || "") !== editCategory) {
      changes.push(`Category: "${editingPayment.category || 'N/A'}" ➔ "${editCategory}"`);
    }

    if ((editingPayment.categoryNote || editingPayment.description || "") !== editCategoryNote.trim()) {
      changes.push(`Notes: "${editingPayment.categoryNote || editingPayment.description || 'None'}" ➔ "${editCategoryNote.trim() || 'None'}"`);
    }

    if ((editingPayment.method || "") !== editMethod) {
      changes.push(`Method: "${editingPayment.method || 'cash'}" ➔ "${editMethod}"`);
    }

    if (changes.length === 0) {
      toast.info(isAr ? "لم يتم إجراء أي تعديل" : "No changes detected.");
      setShowEditModal(false);
      setEditingPayment(null);
      return;
    }

    try {
      setSubmitting(true);
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
        amount: numAmount,
        tax: numTax,
        total: newTotal,
        isTaxable: numTax > 0,
        companyName: editCompanyName.trim(),
        invoiceNumber: editInvoiceNumber.trim(),
        poNumber: effectiveEditPoNumber,
        category: editCategory,
        categoryNote: editCategoryNote.trim(),
        description: editCategoryNote.trim(),
        method: editMethod,
        date: editDate,
        isEdited: true,
        lastEditedAt: nowIso,
        lastEditedBy: editorName,
        editHistory: [...(editingPayment.editHistory || []), newHistoryEntry]
      };

      await updateDoc(doc(db, "cash_payments", editingPayment.id), updatedPayload);

      // If linked to a credit, adjust parent credit paidAmount and status
      if (editingPayment.creditId || editingPayment.category === "credit") {
        const cId = editingPayment.creditId;
        const oldTotal = Number(editingPayment.amount || editingPayment.total || 0);
        const diff = newTotal - oldTotal;

        if (cId && diff !== 0) {
          try {
            const creditDocRef = doc(db, "credits", cId);
            const creditSnap = await getDoc(creditDocRef);
            if (creditSnap.exists()) {
              const cData = creditSnap.data();
              const totalDue = Number(cData.amountDue || 0) + Number(cData.tax || 0);
              const newPaidAmount = Math.max(0, Number(cData.paidAmount || 0) + diff);
              const newStatus = newPaidAmount >= totalDue && totalDue > 0 ? "paid" : "open";
              await updateDoc(creditDocRef, {
                paidAmount: newPaidAmount,
                status: newStatus,
                updatedAt: serverTimestamp()
              });
            }
          } catch (cascadeErr) {
            console.warn("Failed to cascade credit updates upon editing payment:", cascadeErr);
          }
        }
      }

      // Update local state
      const updatedDoc = { ...editingPayment, ...updatedPayload };
      setPayments(prev => prev.map(p => p.id === editingPayment.id ? updatedDoc : p));
      if (selectedPaymentForView?.id === editingPayment.id) {
        setSelectedPaymentForView(updatedDoc);
      }

      // Log in audit log system
      dbService.logAction(
        auth.currentUser?.email || editorName,
        auth.currentUser?.displayName || editorName,
        role,
        "Edit Payment Invoice (Admin)",
        `Payment ID: ${editingPayment.id}, Supplier: ${editCompanyName}`,
        `Changes: ${changes.join("; ")}`
      ).catch(() => {});

      toast.success(isAr ? "تم تحديث السند وحفظ سجل التعديل بنجاح!" : "Payment invoice updated & audit logged successfully!");
      setShowEditModal(false);
      setEditingPayment(null);
    } catch (err: any) {
      console.error("Failed to update payment:", err);
      toast.error(isAr ? "فشل تعديل السند" : "Failed to update payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = (paymentToPrint: any) => {
    if (!paymentToPrint) return;
    setSelectedPaymentForPrint(paymentToPrint);
    setGeneratingPDF(true);
  };

  // useEffect: when generatingPDF becomes true and the print wrapper is in the DOM, clone it into an iframe and print
  useEffect(() => {
    if (!generatingPDF || !selectedPaymentForPrint) return;

    let attempts = 0;
    const maxAttempts = 20; // 20 * 100ms = 2 seconds max wait

    const tryPrint = () => {
      attempts++;
      const wrapper = document.getElementById("single-payment-print-wrapper");
      if (!wrapper) {
        if (attempts < maxAttempts) {
          setTimeout(tryPrint, 100);
          return;
        }
        toast.error("Could not prepare receipt for printing.");
        setGeneratingPDF(false);
        return;
      }

      // Create or reuse a hidden iframe
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
        setGeneratingPDF(false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<title>Payment Voucher - ${selectedPaymentForPrint.companyName || ''} - Inv ${selectedPaymentForPrint.invoiceNumber || ''}</title>
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
        setGeneratingPDF(false);
      }, 400);
    };

    // Start polling for the wrapper to appear in DOM
    setTimeout(tryPrint, 100);
  }, [generatingPDF, selectedPaymentForPrint]);

  const generateBulkPDF = async () => {
    if (selectedBulkItems.size === 0) return;
    setIsGeneratingBulkPDF(true);

    const paymentsToPrint = filteredPayments.filter(p => selectedBulkItems.has(p.id));
    setBulkPaymentsForPrint(paymentsToPrint);

    setTimeout(async () => {
      const wrapper = document.getElementById("bulk-payment-print-wrapper");
      if (wrapper) {
        wrapper.style.left = "0";
        wrapper.style.top = "0";
      }
      try {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();

        const coverPage = document.getElementById("pdf-bulk-cover");
        if (coverPage) {
          try {
            const canvas = await html2canvas(coverPage, { scale: 2, useCORS: true, allowTaint: true, logging: false });
            const imgData = canvas.toDataURL("image/png");
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
          } catch (cErr) {
            console.warn("Bulk cover page canvas error:", cErr);
          }
        }

        for (let i = 0; i < paymentsToPrint.length; i++) {
          const p = paymentsToPrint[i];
          const pageId = `pdf-bulk-payment-${p.id}`;
          const page1 = document.getElementById(pageId);
          if (page1) {
            try {
              const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, allowTaint: true, logging: false });
              const imgData1 = canvas1.toDataURL("image/png");
              const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
              pdf.addPage();
              pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
            } catch (pErr) {
              console.warn(`Bulk payment ${p.id} canvas error:`, pErr);
            }
          }

          const invoiceUrls = p.invoiceUrls && p.invoiceUrls.length > 0 ? p.invoiceUrls : (p.invoiceUrl ? [p.invoiceUrl] : []);
          for (let j = 0; j < invoiceUrls.length; j++) {
            const invPage = document.getElementById(`pdf-bulk-payment-${p.id}-invoice-${j}`);
            if (invPage) {
              try {
                const canvasInv = await html2canvas(invPage, { scale: 2, useCORS: true, allowTaint: true, logging: false });
                const imgDataInv = canvasInv.toDataURL("image/jpeg", 0.95);
                const pdfHeightInv = (canvasInv.height * pdfWidth) / canvasInv.width;
                pdf.addPage();
                pdf.addImage(imgDataInv, "JPEG", 0, 0, pdfWidth, pdfHeightInv);
              } catch (invErr) {
                console.warn(`Bulk payment ${p.id} invoice ${j} error:`, invErr);
              }
            }
          }

          const isBankP = p.method === 'bank_transfer' || p.method === 'bank' || !!p.bankTransferReceiptUrl;
          if (isBankP && p.bankTransferReceiptUrl) {
            const bankPage = document.getElementById(`pdf-bulk-payment-${p.id}-bank-receipt`);
            if (bankPage) {
              try {
                const canvasBank = await html2canvas(bankPage, { scale: 2, useCORS: true, allowTaint: true, logging: false });
                const imgDataBank = canvasBank.toDataURL("image/jpeg", 0.95);
                const pdfHeightBank = (canvasBank.height * pdfWidth) / canvasBank.width;
                pdf.addPage();
                pdf.addImage(imgDataBank, "JPEG", 0, 0, pdfWidth, pdfHeightBank);
              } catch (bankErr) {
                console.warn(`Bulk payment ${p.id} bank slip error:`, bankErr);
              }
            }
          }
        }

        pdf.save(`Bulk_Payments_Report_${new Date().getTime()}.pdf`);
        toast.success("Bulk PDF generated successfully!");
      } catch (err) {
        toast.error("Error generating bulk PDF.");
        console.error(err);
      } finally {
        if (wrapper) {
          wrapper.style.left = "-9999px";
        }
        setIsGeneratingBulkPDF(false);
        setBulkPaymentsForPrint([]);
        setSelectedBulkItems(new Set());
      }
    }, 1000);
  };

  // Memoized lookup maps for lightning-fast credit enrichment (O(1) instead of O(N))
  const creditLookup = useMemo(() => {
    const byId = new Map<string, any>();
    const byInv = new Map<string, any>();
    credits.forEach(c => {
      if (c.id) byId.set(c.id, c);
      if (c.invoiceNumber) {
        const key = `${c.invoiceNumber.toLowerCase().trim()}___${(c.companyName || "").toLowerCase().trim()}`;
        byInv.set(key, c);
      }
    });
    return { byId, byInv };
  }, [credits]);

  // Helper to enrich payment with linked credit data (PO, items, invoice images) if missing
  const getEnrichedPayment = useCallback((p: any) => {
    if (!p) return p;

    // Fast O(1) matching credit lookup
    let matchingCredit = null;
    if (p.creditId) {
      matchingCredit = creditLookup.byId.get(p.creditId);
    }
    if (!matchingCredit && p.invoiceNumber) {
      const key = `${p.invoiceNumber.toLowerCase().trim()}___${(p.companyName || "").toLowerCase().trim()}`;
      matchingCredit = creditLookup.byInv.get(key) || credits.find(c => c.invoiceNumber === p.invoiceNumber);
    }
    if (!matchingCredit && p.poNumber) {
      matchingCredit = credits.find(c => c.poNumber && c.poNumber === p.poNumber);
    }

    const enriched = { ...p };

    if (matchingCredit) {
      if (!enriched.poNumber && matchingCredit.poNumber) {
        enriched.poNumber = matchingCredit.poNumber;
      }
      if ((!enriched.items || enriched.items.length === 0) && matchingCredit.items && matchingCredit.items.length > 0) {
        enriched.items = matchingCredit.items;
      }
      if (!enriched.poImageUrl) {
        enriched.poImageUrl = matchingCredit.poImageUrl || matchingCredit.poUrl || (matchingCredit.poUrls && matchingCredit.poUrls[0]) || "";
      }
      if (!enriched.invoiceUrl && matchingCredit.invoiceUrl) {
        enriched.invoiceUrl = matchingCredit.invoiceUrl;
      }
      if ((!enriched.invoiceUrls || enriched.invoiceUrls.length === 0) && matchingCredit.invoiceUrls && matchingCredit.invoiceUrls.length > 0) {
        enriched.invoiceUrls = matchingCredit.invoiceUrls;
      } else if ((!enriched.invoiceUrls || enriched.invoiceUrls.length === 0) && matchingCredit.invoiceUrl) {
        enriched.invoiceUrls = [matchingCredit.invoiceUrl];
      }
      if (!enriched.managerSignature && matchingCredit.managerSignature) {
        enriched.managerSignature = matchingCredit.managerSignature;
      }
    }

    // Standardize all items so barcode, description, name, quantity, unitPrice, price, total, totalPrice are ALWAYS defined
    if (enriched.items && Array.isArray(enriched.items) && enriched.items.length > 0) {
      enriched.items = enriched.items.map((it: any) => {
        const itemDesc = (it.description || it.name || it.itemName || it.item || "صنف").trim();
        const itemQty = Math.max(1, Number(it.quantity ?? it.qty ?? 1) || 1);
        const itemPrice = Number(it.unitPrice ?? it.price ?? 0);
        const itemTotal = Number(it.total ?? it.totalPrice ?? (itemQty * itemPrice));
        return {
          ...it,
          barcode: (it.barcode && it.barcode !== "N/A" ? it.barcode : (it.code || "N/A")).toString().trim(),
          description: itemDesc,
          name: itemDesc,
          itemName: itemDesc,
          quantity: itemQty,
          unitPrice: itemPrice,
          price: itemPrice,
          total: itemTotal,
          totalPrice: itemTotal
        };
      });
    }

    return enriched;
  }, [creditLookup, credits]);

  // Derived filtered data with Time Presets support (early filter eliminates unnecessary processing)
  const filteredPayments = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const q = searchQuery ? searchQuery.toLowerCase().trim() : "";
    const result: any[] = [];

    for (let i = 0; i < payments.length; i++) {
      const raw = payments[i];
      // Quick pre-filtering by time preset and month
      if (timePreset === "today") {
        if (raw.date !== todayStr) continue;
      } else if (timePreset === "yesterday") {
        if (raw.date !== yestStr) continue;
      } else if (timePreset === "this_week") {
        if (!raw.date || raw.date < weekAgoStr || raw.date > todayStr) continue;
      } else if (monthFilter && raw.date && !raw.date.startsWith(monthFilter)) {
        continue;
      }

      const p = getEnrichedPayment(raw);

      // Search Filter
      if (q) {
        const matches = (
          p.companyName?.toLowerCase().includes(q) ||
          p.invoiceNumber?.toLowerCase().includes(q) ||
          p.poNumber?.toLowerCase().includes(q) ||
          p.date?.toLowerCase().includes(q) ||
          p.supplierRepName?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.items?.some((it: any) => (it.description || it.itemName || it.barcode)?.toLowerCase().includes(q))
        );
        if (!matches) continue;
      }

      result.push(p);
    }

    return result;
  }, [payments, monthFilter, searchQuery, timePreset, getEnrichedPayment]);

  // Executive HUD Metrics & Financial Velocity
  const totalFilteredSpend = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  }, [filteredPayments]);

  const burnRate = useMemo(() => {
    if (filteredPayments.length === 0) return 0;
    const uniqueDays = new Set(filteredPayments.map(p => p.date).filter(Boolean)).size;
    return totalFilteredSpend / Math.max(1, uniqueDays);
  }, [filteredPayments, totalFilteredSpend]);

  const momMetrics = useMemo(() => {
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const curSpend = payments.filter(p => p.date?.startsWith(curMonthKey)).reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const prevSpend = payments.filter(p => p.date?.startsWith(prevMonthKey)).reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    let deltaPercent = 0;
    if (prevSpend > 0) {
      deltaPercent = ((curSpend - prevSpend) / prevSpend) * 100;
    }
    return { curSpend, prevSpend, deltaPercent };
  }, [payments]);

  const largestOutgoing = useMemo(() => {
    if (filteredPayments.length === 0) return null;
    return filteredPayments.reduce((max, p) => (Number(p.total) || 0) > (Number(max.total) || 0) ? p : max, filteredPayments[0]);
  }, [filteredPayments]);

  const velocitySparklineData = useMemo(() => {
    if (filteredPayments.length === 0) return [];
    const byDate: Record<string, number> = {};
    filteredPayments.forEach(p => {
      if (!p.date) return;
      byDate[p.date] = (byDate[p.date] || 0) + (Number(p.total) || 0);
    });
    const sortedDates = Object.keys(byDate).sort();
    let cumulative = 0;
    return sortedDates.map(d => {
      cumulative += byDate[d];
      return { date: d.slice(5), amount: byDate[d], cumulative };
    });
  }, [filteredPayments]);

  // Aggregate Category Stats for the top cards & method totals
  const { categoryStats, methodTotals } = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    const methods = { cash: 0, visa: 0, bank_transfer: 0 };
    filteredPayments.forEach(p => {
      const cat = p.category || "other";
      if (!stats[cat]) stats[cat] = { count: 0, total: 0 };
      stats[cat].count += 1;
      stats[cat].total += (p.total || 0);

      const m = p.method as keyof typeof methods;
      if (methods[m] !== undefined) {
        methods[m] += (Number(p.total) || 0);
      }
    });
    return { categoryStats: stats, methodTotals: methods };
  }, [filteredPayments]);

  // Derived Supplier Profile Data
  const supplierProfileData = useMemo(() => {
    if (!selectedSupplierProfile) return null;

    // 1. Filter payments for this supplier
    const sPayments = payments.filter(p => p.companyName?.toUpperCase() === selectedSupplierProfile.toUpperCase());
    sPayments.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    // 2. Lifetime Spend (Total Amount including Tax Paid)
    const lifetimeSpend = sPayments.reduce((sum, p) => {
      const pAmt = Number(p.amount) || 0;
      const pTax = Number(p.tax) || 0;
      const pTot = Number(p.total) || 0;
      const totalWithTax = pTot >= (pAmt + pTax) && pTot > 0 ? pTot : (pAmt + pTax);
      return sum + totalWithTax;
    }, 0);

    // 3. Outstanding Debt (from credits including tax)
    const sCredits = credits.filter(c => c.companyName?.toUpperCase() === selectedSupplierProfile.toUpperCase() && c.status === "open");
    const outstandingDebt = sCredits.reduce((sum, c) => {
      const due = (parseFloat(c.amountDue) || 0) + (parseFloat(c.tax) || 0);
      const paid = parseFloat(c.paidAmount) || 0;
      return sum + Math.max(0, due - paid);
    }, 0);

    // 4. Sparkline Trend (last 6 months including tax)
    const monthlyTotals: Record<string, number> = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // include current month + 5 previous
    sixMonthsAgo.setDate(1);

    sPayments.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      if (d >= sixMonthsAgo) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const pAmt = Number(p.amount) || 0;
        const pTax = Number(p.tax) || 0;
        const pTot = Number(p.total) || 0;
        const totalWithTax = pTot >= (pAmt + pTax) && pTot > 0 ? pTot : (pAmt + pTax);
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + totalWithTax;
      }
    });

    const trendData = Object.entries(monthlyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }));

    let hasPriceHike = false;
    if (trendData.length >= 2) {
      const latestMonthTotal = trendData[trendData.length - 1].total;
      const prevMonths = trendData.slice(0, trendData.length - 1);
      const avgPrev = prevMonths.reduce((sum, t) => sum + t.total, 0) / prevMonths.length;
      if (avgPrev > 0 && latestMonthTotal > (avgPrev * 1.2)) {
        hasPriceHike = true;
      }
    }

    return { sPayments, lifetimeSpend, outstandingDebt, trendData, hasPriceHike };
  }, [selectedSupplierProfile, payments, credits]);

  const handleGenerateSOA = () => {
    if (!selectedSupplierProfile || !supplierProfileData) return;
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      pdf.setFontSize(22);
      pdf.text(`Vendor Statement of Account`, 20, 20);
      pdf.setFontSize(14);
      pdf.setTextColor(100);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);

      pdf.setTextColor(0);
      pdf.setFontSize(16);
      pdf.text(`Supplier: ${selectedSupplierProfile}`, 20, 50);
      pdf.text(`Outstanding Debt: EGP ${supplierProfileData.outstandingDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, 60);
      pdf.text(`Lifetime Spend (Incl. Tax): EGP ${supplierProfileData.lifetimeSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, 70);

      pdf.setFontSize(14);
      pdf.text(`Recent Paid Invoices & Receipts (Total Amount Incl. Tax):`, 20, 90);
      pdf.setFontSize(10);

      let y = 100;
      supplierProfileData.sPayments.slice(0, 20).forEach((p, i) => {
        const pAmt = Number(p.amount) || 0;
        const pTax = Number(p.tax) || 0;
        const pTot = Number(p.total) || 0;
        const totalWithTax = pTot >= (pAmt + pTax) && pTot > 0 ? pTot : (pAmt + pTax);

        const lineStr = `${p.date}   |   EGP ${totalWithTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Tax: EGP ${pTax.toLocaleString()})   |   Inv: ${p.invoiceNumber || 'N/A'}`;
        pdf.text(lineStr, 20, y);
        y += 8;
      });

      pdf.save(`SOA_${selectedSupplierProfile}.pdf`);

      // Open WhatsApp
      const waText = encodeURIComponent(`Hello ${selectedSupplierProfile} team. Please find our Statement of Account attached (downloaded to my device). Our records show an outstanding debt of EGP ${supplierProfileData.outstandingDebt.toLocaleString()} and a total spend of EGP ${supplierProfileData.lifetimeSpend.toLocaleString()} (including tax paid).`);
      window.open(`https://wa.me/?text=${waText}`, '_blank');
      toast.success("SOA Generated! Please attach the downloaded PDF in WhatsApp.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate SOA.");
    }
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#070709] text-white font-sans selection:bg-rose-500 selection:text-white pb-28 relative overflow-x-hidden"
      onMouseMove={handleContainerMouseMove}
    >
      {/* LUXURY RADIAL AMBIENT BACKGROUND GLOWS & CURSOR SPOTLIGHT */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[650px] h-[650px] bg-gradient-to-br from-rose-600/15 via-red-600/5 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[30%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-purple-600/10 via-indigo-600/5 to-transparent rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[700px] h-[700px] bg-gradient-to-tr from-emerald-600/10 via-teal-600/5 to-transparent rounded-full blur-[160px]" />
        
        {/* Dynamic Cursor-Reactive Ambient Spotlight (Updated via ref for 120fps hardware acceleration) */}
        <div
          ref={spotlightRef}
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        />

        {/* Subtle VIP Grid Mesh Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.025]" 
          style={{ 
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`, 
            backgroundSize: "24px 24px" 
          }} 
        />
      </div>

      {isSyncing && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16161d]/90 border border-rose-500/30 text-rose-400 text-xs font-bold shadow-2xl backdrop-blur-md animate-pulse pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          <span>{isAr ? "مزامنة لحظية..." : "Live cloud sync..."}</span>
        </div>
      )}

      <div className="relative z-10 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-5 sm:space-y-7">

        {/* TOP VIP HEADER STRIP */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/[0.07]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-red-500/10 via-rose-500/10 to-amber-500/10 border border-rose-500/20 text-rose-400 text-xs font-black tracking-wider uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>{isAr ? "العمليات المالية • إدارة المصروفات والمدفوعات" : "Financial Operations • Corporate Outgoings"}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {isAr ? (
                <>
                  إدارة ومراقبة{" "}
                  <span className="bg-gradient-to-r from-rose-400 via-red-300 to-amber-300 bg-clip-text text-transparent">
                    المدفوعات
                  </span>
                </>
              ) : (
                <>
                  Payments{" "}
                  <span className="bg-gradient-to-r from-rose-400 via-red-300 to-amber-300 bg-clip-text text-transparent">
                    Control
                  </span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-normal mt-1">
              {isAr ? "متابعة وإدارة جميع مدفوعات ومصروفات الشركة والفرع." : "Track and manage all corporate outgoings."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer">
              <FileDown size={16} /> {isAr ? "تصدير الكل" : "Export All"}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-red-600/30 border border-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #E11D48, #F97316)', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}
            >
              <Plus size={18} /> {isAr ? "تسجيل مدفوعات جديدة" : "Record Payment"}
            </button>
          </div>
        </div>

        {/* EXECUTIVE FLOATING HUD & SPEND VELOCITY STRIP */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Total Period Spend */}
          <div className="rounded-[22px] p-4 bg-[#111116] border border-white/[0.08] shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-rose-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isAr ? "إجمالي المنصرف" : "Total Outgoings"}
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Activity size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                <span className="text-xs font-bold text-rose-400 mr-1">EGP</span>
                <RollingNumber value={totalFilteredSpend} />
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {filteredPayments.length} {isAr ? "سند دفع معتمد" : "vouchers reconciled"}
              </span>
            </div>
          </div>

          {/* Card 2: Daily Burn Rate */}
          <div className="rounded-[22px] p-4 bg-[#111116] border border-white/[0.08] shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-amber-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isAr ? "معدل الصرف اليومي" : "Daily Burn Rate"}
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Flame size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                <span className="text-xs font-bold text-amber-400 mr-1">EGP</span>
                <RollingNumber value={burnRate} decimals={0} />
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {isAr ? "متوسط سرعة الاستنزاف / يوم" : "Avg velocity per active day"}
              </span>
            </div>
          </div>

          {/* Card 3: MoM Comparison Delta */}
          <div className="rounded-[22px] p-4 bg-[#111116] border border-white/[0.08] shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-indigo-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isAr ? "المقارنة الشهرية" : "MoM Trajectory"}
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${momMetrics.deltaPercent <= 0 ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-rose-500/15 border border-rose-500/30 text-rose-400"}`}>
                {momMetrics.deltaPercent <= 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${momMetrics.deltaPercent <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {momMetrics.deltaPercent >= 0 ? "+" : ""}{momMetrics.deltaPercent.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {momMetrics.deltaPercent <= 0 ? (isAr ? "وفورات" : "Savings") : (isAr ? "زيادة" : "Expansion")}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate">
                {isAr ? `السابق: ${momMetrics.prevSpend.toLocaleString()} ج.م` : `vs EGP ${momMetrics.prevSpend.toLocaleString()} prev`}
              </span>
            </div>
          </div>

          {/* Card 4: Top Outgoing Record */}
          <div className="rounded-[22px] p-4 bg-[#111116] border border-white/[0.08] shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-purple-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isAr ? "أكبر دفعة فردية" : "Largest Outgoing"}
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sparkles size={14} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black font-mono text-white tracking-tight truncate">
                <span className="text-xs font-bold text-purple-400 mr-1">EGP</span>
                {largestOutgoing ? Number(largestOutgoing.total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "0"}
              </div>
              <span className="text-[10px] text-slate-400 font-bold truncate block mt-0.5" title={largestOutgoing?.companyName}>
                {largestOutgoing?.companyName || (isAr ? "لا توجد سجلات" : "No records")}
              </span>
            </div>
          </div>

          {/* Card 5: Mini Velocity Area Sparkline (Visible on XL) */}
          <div className="hidden xl:flex rounded-[22px] p-4 bg-[#111116] border border-white/[0.08] shadow-xl relative overflow-hidden flex-col justify-between group hover:border-rose-500/40 transition-all col-span-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isAr ? "منحنى التدفق" : "Velocity Sparkline"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                +{velocitySparklineData.length} pts
              </span>
            </div>
            <div className="h-10 w-full mt-1">
              {velocitySparklineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocitySparklineData}>
                    <defs>
                      <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="cumulative" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#velocityGrad)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-mono">
                  Flatline
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DASHBOARD TOP BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut Chart Bento Presentation Card */}
          <div className="lg:col-span-1 rounded-[28px] p-6 bg-[#111116] border border-white/[0.08] hover:border-rose-500/30 shadow-2xl relative overflow-hidden flex flex-col justify-between transition-all group">
            <div className="absolute top-[-30px] right-[-30px] w-48 h-48 bg-gradient-to-br from-rose-500/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <PieChartIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">
                      {isAr ? "توزيع المصروفات" : "Spending Breakdown"}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {isAr ? "تحليل النفقات حسب الفئة" : "Outgoings by category"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                {Object.keys(categoryStats).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(categoryStats).map(([name, val]) => ({ name, value: val.total }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={82}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {Object.entries(categoryStats).map(([name], index) => {
                          const COLORS = ['#e11d48', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#a1a1aa'];
                          return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                        })}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any) => `EGP ${Number(value).toLocaleString()}`}
                        contentStyle={{ background: '#16161d', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAFA', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 font-medium text-xs">
                    {isAr ? "لا توجد بيانات لهذه الفترة" : "No data for this period"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Category Intelligence Bento Grid */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
            {categoryStats["order"] && (
              <motion.div whileHover={{ y: -4 }} className="rounded-[24px] p-5 bg-[#111116] border border-blue-500/30 hover:border-blue-400/60 shadow-xl relative overflow-hidden group transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Package size={18} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-blue-300 font-mono">
                      {categoryStats["order"].count} {isAr ? "سند" : "payment(s)"}
                    </span>
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-blue-400 block mb-1">
                    {isAr ? "طلبات وبضائع" : "Order"}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black font-mono text-white tracking-tight relative z-10">
                    <span className="text-xs font-bold text-blue-400/80 mr-1">EGP</span>
                    <RollingNumber value={categoryStats["order"].total} />
                  </p>
                </div>
              </motion.div>
            )}
            {categoryStats["utilities"] && (
              <motion.div whileHover={{ y: -4 }} className="rounded-[24px] p-5 bg-[#111116] border border-amber-500/30 hover:border-amber-400/60 shadow-xl relative overflow-hidden group transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Zap size={18} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-amber-300 font-mono">
                      {categoryStats["utilities"].count} {isAr ? "سند" : "payment(s)"}
                    </span>
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-amber-400 block mb-1">
                    {isAr ? "المرافق والخدمات" : "Utilities"}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black font-mono text-white tracking-tight relative z-10">
                    <span className="text-xs font-bold text-amber-400/80 mr-1">EGP</span>
                    <RollingNumber value={categoryStats["utilities"].total} />
                  </p>
                </div>
              </motion.div>
            )}
            {categoryStats["maintenance"] && (
              <motion.div whileHover={{ y: -4 }} className="rounded-[24px] p-5 bg-[#111116] border border-purple-500/30 hover:border-purple-400/60 shadow-xl relative overflow-hidden group transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Wrench size={18} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-purple-300 font-mono">
                      {categoryStats["maintenance"].count} {isAr ? "سند" : "payment(s)"}
                    </span>
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-purple-400 block mb-1">
                    {isAr ? "الصيانة" : "Maintenance"}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black font-mono text-white tracking-tight relative z-10">
                    <span className="text-xs font-bold text-purple-400/80 mr-1">EGP</span>
                    <RollingNumber value={categoryStats["maintenance"].total} />
                  </p>
                </div>
              </motion.div>
            )}
            {categoryStats["transportation"] && (
              <motion.div whileHover={{ y: -4 }} className="rounded-[24px] p-5 bg-[#111116] border border-emerald-500/30 hover:border-emerald-400/60 shadow-xl relative overflow-hidden group transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Truck size={18} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-emerald-300 font-mono">
                      {categoryStats["transportation"].count} {isAr ? "سند" : "payment(s)"}
                    </span>
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-emerald-400 block mb-1">
                    {isAr ? "النقل والنولون" : "Transportation"}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black font-mono text-white tracking-tight relative z-10">
                    <span className="text-xs font-bold text-emerald-400/80 mr-1">EGP</span>
                    <RollingNumber value={categoryStats["transportation"].total} />
                  </p>
                </div>
              </motion.div>
            )}
            {categoryStats["other"] && (
              <motion.div whileHover={{ y: -4 }} className="rounded-[24px] p-5 bg-[#111116] border border-rose-500/30 hover:border-rose-400/60 shadow-xl relative overflow-hidden group transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-500/20 via-red-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <FileText size={18} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-rose-300 font-mono">
                      {categoryStats["other"].count} {isAr ? "سند" : "payment(s)"}
                    </span>
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-rose-400 block mb-1">
                    {isAr ? "مصروفات أخرى" : "Other"}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black font-mono text-white tracking-tight relative z-10">
                    <span className="text-xs font-bold text-rose-400/80 mr-1">EGP</span>
                    <RollingNumber value={categoryStats["other"].total} />
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* TIME PRESETS & VIEW MODE STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Quick Presets Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#111116] border border-white/[0.08] shadow-lg overflow-x-auto max-w-full">
            {[
              { id: "this_month", label: isAr ? "الشهر الحالي" : "This Month" },
              { id: "today", label: isAr ? "اليوم" : "Today" },
              { id: "yesterday", label: isAr ? "أمس" : "Yesterday" },
              { id: "this_week", label: isAr ? "هذا الأسبوع" : "This Week" },
              { id: "last_month", label: isAr ? "الشهر السابق" : "Last Month" },
              { id: "all", label: isAr ? "كل السجلات" : "All Time" },
            ].map((preset) => {
              const active = timePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectTimePreset(preset.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-900/40 border border-white/20"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#111116] border border-white/[0.08] shadow-lg">
            <button
              onClick={() => setViewMode("bento")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "bento"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title={isAr ? "عرض البطاقات الموسع" : "Bento Card View"}
            >
              <LayoutGrid size={14} />
              <span>{isAr ? "بطاقات" : "Bento"}</span>
            </button>
            <button
              onClick={() => setViewMode("ledger")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "ledger"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title={isAr ? "عرض الجدول المحاسبي عالي الكثافة" : "Compact Ledger View"}
            >
              <Rows size={14} />
              <span>{isAr ? "جدول محاسبي" : "Ledger"}</span>
            </button>
          </div>
        </div>

        {/* SEARCH & MONTH PICKER BAR */}
        <div className="bg-[#111116] border border-white/[0.08] focus-within:border-rose-500/40 p-2 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 transition-all">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={isAr ? "ابحث باسم الشركة، رقم الفاتورة، أو أمر الشراء..." : "Search company, invoice, PO number..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-transparent focus:bg-white/[0.03] transition-colors border-none outline-none text-white placeholder:text-slate-500 text-xs font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  if (!monthFilter) {
                    const today = new Date();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    setMonthFilter(`${today.getFullYear()}-${mm}`);
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
                title={isAr ? "مسح البحث" : "Clear search"}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="h-px md:h-auto md:w-px bg-white/[0.08]"></div>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setTimePreset("custom");
            }}
            className="w-full md:w-64 px-4 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] focus:bg-white/[0.05] transition-colors border border-white/[0.06] outline-none text-white text-xs font-mono font-bold cursor-pointer"
          />
        </div>

        {/* BULK ACTION BAR */}
        {selectedBulkItems.size > 0 && (
          <div className="bg-[#111116] border border-blue-500/40 rounded-2xl p-4 flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 text-blue-400">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center font-bold text-xs text-blue-300 font-mono">
                {selectedBulkItems.size}
              </div>
              <span className="font-bold text-xs text-white">Payments Selected</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedBulkItems(new Set())}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={generateBulkPDF}
                disabled={isGeneratingBulkPDF}
                className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-600/30 border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isGeneratingBulkPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer size={15} />}
                {isGeneratingBulkPDF ? 'Generating...' : 'Bulk Print PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Mobile-Only Summary & Method Filter Pills (Strictly md:hidden) */}
        <div className="md:hidden space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-[#111116] border border-emerald-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Cash Paid</p>
              <p className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                EGP {methodTotals.cash.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#111116] border border-blue-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Visa Paid</p>
              <p className="text-sm font-black font-mono text-blue-400 mt-0.5">
                EGP {methodTotals.visa.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#111116] border border-purple-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Bank Transfer</p>
              <p className="text-sm font-black font-mono text-purple-400 mt-0.5">
                EGP {methodTotals.bank_transfer.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ALL RECORDS HEADER */}
        <div className="flex items-center justify-between pt-2 px-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
              checked={filteredPayments.length > 0 && selectedBulkItems.size === filteredPayments.length}
              onChange={handleSelectAllBulkItems}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                {isAr ? "كافة السجلات" : "All Records"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/[0.06] text-slate-300 border border-white/[0.08] font-mono">
                {filteredPayments.length}
              </span>
            </div>
          </div>
        </div>

        {/* Highlight notification banner if navigated from credit payment settlement */}
        {highlightPaymentId && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-black">
                ✨
              </span>
              <div>
                <h4 className="text-xs font-black text-white">
                  {isAr ? "تم تسجيل سداد الدين وخصم المرتجع بنجاح!" : "Credit Payment & Return Settled Successfully!"}
                </h4>
                <p className="text-[11px] text-amber-200/80">
                  {isAr ? "تم إدراج الدفعة المحدثة في الدفاتر وسجل المدفوعات أدناه وتم تمييزها." : "The updated voucher has been reconciled into the ledger below."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setHighlightPaymentId(null)}
              className="px-3 py-1 text-xs font-black rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200"
            >
              {isAr ? "إغلاق" : "Dismiss"}
            </button>
          </div>
        )}

        {/* Data List for Mobile Portrait, Landscape & Desktop */}
        <div className="space-y-3 sm:space-y-4">
          {viewMode === "ledger" ? (
            <div className="overflow-x-auto rounded-[24px] bg-[#111116] border border-white/[0.08] shadow-2xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0e0e13] border-b border-white/[0.08] text-[10px] font-black uppercase tracking-wider text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded text-rose-600 accent-rose-600 cursor-pointer"
                        checked={filteredPayments.length > 0 && selectedBulkItems.size === filteredPayments.length}
                        onChange={handleSelectAllBulkItems}
                      />
                    </th>
                    <th className="p-3.5 whitespace-nowrap">{isAr ? "التاريخ" : "Date"}</th>
                    <th className="p-3.5">{isAr ? "الشركة والمورد" : "Supplier & Category"}</th>
                    <th className="p-3.5">{isAr ? "الفاتورة / أمر الشراء" : "Invoice & PO"}</th>
                    <th className="p-3.5">{isAr ? "طريقة الدفع" : "Method"}</th>
                    <th className="p-3.5 text-right whitespace-nowrap">{isAr ? "المبلغ الصافي" : "Net Amount"}</th>
                    <th className="p-3.5 text-center">{isAr ? "الحالة" : "Status"}</th>
                    <th className="p-3.5 text-right whitespace-nowrap">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredPayments.map((pay) => {
                    const isSelected = selectedBulkItems.has(pay.id);
                    return (
                      <tr
                        key={pay.id}
                        onClick={() => handleSelectBulkItem(pay.id)}
                        className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                          highlightPaymentId === pay.id ? "bg-amber-500/[0.15] ring-2 ring-amber-400" : (isSelected ? "bg-rose-500/[0.06]" : "")
                        }`}
                      >
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-rose-600 accent-rose-600 cursor-pointer"
                            checked={isSelected}
                            onChange={() => handleSelectBulkItem(pay.id)}
                          />
                        </td>
                        <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                          {pay.date}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-rose-300 flex items-center justify-center font-black text-[10px]">
                              {pay.companyName ? pay.companyName.substring(0, 2).toUpperCase() : "NA"}
                            </span>
                            <div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSupplierProfile(pay.companyName);
                                }}
                                className="font-bold text-white hover:text-rose-400 text-left transition-colors truncate max-w-[180px] block"
                              >
                                {pay.companyName}
                              </button>
                              <span className="text-[10px] text-slate-400">
                                {CATEGORY_EMOJIS[pay.category]} {pay.category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] whitespace-nowrap">
                          {pay.poNumber ? (
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold mr-1">
                              PO #{pay.poNumber}
                            </span>
                          ) : null}
                          {pay.invoiceNumber ? (
                            <span className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                              Inv #{pay.invoiceNumber}
                            </span>
                          ) : (!pay.poNumber && <span className="text-slate-600">-</span>)}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <PaymentMethodBadge method={pay.method} />
                        </td>
                        <td className="p-3.5 text-right font-mono whitespace-nowrap">
                          <span className="font-black text-rose-400 text-sm">
                            <span className="text-[10px] text-rose-400/70 mr-1 font-bold">EGP</span>
                            {Number(pay.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {pay.hasReturn && (pay.grossAmount || pay.grossTotal) && (
                            <div className="text-[9px] text-slate-500 line-through">
                              Gross: EGP {Number(pay.grossTotal || pay.grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {pay.hasReturn && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                RTV
                              </span>
                            )}
                            {pay.isEdited && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                Edited
                              </span>
                            )}
                            {Number(pay.tax) > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/[0.04] text-slate-400">
                                Tax: {Number(pay.tax).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedPaymentForView(pay);
                                playPrinterSound();
                              }}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-colors"
                              title="View Receipt"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPaymentForPrint(pay);
                                setTimeout(() => generatePDF(pay), 100);
                              }}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-colors"
                              title="Print PDF"
                            >
                              <Download size={13} />
                            </button>
                            {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                              <>
                                <button
                                  onClick={() => handleOpenEditPayment(pay)}
                                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-amber-400 border border-white/[0.08] transition-colors"
                                  title="Edit Payment"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleDelete(pay.id)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                                  title="Delete Payment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <AnimatePresence>
              {filteredPayments.map((pay, idx) => {
                const initials = pay.companyName ? pay.companyName.substring(0, 2).toUpperCase() : "NA";
                const colors = [
                  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
                  'bg-rose-500/15 text-rose-300 border-rose-500/30',
                  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                  'bg-amber-500/15 text-amber-300 border-amber-500/30',
                  'bg-sky-500/15 text-sky-300 border-sky-500/30'
                ];
                const charCode = pay.companyName ? pay.companyName.charCodeAt(0) : 0;
                const avatarColor = colors[charCode % colors.length];

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    key={pay.id}
                    className={`bg-[#111116] hover:bg-[#16161d] border rounded-2xl shadow-xl hover:border-rose-500/40 transition-all overflow-hidden group ${
                      highlightPaymentId === pay.id ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-amber-500/20 bg-amber-500/[0.05]' :
                      selectedBulkItems.has(pay.id) ? 'border-rose-500/60 ring-1 ring-rose-500/40' : 'border-white/[0.08]'
                    }`}
                  >
                    <div className="p-3.5 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 relative">
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                        <input
                          type="checkbox"
                          checked={selectedBulkItems.has(pay.id)}
                          onChange={() => handleSelectBulkItem(pay.id)}
                          className="w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer mr-1 flex-shrink-0"
                        />
                        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center font-black text-sm sm:text-base tracking-tight flex-shrink-0 group-hover:scale-105 transition-transform ${avatarColor}`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <button
                              onClick={() => setSelectedSupplierProfile(pay.companyName)}
                              className="text-base sm:text-lg font-black text-white uppercase tracking-tight hover:text-rose-300 hover:underline text-left transition-colors truncate max-w-[200px] sm:max-w-none flex items-center gap-1 group/name cursor-pointer"
                            >
                              {pay.companyName}
                              <ChevronRight className="w-4 h-4 opacity-0 group-hover/name:opacity-100 transition-opacity -ml-1 text-rose-400" />
                            </button>
                            <span className="bg-white/[0.05] text-slate-300 border border-white/[0.08] text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              {CATEGORY_EMOJIS[pay.category]} <span className="capitalize">{pay.category}</span>
                            </span>
                            <PaymentMethodBadge method={pay.method} />
                            {pay.hasReturn && (
                              <span 
                                className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 cursor-pointer hover:bg-amber-500/25 transition-colors"
                                title={isAr ? `خصم مرتجع: ${Number(pay.returnDeductionAmount || 0).toLocaleString()} ج.م` : `RTV Deduction: EGP ${Number(pay.returnDeductionAmount || 0).toLocaleString()}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPaymentForView(pay);
                                }}
                              >
                                <RotateCcw size={11} className="text-amber-400" />
                                <span>{isAr ? `مرتجع: ${Number(pay.returnDeductionAmount || 0).toLocaleString()} ج.م` : `RTV: EGP ${Number(pay.returnDeductionAmount || 0).toLocaleString()}`}</span>
                              </span>
                            )}
                            {pay.isEdited && (
                              <span 
                                className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/25 transition-colors"
                                title={pay.editHistory && pay.editHistory.length > 0 ? `Edited on ${new Date(pay.lastEditedAt).toLocaleDateString()}:\n${pay.editHistory[pay.editHistory.length - 1].summary}` : "Edited"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPaymentForView(pay);
                                }}
                              >
                                <Pencil size={11} className="shrink-0" /> {isAr ? "مُعدّل" : "Edited"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-slate-400 flex flex-wrap items-center gap-2 font-mono">
                            <span>{pay.date}</span>
                            {(pay.invoiceNumber || pay.poNumber) && (
                              <>
                                <span className="text-slate-600">•</span>
                                {pay.invoiceNumber && <span>Inv: {pay.invoiceNumber}</span>}
                                {pay.invoiceNumber && pay.poNumber && <span> | </span>}
                                {pay.poNumber && <span>PO: {pay.poNumber}</span>}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/[0.06] pt-2.5 md:pt-0">
                        <div className="text-left md:text-right">
                          <p className="text-xl sm:text-2xl font-black text-rose-400 tracking-tight font-mono">
                            <span className="text-xs sm:text-sm font-bold text-rose-400/70 mr-1">EGP</span>
                            {Number(pay.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {pay.hasReturn && (pay.grossAmount || pay.grossTotal) && (
                            <p className="text-[10px] text-slate-500 font-mono line-through mt-0.5">
                              {isAr ? `الأصلي: ` : `Gross: `}
                              EGP {Number(pay.grossTotal || pay.grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {(pay.category === "order" || pay.category === "credit" || !!pay.creditId) && (!pay.poNumber && !pay.poImageUrl && (!pay.items || pay.items.length === 0)) && (
                            <button
                              onClick={() => setSelectedPaymentForPoUpload(pay)}
                              className="text-xs font-bold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 mr-1 cursor-pointer"
                            >
                              <Plus size={13} /> Add PO
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedPaymentForView(pay);
                              playPrinterSound();
                            }}
                            className="p-2.5 text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-all cursor-pointer"
                            title="View Receipt"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPaymentForPrint(pay);
                              setTimeout(() => generatePDF(pay), 100);
                            }}
                            className="p-2.5 text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-all cursor-pointer"
                            title="Print Voucher"
                          >
                            <Download size={18} />
                          </button>
                          {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                            <>
                              <button
                                onClick={() => handleOpenEditPayment(pay)}
                                className="p-2.5 text-slate-400 hover:text-amber-400 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-all cursor-pointer"
                                title={isAr ? "تعديل الفاتورة (خاص بالإدارة)" : "Edit Payment (Admin Only)"}
                              >
                                <Pencil size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(pay.id)} 
                                className="p-2.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all cursor-pointer" 
                                title={isAr ? "حذف السند" : "Delete Payment"}
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {filteredPayments.length === 0 && (
            <div className="text-center py-20 text-slate-400 font-medium text-xs bg-[#111116] border border-white/[0.08] rounded-3xl relative overflow-hidden flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                <FileText size={32} className="opacity-40" />
              </div>
              <h4 className="text-base font-black text-white mb-1">
                {isAr ? "لا توجد سندات أو مدفوعات مطابقة" : "No Payments Found"}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                {isAr ? "جرّب تغيير التاريخ أو الفلتر أو كلمة البحث للوصول للسجلات المطلوبة." : "Try adjusting your search criteria, selecting a different time preset, or clearing filters."}
              </p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#070709]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e0e13] text-white w-full max-w-4xl rounded-3xl shadow-2xl relative my-auto border border-white/[0.1] overflow-hidden"
            >
              {/* Multi-Color Ambient Top Glow Strip */}
              <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-400 to-indigo-500" />

              <button
                onClick={handleCloseModal}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <form onSubmit={handleSavePayment} className="p-8" dir={isAr ? "rtl" : "ltr"}>
                <div className="flex items-center gap-3 pb-6 border-b border-white/[0.08] mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      {isAr ? "تسجيل سند صرف / مدفوعات جديدة" : "Record Payment"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAr ? "تسجيل خروج أموال نقدية أو بنكية مع فحص الذكاء الاصطناعي للأصناف" : "Record cash or bank outgoing payment with AI extraction"}
                    </p>
                  </div>
                </div>

                {category === 'order' && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className={`mb-6 relative border-2 border-dashed rounded-2xl p-6 text-center transition-all overflow-hidden ${
                      isProcessingPo
                        ? 'border-rose-500 bg-rose-500/[0.08] shadow-[0_0_30px_rgba(244,63,94,0.2)]'
                        : 'border-white/[0.12] hover:border-rose-500/50 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    {isProcessingPo && (
                      <motion.div
                        animate={{ y: ["-100%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_15px_#f43f5e] pointer-events-none"
                      />
                    )}
                    {isProcessingPo ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-rose-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="font-bold">{isAr ? "جاري قراءة أمر الشراء بالذكاء الاصطناعي..." : "Reading Purchase Order with AI..."}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <ImageIcon className="h-8 w-8 text-slate-500" />
                        <span className="font-bold text-white">{isAr ? "اسحب صورة الفاتورة أو أمر الشراء هنا" : "Paste or Drop PO Image Here"}</span>
                        <span className="text-xs text-slate-400">{isAr ? "سيتم استخراج البيانات والأصناف تلقائياً بالذكاء الاصطناعي" : "We'll automatically extract the details using AI"}</span>
                        <button
                          type="button"
                          onClick={handlePastePoImageButtonClick}
                          className="mt-2 flex items-center gap-2 px-3.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] font-bold rounded-xl transition-colors text-xs cursor-pointer"
                        >
                          <ClipboardPaste size={14} />
                          {isAr ? "لصق من الحافظة" : "Paste from Clipboard"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider mb-4 border-b border-white/[0.08] pb-2">
                        {isAr ? "البيانات الأساسية" : "Basic Info"}
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "التاريخ *" : "Date *"}</label>
                            <input type="date" required className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 focus:bg-white/[0.06] transition-all outline-none font-medium text-white text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "طريقة الدفع *" : "Method *"}</label>
                            <select className="w-full p-3 rounded-xl bg-[#14141a] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs outline-none font-medium" value={method} onChange={(e) => setMethod(e.target.value)}>
                              <option value="cash">{isAr ? "كاش (نقداً)" : "Cash"}</option>
                              <option value="visa">{isAr ? "فيزا (بطاقة)" : "Visa"}</option>
                              <option value="bank_transfer">{isAr ? "تحويل بنكي" : "Bank Transfer"}</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "الشركة / المورد *" : "Company / Supplier *"}</label>
                            <button type="button" onClick={() => setShowAddSupplier(true)} className="text-[10px] text-rose-400 font-bold hover:underline flex items-center gap-1">
                              {isAr ? "+ مورد جديد" : "+ New Supplier"}
                            </button>
                          </div>
                          <select required className="w-full p-3 rounded-xl bg-[#14141a] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs outline-none font-medium" value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                            <option value="">{isAr ? "-- اختر المورد --" : "Select a supplier..."}</option>
                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "اسم مندوب/سائق المورد" : "Rep Name"}</label>
                          <input type="text" placeholder={isAr ? "السائق / المندوب" : "Driver / Representative"} className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white placeholder:text-slate-500 text-xs outline-none font-medium" value={supplierRepName} onChange={(e) => setSupplierRepName(e.target.value)} />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "الرقم القومي للمندوب" : "Rep National ID"}</label>
                          <input type="text" placeholder={isAr ? "الرقم القومي (١٤ رقم)" : "14-digit ID"} maxLength={14} className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white placeholder:text-slate-500 text-xs outline-none font-medium font-mono" value={supplierNationalId} onChange={(e) => setSupplierNationalId(e.target.value)} />
                        </div>

                        {method === 'bank_transfer' && (
                          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">{isAr ? "إيصال التحويل البنكي *" : "Bank Transfer Receipt *"}</label>
                            <div className="flex flex-col gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setBankTransferFile(e.target.files[0]);
                                  }
                                }}
                                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                              />
                              {bankTransferFile ? (
                                <p className="text-xs font-medium text-blue-800 break-all bg-blue-100/50 p-2 rounded-lg border border-blue-200 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {bankTransferFile.name}</p>
                              ) : (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-blue-500">{isAr ? "أو:" : "Or: "}</span>
                                  <button
                                    type="button"
                                    onClick={handlePasteBankReceipt}
                                    className="text-[10px] text-blue-600 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-blue-200"
                                  >
                                    <ClipboardPaste size={10} /> {isAr ? "لصق من الحافظة" : "Paste from Clipboard"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider mb-4 border-b border-white/[0.08] pb-2">
                        {isAr ? "البيانات المالية والقيمة" : "Financials"}
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "المبلغ (قبل الضريبة) *" : "Amount (Before Tax) *"}</label>
                            <input type="number" required placeholder="0.00" step="0.01" min="0" className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-rose-400 font-mono font-black text-lg outline-none" value={amount} onChange={(e) => setAmount(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "قيمة الضريبة" : "Tax Amount"}</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white font-mono font-bold text-lg outline-none" value={tax} onChange={(e) => setTax(e.target.value)} />
                          </div>
                        </div>

                        {/* Total Sum Preview Box (Amount + Tax) */}
                        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between shadow-xl transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                              <Calculator size={18} />
                            </div>
                            <div>
                              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                                {isAr ? "إجمالي المبلغ (شامل الضريبة)" : "Total Amount (Incl. Tax)"}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {(parseFloat(tax) || 0) > 0 ? (
                                  isAr 
                                    ? `${(parseFloat(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(tax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ضريبة`
                                    : `${(parseFloat(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(tax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tax`
                                ) : (
                                  isAr ? "بدون ضريبة إضافية" : "No tax added"
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono tracking-tight">
                              EGP {((parseFloat(amount) || 0) + (parseFloat(tax) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "التصنيف *" : "Category *"}</label>
                            <select 
                              className="w-full p-3 rounded-xl bg-[#14141a] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs outline-none font-medium" 
                              value={category} 
                              onChange={(e) => {
                                const newCat = e.target.value;
                                setCategory(newCat);
                                if (newCat !== "order") {
                                  setPoNumber("");
                                  setPoItems([]);
                                  setPoImageFile(null);
                                }
                              }}
                            >
                              <option value="order">{isAr ? "طلبات وبضائع" : "Order"}</option>
                              <option value="maintenance">{isAr ? "صيانة" : "Maintenance"}</option>
                              <option value="utilities">{isAr ? "مرافق وخدمات" : "Utilities"}</option>
                              <option value="transportation">{isAr ? "نقل ونولون" : "Transportation"}</option>
                              <option value="other">{isAr ? "مصروفات أخرى" : "Other / Misc"}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "ملاحظات" : "Notes"}</label>
                            <input type="text" placeholder={isAr ? "تفاصيل إضافية..." : "Optional details..."} className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs outline-none font-medium placeholder:text-slate-500" value={categoryNote} onChange={(e) => setCategoryNote(e.target.value)} />
                          </div>
                        </div>

                        <div className={`grid ${category === "order" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم الفاتورة" : "Invoice #"}</label>
                            <input type="text" placeholder="INV-123" className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white font-mono text-xs outline-none font-medium placeholder:text-slate-500" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                          </div>
                          {category === "order" && (
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم أمر الشراء (PO)" : "PO #"}</label>
                              <input type="text" placeholder="PO-123" className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white font-mono text-xs outline-none font-medium placeholder:text-slate-500" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {/* GOODS RETURN (RTV) DEDUCTION INTERACTIVE CARD */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className={`p-5 rounded-2xl border transition-all duration-300 ${hasReturn ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-400 dark:border-amber-600/60 shadow-lg shadow-amber-500/5' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'}`}>
                    {/* Question Header & Toggle Switch */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${hasReturn ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-4 ring-amber-500/15' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <RotateCcw size={22} className={hasReturn ? 'rotate-[-30deg] transition-transform duration-300' : ''} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                              {isAr ? "هل يوجد مرتجع بضاعة مرتبط بهذا السداد؟ (RTV)" : "Is there a Goods Return (RTV) for this payment?"}
                            </h3>
                            {hasReturn && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white animate-pulse">
                                {isAr ? "يوجد خصم مرتجع" : "RTV Deduction Active"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {isAr
                              ? "في حالة وجود بضاعة مرتجعة، سيتم خصم قيمتها من إجمالي الفاتورة، وطباعة إيصال مرتجع رسمي A4 تلقائياً مع سند الصرف، وإغلاق المرتجع في السيستم."
                              : "If goods are returned, their value will be deducted from the payout, an official A4 RTV receipt printed, and the return closed."}
                          </p>
                        </div>
                      </div>

                      {/* Yes / No Toggle Buttons */}
                      <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 p-1 rounded-xl self-start sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setHasReturn(false);
                            setReturnAmount("");
                            setReturnTransferOutNumber("");
                            setReturnReason("");
                            setReturnItems([]);
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!hasReturn ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}
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
                            if (!returnAgentName && supplierRepName) setReturnAgentName(supplierRepName);
                            if (!returnAgentNationalId && supplierNationalId) setReturnAgentNationalId(supplierNationalId);
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${hasReturn ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}
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
                          className="mt-6 pt-6 border-t border-amber-200/60 dark:border-amber-800/40 space-y-6 overflow-hidden"
                        >
                          {/* Segmented Source Switcher: Choose from Pending vs Add New */}
                          <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-inner">
                            <button
                              type="button"
                              onClick={() => setReturnSource("pending")}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
                                returnSource === "pending"
                                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/20'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <FileText size={15} />
                              <span>{isAr ? "اختيار من المرتجعات المعلقة للشركة" : "Select Pending Return"}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                returnSource === "pending" ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
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
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Plus size={15} />
                              <span>{isAr ? "تسجيل مرتجع جديد الآن" : "Create New Return"}</span>
                            </button>
                          </div>

                          {/* PENDING RETURNS BROWSER & SELECTOR */}
                          {returnSource === "pending" && (
                            <div className="space-y-3 p-4 rounded-2xl bg-amber-500/5 dark:bg-slate-900/50 border border-amber-300/60 dark:border-amber-700/40">
                              {/* Search & Filter Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="relative flex-1">
                                  <Search size={14} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder={isAr ? "بحث برقم المرتجع (RTV)، إذن الخروج (TR)، أو اسم المورد..." : "Search RTV #, TR #, or supplier..."}
                                    value={pendingReturnSearchQuery}
                                    onChange={(e) => setPendingReturnSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                  {pendingReturnSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setPendingReturnSearchQuery("")}
                                      className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 transition-colors"
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
                                <div className="p-5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-dashed border-amber-200 dark:border-amber-800/60 text-center space-y-2.5">
                                  <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <PackageOpen size={20} />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                      {isAr ? `لا توجد مرتجعات معلقة مسجلة لشركة "${companyName || 'المورد'}"` : `No pending returns for "${companyName || 'Supplier'}"`}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto">
                                      {isAr
                                        ? "يمكنك الضغط على زر 'تسجيل مرتجع جديد الآن' لإدخال بيانات المرتجع يدوياً وخصمه فوراً."
                                        : "You can click 'Create New Return' to enter the return details manually."}
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
                                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
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
                                            ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700'
                                        }`}
                                      >
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-slate-900 dark:bg-slate-800 text-amber-400 border border-slate-800">
                                                {ticket.returnNumber}
                                              </span>
                                              {ticket.transferOutNumber && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                  TR: {ticket.transferOutNumber}
                                                </span>
                                              )}
                                            </div>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                              isSelected ? 'bg-amber-500 text-white' : 'border-2 border-slate-300 dark:border-slate-600'
                                            }`}>
                                              {isSelected && <Check size={12} strokeWidth={3} />}
                                            </div>
                                          </div>

                                          <div>
                                            <p className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                                              {ticket.supplier}
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
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

                                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            {ticket.date ? new Date(ticket.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : ''}
                                          </span>
                                          <div className="text-right">
                                            <span className="text-[10px] text-slate-400 font-bold block">{isAr ? "قيمة المرتجع" : "Amount"}</span>
                                            <span className="text-xs sm:text-sm font-mono font-black text-amber-600 dark:text-amber-400">
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
                                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                                    <CheckCircle2 size={17} className="text-amber-500 shrink-0" />
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
                                    className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-red-50 text-red-600 dark:text-red-400 font-bold text-[11px] transition-colors shrink-0"
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
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-xs">
                              <label className="block text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                                {isAr ? "١. قيمة خصم المرتجع (ج.م) *" : "1. Return Deduction Amount (EGP) *"}
                              </label>
                              <input
                                type="number"
                                required={hasReturn}
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                                max={((parseFloat(amount) || 0) + (parseFloat(tax) || 0)) || undefined}
                                value={returnAmount}
                                onChange={(e) => setReturnAmount(e.target.value)}
                                className="w-full p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none font-mono font-black text-amber-600 text-lg"
                              />
                              <span className="text-[11px] text-slate-400 mt-1 block">
                                {isAr ? "المبلغ المستحق خصمه من مستحقات المورد" : "Amount to deduct from payout"}
                              </span>
                            </div>

                            {/* Question 2: TR Number */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-xs">
                              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                                {isAr ? "٢. رقم إذن خروج البضاعة (TR Number)" : "2. Outbound Transfer # (TR)"}
                              </label>
                              <input
                                type="text"
                                placeholder={isAr ? "مثال: TR-94821 (تلقائي إن تُرك فارغاً)" : "e.g. TR-94821 (Auto-generated if blank)"}
                                value={returnTransferOutNumber}
                                onChange={(e) => setReturnTransferOutNumber(e.target.value)}
                                className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-900 dark:text-white text-sm"
                              />
                              <span className="text-[11px] text-slate-400 mt-1 block">
                                {isAr ? "الرقم الدفتري أو الإلكتروني لإذن الخروج (يتم إنشاؤه تلقائياً)" : "Official outbound transfer manifest # (Auto-assigned)"}
                              </span>
                            </div>

                            {/* Question 3: Return Reason */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-xs sm:col-span-2 lg:col-span-1">
                              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                                {isAr ? "٣. سبب الإرجاع *" : "3. Return Reason *"}
                              </label>
                              <input
                                type="text"
                                placeholder={isAr ? "بضاعة تالفة / منتهية الصلاحية / راكدة / خصم تجاري" : "Damaged / Expired / Slow moving / Commercial discount"}
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                                className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none font-medium text-slate-900 dark:text-white text-sm"
                              />
                              <span className="text-[11px] text-slate-400 mt-1 block">
                                {isAr ? "يظهر رسمياً على إيصال المرتجع" : "Will appear on RTV receipt"}
                              </span>
                            </div>
                          </div>

                          {/* Representative / Driver for Return Handover */}
                          <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">
                              {isAr ? "بيانات مندوب / سائق استلام المرتجع (اختياري - للإيصال)" : "Representative Handover Details"}
                            </h4>
                            <div className="grid sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? "اسم المندوب المستلم" : "Rep Name"}</label>
                                <input
                                  type="text"
                                  placeholder={supplierRepName || (isAr ? "مندوب المورد" : "Representative")}
                                  value={returnAgentName}
                                  onChange={(e) => setReturnAgentName(e.target.value)}
                                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? "الرقم القومي (١٤ رقم)" : "National ID (14 digits)"}</label>
                                <input
                                  type="text"
                                  maxLength={14}
                                  placeholder={supplierNationalId || (isAr ? "الرقم القومي" : "National ID")}
                                  value={returnAgentNationalId}
                                  onChange={(e) => setReturnAgentNationalId(e.target.value)}
                                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? "رقم الهاتف المحمول" : "Mobile Number"}</label>
                                <input
                                  type="tel"
                                  placeholder="01XXXXXXXXX"
                                  value={returnAgentMobile}
                                  onChange={(e) => setReturnAgentMobile(e.target.value)}
                                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Optional Itemized Return Items */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-500">
                                {isAr ? `أصناف المرتجع التفصيلية (${returnItems.length}) - اختياري` : `Itemized Return Items (${returnItems.length}) - Optional`}
                              </span>
                              <button
                                type="button"
                                onClick={handleAddReturnItem}
                                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <Plus size={13} /> {isAr ? "إضافة صنف مرتجع" : "Add Return Item"}
                              </button>
                            </div>

                            {returnItems.length > 0 && (
                              <div className="overflow-x-auto border border-amber-200/60 dark:border-amber-800/40 rounded-xl mb-3">
                                <table className="w-full text-xs text-left" dir={isAr ? "rtl" : "ltr"}>
                                  <thead className="bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 uppercase font-black text-[10px]">
                                    <tr>
                                      <th className="p-2.5">{isAr ? "الباركود" : "Barcode"}</th>
                                      <th className="p-2.5">{isAr ? "اسم الصنف" : "Item Name"}</th>
                                      <th className="p-2.5 text-center w-20">{isAr ? "الكمية" : "Qty"}</th>
                                      <th className="p-2.5 text-right w-24">{isAr ? "السعر" : "Price"}</th>
                                      <th className="p-2.5 text-right w-24">{isAr ? "الإجمالي" : "Total"}</th>
                                      <th className="p-2.5 text-center w-10"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                    {returnItems.map((ritem, rIdx) => (
                                      <tr key={rIdx} className="bg-white/60 dark:bg-slate-900/60">
                                        <td className="p-1.5">
                                          <input
                                            type="text"
                                            placeholder="Barcode"
                                            value={ritem.barcode}
                                            onChange={(e) => handleReturnItemChange(rIdx, 'barcode', e.target.value)}
                                            className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-xs border-none"
                                          />
                                        </td>
                                        <td className="p-1.5">
                                          <input
                                            type="text"
                                            placeholder={isAr ? "اسم الصنف المرتجع" : "Item description"}
                                            value={ritem.itemName}
                                            onChange={(e) => handleReturnItemChange(rIdx, 'itemName', e.target.value)}
                                            className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-xs border-none"
                                          />
                                        </td>
                                        <td className="p-1.5">
                                          <input
                                            type="number"
                                            min="1"
                                            value={ritem.quantity}
                                            onChange={(e) => handleReturnItemChange(rIdx, 'quantity', e.target.value)}
                                            className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-xs border-none text-center font-bold"
                                          />
                                        </td>
                                        <td className="p-1.5">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={ritem.unitPrice}
                                            onChange={(e) => handleReturnItemChange(rIdx, 'unitPrice', e.target.value)}
                                            className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-xs border-none text-right font-bold"
                                          />
                                        </td>
                                        <td className="p-1.5 text-right font-mono font-black text-amber-700 dark:text-amber-300">
                                          {(ritem.totalPrice || 0).toFixed(2)}
                                        </td>
                                        <td className="p-1.5 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveReturnItem(rIdx)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
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
                            const gross = (parseFloat(amount) || 0) + (parseFloat(tax) || 0);
                            const ret = parseFloat(returnAmount) || 0;
                            const net = Math.max(0, gross - ret);
                            const isOverLimit = ret > gross && gross > 0;

                            return (
                              <div className={`p-4 rounded-2xl border transition-all ${isOverLimit ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700' : 'bg-gradient-to-r from-slate-900 to-slate-800 text-white border-slate-700 shadow-xl'}`}>
                                {isOverLimit ? (
                                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                                    <AlertTriangle size={22} className="shrink-0" />
                                    <div>
                                      <h4 className="text-sm font-black">{isAr ? "خطأ في قيمة المرتجع!" : "Invalid Return Amount"}</h4>
                                      <p className="text-xs font-medium mt-0.5">
                                        {isAr
                                          ? `قيمة المرتجع (${ret.toLocaleString()} ج.م) أكبر من إجمالي الفاتورة (${gross.toLocaleString()} ج.م). لا يمكن أن تتجاوز قيمة الخصم إجمالي المستحق.`
                                          : `Return amount cannot exceed gross payment total.`}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                                          <CheckCircle2 size={18} />
                                        </div>
                                        <div>
                                          <span className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                                            {isAr ? "المعادلة المحاسبية المعتمدة لسند الصرف" : "Approved Accounting Net Payout Formula"}
                                          </span>
                                          <span className="text-[11px] text-slate-400">
                                            {isAr ? "سيتم خصم صافي المنصرف فقط من الخزينة لحماية أرصدة الصندوق" : "Safe balance will be deducted ONLY by net cash disbursed"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs font-mono">
                                        <div>
                                          <span className="text-slate-400 text-[10px] block">{isAr ? "إجمالي الفاتورة:" : "Gross:"}</span>
                                          <span className="font-bold text-slate-200">EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <span className="text-amber-400 font-black text-base">-</span>
                                        <div>
                                          <span className="text-amber-400 text-[10px] block">{isAr ? "خصم المرتجع:" : "Return:"}</span>
                                          <span className="font-bold text-amber-400">EGP {ret.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <span className="text-emerald-400 font-black text-base">=</span>
                                        <div className="bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                                          <span className="text-emerald-400 text-[10px] font-black block">{isAr ? "صافي الصرف الفعلي:" : "Net Cash Paid:"}</span>
                                          <span className="text-base sm:text-lg font-black text-emerald-400">EGP {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span>{isAr ? "١. سند صرف نقدي رسمي يوضح الفاتورة الأصلية وخصم المرتجع والصافي" : "1. Official payment voucher showing Gross, RTV Deduction & Net"}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                        <span>{isAr ? "٢. إيصال مرتجع رسمي A4 مختوم ومعتمد مطبوع فورياً" : "2. Official A4 Return Manifest printed immediately"}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                                        <span>{isAr ? "٣. تسجيل المرتجع كمغلق ومسدد (Closed / Settled) بالكامل" : "3. Return logged as Closed/Settled in Returns System"}</span>
                                      </div>
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

                {poItems.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-white/[0.08]">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                      {isAr ? `الأصناف المستخرجة (${poItems.length})` : `Extracted Items (${poItems.length})`}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left" dir={isAr ? "rtl" : "ltr"}>
                        <thead className="text-[11px] text-slate-400 bg-white/[0.04] uppercase font-mono tracking-wider border-b border-white/[0.06]">
                          <tr>
                            <th className="px-4 py-3 rounded-l-xl">{isAr ? "الباركود" : "Barcode"}</th>
                            <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                            <th className="px-4 py-3 text-center w-24">{isAr ? "الكمية" : "Qty"}</th>
                            <th className="px-4 py-3 text-right w-32">{isAr ? "السعر" : "Price"}</th>
                            <th className="px-4 py-3 text-right w-24">{isAr ? "الإجمالي" : "Total"}</th>
                            <th className="px-4 py-3 text-center rounded-r-xl w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {poItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-white/[0.04] last:border-0 font-medium">
                              <td className="px-2 py-2">
                                <input type="text" className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white font-mono text-xs outline-none" value={item.barcode} onChange={e => handlePoItemChange(idx, 'barcode', e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="text" className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs outline-none" value={item.description} onChange={e => handlePoItemChange(idx, 'description', e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="1" className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs font-mono text-center outline-none" value={item.quantity} onChange={e => handlePoItemChange(idx, 'quantity', parseInt(e.target.value) || 0)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="0" step="0.01" className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-rose-500/50 text-white text-xs font-mono text-right outline-none" value={item.unitPrice} onChange={e => handlePoItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-400 font-mono text-xs">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                              <td className="px-2 py-2 text-center">
                                <button type="button" onClick={() => handleRemovePoItem(idx)} className="p-1.5 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 flex justify-start">
                        <button type="button" onClick={handleAddPoItem} className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                          {isAr ? "+ إضافة صنف" : "+ Add Item"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-white/[0.08] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-3 rounded-xl font-bold text-slate-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all cursor-pointer text-sm"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer text-sm"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (isAr ? "حفظ وطباعة السند" : "Save & Print Receipt")}
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
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e0e13] border border-white/[0.12] text-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-indigo-500 to-amber-500" />
              <h3 className="text-lg font-black text-white mb-4 tracking-tight">Add New Supplier</h3>
              <input
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="e.g. COCA COLA EG"
                className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-rose-500/50 rounded-xl p-3 text-white font-medium mb-6 outline-none text-sm placeholder:text-slate-500"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowAddSupplier(false)}
                  className="px-4 py-2 text-slate-300 font-bold bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSupplier}
                  disabled={!newSupplierName.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold rounded-xl hover:from-rose-500 hover:to-red-500 disabled:opacity-50 transition-all shadow-md shadow-rose-600/30 cursor-pointer text-sm"
                >
                  Use Supplier
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIDDEN PRINT LAYOUT (A4 SINGLE SHEET EXECUTIVE VOUCHER OR 2-PAGE FOR BANK TRANSFER / RETURN MANIFEST) */}
      {selectedPaymentForPrint && (
        <div id="single-payment-print-wrapper" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <OfficialPaymentReceipt
            payment={selectedPaymentForPrint}
            elementId="pdf-receipt"
            qrUrl={qrCodeData}
            currentBranch={currentBranch}
          />

          {/* PAGE 2: OFFICIAL A4 GOODS RETURN (RTV) RECEIPT / MANIFEST */}
          {selectedPaymentForPrint.hasReturn && (
            <div
              className="print-page"
              style={{
                width: '210mm',
                height: '297mm',
                maxHeight: '297mm',
                padding: '12mm 15mm',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                pageBreakInside: 'avoid',
                pageBreakAfter: (selectedPaymentForPrint.bankTransferReceiptUrl) ? 'always' : 'avoid',
                overflow: 'hidden'
              }}
            >
              <ReturnReceiptContent
                data={{
                  ...(selectedPaymentForPrint.returnDetails || {}),
                  supplier: selectedPaymentForPrint.companyName,
                  branchId: selectedPaymentForPrint.storeId || currentBranch,
                  storeId: selectedPaymentForPrint.storeId || currentBranch,
                  totalPrice: selectedPaymentForPrint.returnDeductionAmount || selectedPaymentForPrint.returnDetails?.returnAmount || 0,
                  returnNumber: selectedPaymentForPrint.returnDetails?.returnNumber || selectedPaymentForPrint.returnNumber || `RTV-${selectedPaymentForPrint.invoiceNumber || (selectedPaymentForPrint.id ? selectedPaymentForPrint.id.slice(0, 6) : Date.now().toString().slice(-6))}`,
                  transferOutNumber: selectedPaymentForPrint.returnDetails?.transferOutNumber || selectedPaymentForPrint.transferOutNumber || "",
                  agentName: selectedPaymentForPrint.returnDetails?.agentName || selectedPaymentForPrint.supplierRepName || "",
                  agentNationalId: selectedPaymentForPrint.returnDetails?.agentNationalId || selectedPaymentForPrint.supplierNationalId || "",
                  agentMobile: selectedPaymentForPrint.returnDetails?.agentMobile || "",
                  items: (selectedPaymentForPrint.returnDetails?.items && selectedPaymentForPrint.returnDetails.items.length > 0)
                    ? selectedPaymentForPrint.returnDetails.items
                    : [{
                        barcode: "N/A",
                        itemName: selectedPaymentForPrint.returnDetails?.reason || "بضاعة مرتجعة مخصومة من سداد المورد بموجب إذن خروج",
                        quantity: 1,
                        unitPrice: Number(selectedPaymentForPrint.returnDeductionAmount || 0),
                        totalPrice: Number(selectedPaymentForPrint.returnDeductionAmount || 0)
                      }],
                  settlementMethod: "money",
                  paymentTiming: "now",
                  isSettled: true,
                  settledByVoucher: selectedPaymentForPrint.invoiceNumber || selectedPaymentForPrint.id,
                  paymentVoucherNumber: selectedPaymentForPrint.invoiceNumber || selectedPaymentForPrint.id,
                  returnedAt: selectedPaymentForPrint.returnDetails?.returnedAt || selectedPaymentForPrint.date,
                  date: selectedPaymentForPrint.date,
                  createdAt: selectedPaymentForPrint.createdAt,
                  createdBy: selectedPaymentForPrint.createdBy
                }}
                currentBranch={currentBranch}
              />
            </div>
          )}

          {(selectedPaymentForPrint.method === 'bank_transfer' || selectedPaymentForPrint.method === 'bank' || selectedPaymentForPrint.bankTransferReceiptUrl) && selectedPaymentForPrint.bankTransferReceiptUrl && (
            <BankTransferReceiptPrintPage
              payment={selectedPaymentForPrint}
              currentBranch={currentBranch}
            />
          )}
        </div>
      )}

      {/* View Items Modal - Tear-off Digital Receipt */}
      <AnimatePresence>
        {selectedPaymentForView && (
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
                  ease: "linear", // Linear gives it that mechanical printer feel
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
                        <FileText className="text-blue-500" size={24} /> {isAr ? "إيصال سند صرف" : "Payment Receipt"}
                      </h2>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        {selectedPaymentForView.companyName} • {selectedPaymentForView.date}
                        {selectedPaymentForView.poNumber && ` • PO: ${selectedPaymentForView.poNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                        <button
                          onClick={() => {
                            const p = selectedPaymentForView;
                            setSelectedPaymentForView(null);
                            handleOpenEditPayment(p);
                          }}
                          className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer mr-1"
                        >
                          <Pencil size={14} /> {isAr ? "تعديل الفاتورة" : "Edit Invoice"}
                        </button>
                      )}
                      {selectedPaymentForView.poImageUrl && (
                        <a
                          href={selectedPaymentForView.poImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mr-2"
                        >
                          <ImageIcon size={14} /> {isAr ? "عرض صورة امر الشراء" : "View PO Image"}
                        </a>
                      )}
                      <button
                        onClick={() => setSelectedPaymentForView(null)}
                        className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm cursor-pointer"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                    {/* Audit Trail / Edit History */}
                    {selectedPaymentForView.isEdited && selectedPaymentForView.editHistory && selectedPaymentForView.editHistory.length > 0 && (
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
                                ? `تم التعديل بواسطة ${selectedPaymentForView.lastEditedBy || 'Admin'} في ${new Date(selectedPaymentForView.lastEditedAt).toLocaleString('ar-EG')}`
                                : `Last edited by ${selectedPaymentForView.lastEditedBy || 'Admin'} on ${new Date(selectedPaymentForView.lastEditedAt).toLocaleString()}`}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {selectedPaymentForView.editHistory.map((hist: any, hIdx: number) => (
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
                        <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedPaymentForView.companyName}>{selectedPaymentForView.companyName}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "التاريخ" : "Date"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{selectedPaymentForView.date}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "طريقة الدفع" : "Payment Method"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
                          {METHOD_EMOJIS[selectedPaymentForView.method] || "💵"} {selectedPaymentForView.method === 'cash' ? (isAr ? "كاش (نقداً)" : "Cash") : selectedPaymentForView.method === 'visa' ? (isAr ? "فيزا" : "Visa") : (isAr ? "تحويل بنكي" : "Bank Transfer")}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "التصنيف" : "Category"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
                          {CATEGORY_EMOJIS[selectedPaymentForView.category] || "📦"} {selectedPaymentForView.category === 'order' ? (isAr ? "طلبات وبضائع" : "Order") : selectedPaymentForView.category === 'credit' ? (isAr ? "سداد مديونية مورد / آجل" : "Credit Debt Payment") : selectedPaymentForView.category === 'utilities' ? (isAr ? "المرافق والخدمات" : "Utilities") : selectedPaymentForView.category === 'maintenance' ? (isAr ? "الصيانة" : "Maintenance") : selectedPaymentForView.category === 'transportation' ? (isAr ? "النقل والنولون" : "Transportation") : (isAr ? "مصروفات أخرى" : "Other")}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "المبلغ الإجمالي" : "Total Amount"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedPaymentForView.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "قيمة الضريبة" : "Tax Amount"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedPaymentForView.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم الفاتورة" : "Invoice Number"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedPaymentForView.invoiceNumber || (isAr ? "غير متاح" : "N/A")}>{selectedPaymentForView.invoiceNumber || (isAr ? "غير متاح" : "N/A")}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "رقم أمر الشراء (PO)" : "PO Number"}</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedPaymentForView.poNumber || (isAr ? "غير متاح" : "N/A")}>{selectedPaymentForView.poNumber || (isAr ? "غير متاح" : "N/A")}</p>
                      </div>
                    </div>

                    {(selectedPaymentForView.supplierRepName || selectedPaymentForView.categoryNote) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {selectedPaymentForView.supplierRepName && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "اسم مندوب/سائق المورد" : "Supplier Representative"}</p>
                            <p className="text-md font-bold text-slate-900 dark:text-white">{selectedPaymentForView.supplierRepName} {selectedPaymentForView.supplierNationalId ? `(${selectedPaymentForView.supplierNationalId})` : ""}</p>
                          </div>
                        )}
                        {selectedPaymentForView.categoryNote && (
                          <div className={`bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl ${!selectedPaymentForView.supplierRepName ? 'col-span-full' : ''}`}>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isAr ? "ملاحظات" : "Notes"}</p>
                            <p className="text-md font-medium text-slate-700 dark:text-slate-300">{selectedPaymentForView.categoryNote}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPaymentForView.hasReturn && (
                      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-400 dark:border-amber-700/60 rounded-2xl p-5 mb-8 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200 dark:border-amber-800/40">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                              <RotateCcw size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{isAr ? "تسوية مرتجع بضاعة مرتبط بالسداد (RTV Settlement)" : "Goods Return (RTV) Deduction"}</span>
                                <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                                  {isAr ? "مغلق ومسدد" : "Closed & Settled"}
                                </span>
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {isAr ? "تم خصم قيمة هذا المرتجع بالكامل من سداد المورد" : "Return value fully deducted from this payment payout"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentForPrint(selectedPaymentForView);
                              setTimeout(() => generatePDF(selectedPaymentForView), 100);
                            }}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                          >
                            <Printer size={13} />
                            {isAr ? "طباعة إيصال المرتجع (A4)" : "Print RTV Receipt"}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800/30">
                            <span className="text-slate-400 text-[10px] font-bold block">{isAr ? "رقم إشعار المرتجع" : "RTV Number"}</span>
                            <span className="font-black font-mono text-amber-600 dark:text-amber-400 text-sm">
                              {selectedPaymentForView.returnDetails?.returnNumber || selectedPaymentForView.returnNumber || "RTV"}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800/30">
                            <span className="text-slate-400 text-[10px] font-bold block">{isAr ? "رقم إذن خروج البضاعة (TR)" : "Transfer Out (TR)"}</span>
                            <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                              {selectedPaymentForView.returnDetails?.transferOutNumber || selectedPaymentForView.transferOutNumber || (isAr ? "غير محدد" : "N/A")}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800/30">
                            <span className="text-slate-400 text-[10px] font-bold block">{isAr ? "قيمة الخصم المستقطعة" : "Deduction Value"}</span>
                            <span className="font-black font-mono text-rose-600 dark:text-rose-400 text-sm">
                              - EGP {Number(selectedPaymentForView.returnDeductionAmount || selectedPaymentForView.returnDetails?.returnAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800/30">
                            <span className="text-slate-400 text-[10px] font-bold block">{isAr ? "المندوب المستلم" : "Handover Rep"}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={selectedPaymentForView.returnDetails?.agentName || selectedPaymentForView.supplierRepName}>
                              {selectedPaymentForView.returnDetails?.agentName || selectedPaymentForView.supplierRepName || (isAr ? "مندوب المورد" : "Supplier Rep")}
                            </span>
                          </div>
                        </div>

                        {selectedPaymentForView.returnDetails?.reason && (
                          <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/30 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <span className="font-bold text-amber-700 dark:text-amber-400">{isAr ? "سبب الإرجاع:" : "Reason:"}</span>
                            <span>{selectedPaymentForView.returnDetails.reason}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPaymentForView.bankTransferReceiptUrl && (
                      <div className="mb-8">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">{isAr ? "إيصال التحويل البنكي" : "Bank Transfer Receipt"}</h3>
                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm max-h-64 relative bg-slate-50 dark:bg-slate-900 flex justify-center items-center group">
                          <img
                            src={selectedPaymentForView.bankTransferReceiptUrl}
                            alt="Bank Transfer Receipt"
                            className="object-contain max-h-64 w-full"
                          />
                          <button
                            onClick={() => handleViewFullReceipt(selectedPaymentForView.bankTransferReceiptUrl!)}
                            type="button"
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2 w-full h-full cursor-pointer"
                          >
                            <ImageIcon size={20} /> {isAr ? "عرض الإيصال بالكامل" : "View Full Receipt"}
                          </button>
                        </div>
                      </div>
                    )}

                    {(() => {
                      const urls = selectedPaymentForView.invoiceUrls && selectedPaymentForView.invoiceUrls.length > 0
                        ? selectedPaymentForView.invoiceUrls
                        : (selectedPaymentForView.invoiceUrl ? [selectedPaymentForView.invoiceUrl] : []);

                      if (urls.length > 0) {
                        return (
                          <div className="mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">{isAr ? "مرفقات فواتير المورد" : "Supplier Invoice(s)"}</h3>
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
                                  <button
                                    onClick={() => handleViewFullReceipt(url)}
                                    type="button"
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2 w-full h-full z-20 cursor-pointer"
                                  >
                                    <ImageIcon size={20} /> {isAr ? `عرض الصفحة ${index + 1} كاملة` : `View Full Page ${index + 1}`}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="mb-8 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                          <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 text-center">{isAr ? "فاتورة المورد غير مرفقة" : "Missing Supplier Invoice"}</h3>
                          <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
                            <QRCode
                              value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/cashier/upload-invoice/${selectedPaymentForView.id}`}
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

                    {selectedPaymentForView.items && selectedPaymentForView.items.length > 0 ? (
                      <>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">{isAr ? `الأصناف والمحتويات (${selectedPaymentForView.items.length})` : `Products / Items (${selectedPaymentForView.items.length})`}</h3>
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
                              {selectedPaymentForView.items.map((item: any, idx: number) => {
                                const desc = item.description || item.name || item.itemName || item.item || (isAr ? "غير متاح" : "N/A");
                                const qty = Number(item.quantity ?? item.qty ?? 1);
                                const rawUnitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : (item.price !== undefined ? Number(item.price) : NaN);
                                const rawTotal = item.total !== undefined ? Number(item.total) : (item.totalPrice !== undefined ? Number(item.totalPrice) : (!isNaN(rawUnitPrice) ? qty * rawUnitPrice : NaN));
                                const displayUnitPrice = !isNaN(rawUnitPrice) ? (rawUnitPrice > 0 ? rawUnitPrice.toFixed(2) : "-") : (!isNaN(rawTotal) && qty > 0 ? (rawTotal / qty).toFixed(2) : "-");
                                const displayTotal = !isNaN(rawTotal) ? (rawTotal > 0 ? rawTotal.toFixed(2) : "-") : (!isNaN(rawUnitPrice) && rawUnitPrice > 0 ? (qty * rawUnitPrice).toFixed(2) : "-");

                                return (
                                  <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 font-medium">
                                    <td className="px-4 py-3 text-slate-500 font-mono">{item.barcode || (isAr ? "غير متاح" : "N/A")}</td>
                                    <td className="px-4 py-3 text-slate-900 dark:text-slate-300 font-medium">{desc}</td>
                                    <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-300 font-mono">{qty}</td>
                                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-300 font-mono">{displayUnitPrice}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-300 font-mono">{displayTotal}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}

                    {/* Smart QR Code at bottom */}
                    <div className="flex flex-col items-center justify-center mt-8 pt-8 border-t border-dashed border-slate-300 dark:border-slate-700">
                      <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-sm mb-3">
                        <QRCode
                          value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/handshake?data=${encodeURIComponent(JSON.stringify({
                            id: selectedPaymentForView.id,
                            amount: selectedPaymentForView.total,
                            company: selectedPaymentForView.companyName,
                            date: selectedPaymentForView.date,
                            action: "verify_receipt"
                          }))}`}
                          size={120}
                          level="H"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPaymentForPrint(selectedPaymentForView);
                          setTimeout(() => generatePDF(selectedPaymentForView), 100);
                        }}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
                      >
                        {generatingPDF ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Printer size={18} />
                        )}
                        {generatingPDF ? (isAr ? "جاري إنشاء PDF..." : "Generating PDF...") : (isAr ? "طباعة نسخة كاملة" : "Print All (Copy)")}
                      </button>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center max-w-[200px] mt-2">
                        {isAr ? "امسح كود QR للمطابقة والتدقيق المالي الرقمي" : "Scan for Digital Transaction Verification"}
                      </p>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => {
                      setSelectedPaymentForPrint(selectedPaymentForView);
                      generatePDF(selectedPaymentForView);
                    }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer">
                      {generatingPDF ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Printer size={18} />
                      )}
                      {generatingPDF ? (isAr ? "جاري إنشاء PDF..." : "Generating PDF...") : (isAr ? "طباعة نسخة كاملة" : "Print All (Copy)")}
                    </button>
                    <button onClick={async () => {
                      const text = `Dear ANH Management,\n\nPlease review the following payment transaction and its attached invoice.\n\n*🧾 Transaction Details:*\n• *Supplier:* ${selectedPaymentForView.companyName}\n• *Amount:* EGP ${Number(selectedPaymentForView.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n• *Date:* ${selectedPaymentForView.date}\n• *Payment Method:* ${selectedPaymentForView.method.toUpperCase()}\n• *Reference ID:* ${selectedPaymentForView.id}`;

                      const filesToShare: File[] = [];
                      try {
                        const urls = selectedPaymentForView.invoiceUrls && selectedPaymentForView.invoiceUrls.length > 0
                          ? selectedPaymentForView.invoiceUrls
                          : (selectedPaymentForView.invoiceUrl ? [selectedPaymentForView.invoiceUrl] : []);

                        for (let i = 0; i < urls.length; i++) {
                          const url = urls[i];
                          if (url.startsWith('data:image')) {
                            const res = await fetch(url);
                            const blob = await res.blob();
                            filesToShare.push(new File([blob], `invoice-${i + 1}.png`, { type: blob.type }));
                          }
                        }
                      } catch (e) {
                        console.error('Error preparing images for sharing', e);
                      }

                      if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
                        try {
                          await navigator.share({
                            title: 'Payment Receipt',
                            text: text,
                            files: filesToShare
                          });
                          return;
                        } catch (e) {
                          console.log('Share failed or was cancelled', e);
                        }
                      }

                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }} className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer">
                      {isAr ? "واتساب" : "WhatsApp"}
                    </button>
                    <button onClick={() => {
                      const subject = `Payment Receipt - ${selectedPaymentForView.companyName}`;
                      const body = `Payment Receipt\nSupplier: ${selectedPaymentForView.companyName}\nAmount: EGP ${Number(selectedPaymentForView.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}\nDate: ${selectedPaymentForView.date}\nMethod: ${selectedPaymentForView.method}\nID: ${selectedPaymentForView.id}`;
                      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    }} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl font-bold transition-all cursor-pointer">
                      {isAr ? "البريد الإلكتروني" : "Email"}
                    </button>
                  </div>
                </div>

                {/* Tear-off Bottom Edge */}
                <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(135deg, transparent 12px, #ffffff 0), linear-gradient(225deg, transparent 12px, #ffffff 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm block dark:hidden" />
                <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(135deg, transparent 12px, #0f172a 0), linear-gradient(225deg, transparent 12px, #0f172a 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm hidden dark:block" />

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT PAYMENT MODAL (ADMIN ONLY) */}
      <AnimatePresence>
        {showEditModal && editingPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-[#0e0e13] border border-white/[0.12] text-white w-full max-w-2xl rounded-3xl shadow-2xl relative my-auto overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-white/[0.08] bg-white/[0.02]" dir={isAr ? "rtl" : "ltr"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-black border border-amber-500/30">
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {isAr ? "تعديل سند الصرف (خاص بالإدارة)" : "Edit Payment Invoice (Admin Only)"}
                    </h2>
                    <p className="text-xs font-bold text-amber-400/80 mt-0.5">
                      {isAr ? "سيتم تسجيل وتتبع كافة التعديلات تلقائياً في سجل الرقابة" : "All modifications will be tracked automatically in the audit log"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowEditModal(false); setEditingPayment(null); }}
                  className="p-2 text-slate-400 hover:text-white rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEditPayment} className="flex flex-col flex-1 min-h-0" dir={isAr ? "rtl" : "ltr"}>
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "التاريخ *" : "Date *"}
                      </label>
                      <input
                        type="date"
                        required
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] font-mono text-sm text-white outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "الشركة / المورد *" : "Company / Supplier *"}
                      </label>
                      <select
                        required
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        className="w-full p-3 rounded-xl bg-[#14141c] border border-white/[0.08] font-medium text-white outline-none focus:border-amber-500/50 text-sm"
                      >
                        <option value="" className="bg-[#14141c] text-slate-400">{isAr ? "-- اختر المورد --" : "Select a supplier..."}</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.name} className="bg-[#14141c] text-white">{s.name}</option>
                        ))}
                        {editCompanyName && !suppliers.some(s => s.name === editCompanyName) && (
                          <option value={editCompanyName} className="bg-[#14141c] text-white">{editCompanyName}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "المبلغ (قبل الضريبة) *" : "Amount (Before Tax) *"}
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] font-black text-rose-400 text-lg outline-none focus:border-amber-500/50 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "قيمة الضريبة" : "Tax Amount"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editTax}
                        onChange={(e) => setEditTax(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] font-bold text-white text-lg outline-none focus:border-amber-500/50 font-mono"
                      />
                    </div>
                  </div>

                  {/* Real-time Calculation Box */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base shadow-xs shrink-0 border border-emerald-500/30">
                        <Calculator size={18} />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                          {isAr ? "إجمالي المبلغ المعدل (شامل الضريبة)" : "Total Updated Amount (Incl. Tax)"}
                        </span>
                        <span className="text-xs text-emerald-400/80 font-medium">
                          {(parseFloat(editTax) || 0) > 0 ? (
                            isAr 
                              ? `${(parseFloat(editAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(editTax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ضريبة`
                              : `${(parseFloat(editAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + ${(parseFloat(editTax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tax`
                          ) : (
                            isAr ? "بدون ضريبة إضافية" : "No tax added"
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono tracking-tight">
                        EGP {((parseFloat(editAmount) || 0) + (parseFloat(editTax) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "طريقة الدفع *" : "Payment Method *"}
                      </label>
                      <select
                        value={editMethod}
                        onChange={(e) => setEditMethod(e.target.value)}
                        className="w-full p-3 rounded-xl bg-[#14141c] border border-white/[0.08] font-medium text-white outline-none focus:border-amber-500/50 text-sm"
                      >
                        <option value="cash" className="bg-[#14141c] text-white">{isAr ? "💵 كاش (نقداً)" : "💵 Cash"}</option>
                        <option value="visa" className="bg-[#14141c] text-white">{isAr ? "💳 فيزا" : "💳 Visa"}</option>
                        <option value="bank_transfer" className="bg-[#14141c] text-white">{isAr ? "🏦 تحويل بنكي" : "🏦 Bank Transfer"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "التصنيف *" : "Category *"}
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          setEditCategory(newCat);
                          if (newCat !== "order" && newCat !== "credit") {
                            setEditPoNumber("");
                          }
                        }}
                        className="w-full p-3 rounded-xl bg-[#14141c] border border-white/[0.08] font-medium text-white outline-none focus:border-amber-500/50 text-sm"
                      >
                        <option value="order" className="bg-[#14141c] text-white">{isAr ? "طلبات وبضائع" : "Order"}</option>
                        <option value="credit" className="bg-[#14141c] text-white">{isAr ? "سداد مديونية مورد / آجل" : "Credit Debt Payment"}</option>
                        <option value="maintenance" className="bg-[#14141c] text-white">{isAr ? "صيانة" : "Maintenance"}</option>
                        <option value="utilities" className="bg-[#14141c] text-white">{isAr ? "مرافق وخدمات" : "Utilities"}</option>
                        <option value="transportation" className="bg-[#14141c] text-white">{isAr ? "نقل ونولون" : "Transportation"}</option>
                        <option value="other" className="bg-[#14141c] text-white">{isAr ? "مصروفات أخرى" : "Other / Misc"}</option>
                      </select>
                    </div>
                  </div>

                  <div className={`grid ${(editCategory === "order" || editCategory === "credit") ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-4`}>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isAr ? "رقم الفاتورة" : "Invoice #"}
                      </label>
                      <input
                        type="text"
                        value={editInvoiceNumber}
                        onChange={(e) => setEditInvoiceNumber(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-white outline-none focus:border-amber-500/50"
                      />
                    </div>

                    {(editCategory === "order" || editCategory === "credit") && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "رقم أمر الشراء (PO)" : "PO #"}
                        </label>
                        <input
                          type="text"
                          value={editPoNumber}
                          onChange={(e) => setEditPoNumber(e.target.value)}
                          className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-white outline-none focus:border-amber-500/50"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {isAr ? "ملاحظات" : "Notes"}
                    </label>
                    <input
                      type="text"
                      value={editCategoryNote}
                      onChange={(e) => setEditCategoryNote(e.target.value)}
                      placeholder={isAr ? "تفاصيل إضافية أو سبب التعديل..." : "Optional details or reason for edit..."}
                      className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-amber-500/50 placeholder:text-slate-500"
                    />
                  </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/[0.08] bg-white/[0.02] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingPayment(null); }}
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors cursor-pointer text-sm"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-7 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer text-sm"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
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
      <AnimatePresence>
        {selectedPaymentForPoUpload && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Add PO to Invoice</h2>
                <button
                  onClick={() => setSelectedPaymentForPoUpload(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm"
                  disabled={uploadingPoToOldInvoice}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm font-medium text-slate-500 mb-6">
                  Upload a Purchase Order image to extract the products and attach them to this invoice. This will <strong className="text-slate-700 dark:text-slate-300">not</strong> overwrite the existing supplier or total amount.
                </p>

                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleUploadPoToOldInvoice(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploadingPoToOldInvoice}
                  />
                  {uploadingPoToOldInvoice ? (
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
                      <p className="font-bold text-slate-900 dark:text-white">Processing PO...</p>
                      <p className="text-sm text-slate-500 mt-1">Extracting items & saving to database</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <ImageIcon size={32} />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">Click, drag, or paste PO image here</p>
                      <p className="text-sm text-slate-500 mt-1">JPEG, PNG</p>
                    </>
                  )}
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handlePastePoImageButtonClick}
                    disabled={uploadingPoToOldInvoice}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <ClipboardPaste size={18} />
                    Paste Image from Clipboard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSupplierProfile && supplierProfileData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSupplierProfile(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full md:w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-[80] flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white capitalize tracking-tight flex items-center gap-2">
                    {selectedSupplierProfile}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Supplier Profile & Analytics</p>
                </div>
                <button
                  onClick={() => setSelectedSupplierProfile(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Highlight Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lifetime Spend</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">EGP {supplierProfileData.lifetimeSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`border p-5 rounded-3xl ${supplierProfileData.outstandingDebt > 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 dark:border-red-900/50' : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 dark:border-emerald-900/50'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${supplierProfileData.outstandingDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Outstanding Debt</p>
                    <p className={`text-2xl font-black tracking-tight ${supplierProfileData.outstandingDebt > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      EGP {supplierProfileData.outstandingDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Price Hike Warning */}
                {supplierProfileData.hasPriceHike && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-2xl flex items-start gap-3"
                  >
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="font-bold text-red-800 dark:text-red-400">Billing Spike Detected</h4>
                      <p className="text-sm font-medium text-red-700/80 dark:text-red-400/80 mt-0.5">
                        Recent payments to this supplier are &gt;20% higher than their 6-month average.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Sparkline */}
                {supplierProfileData.trendData.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                      <TrendingUp className="text-blue-500" size={16} /> 6-Month Billing Trend
                    </h3>
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={supplierProfileData.trendData}>
                          <XAxis dataKey="month" hide />
                          <YAxis hide domain={['auto', 'auto']} />
                          <RechartsTooltip
                            formatter={(value: any) => `EGP ${Number(value).toLocaleString()}`}
                            labelStyle={{ color: '#000' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                          />
                          <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleGenerateSOA}
                    className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <MessageCircle size={20} />
                    Generate SOA & Share to WhatsApp
                  </button>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Payment History ({supplierProfileData.sPayments.length})</h3>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                    {supplierProfileData.sPayments.slice(0, 20).map((pay, i) => {
                      const pAmt = Number(pay.amount) || 0;
                      const pTax = Number(pay.tax) || 0;
                      const pTot = Number(pay.total) || 0;
                      const totalWithTax = pTot >= (pAmt + pTax) && pTot > 0 ? pTot : (pAmt + pTax);

                      return (
                        <div key={pay.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                            {METHOD_EMOJIS[pay.method] || "💵"}
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-400">{pay.date}</span>
                              <span className="text-sm font-black text-slate-900 dark:text-white">
                                EGP {totalWithTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium truncate">
                              {pay.invoiceNumber ? `Inv: ${pay.invoiceNumber}` : (pay.categoryNote || "No details")}
                              {pTax > 0 && ` • Tax Paid: EGP ${pTax.toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* QR Upload Modal */}
      <AnimatePresence>
        {savedPaymentForQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative"
            >
              {/* Close Button */}
              <button
                onClick={() => setSavedPaymentForQR(null)}
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
                  {isAr ? "إرفاق صورة الفاتورة الورقية" : "Attach Paper Invoice"}
                </h2>
                <p className="text-xs text-slate-500 font-medium mb-4 max-w-[320px]">
                  {isAr
                    ? `امسح رمز QR بالهاتف أو اضغط زر اللصق من الحافظة (Ctrl+V) لشركة ${savedPaymentForQR.companyName}`
                    : `Scan QR with phone or click button to paste invoice image from clipboard for ${savedPaymentForQR.companyName}`}
                </p>

                {/* QR Code Container */}
                <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 inline-block mb-4 shadow-sm">
                  <QRCode
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/cashier/upload-invoice/${savedPaymentForQR.id}`}
                    size={170}
                    level="H"
                  />
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={qrFileInputRef}
                  onChange={handleQrFileSelected}
                  accept="image/*"
                  className="hidden"
                />

                {/* Action Buttons */}
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

      {/* Hidden Bulk Print Render Container */}
      {bulkPaymentsForPrint.length > 0 && (
        <div id="bulk-payment-print-wrapper" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -9999, pointerEvents: 'none' }}>
          {/* Cover Page */}
          <div id="pdf-bulk-cover" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0', textTransform: 'uppercase' }}>BULK PAYMENTS EXPORT</h1>
              <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>Generated: {new Date().toLocaleString()}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', padding: '20px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Payments Included</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{bulkPaymentsForPrint.length}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Value</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                  EGP {bulkPaymentsForPrint.reduce((acc, p) => acc + Number(p.amount) + Number(p.tax || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {bulkPaymentsForPrint.map((p, idx) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px' }}>{idx + 1}</td>
                    <td style={{ padding: '10px' }}>{p.date}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.companyName}</td>
                    <td style={{ padding: '10px' }}>{p.invoiceNumber || p.poNumber || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                      {(Number(p.amount) + Number(p.tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Render individual payments & their invoices */}
          {bulkPaymentsForPrint.map((selectedPaymentForPrint) => {
            const urls = selectedPaymentForPrint.invoiceUrls && selectedPaymentForPrint.invoiceUrls.length > 0
              ? selectedPaymentForPrint.invoiceUrls
              : (selectedPaymentForPrint.invoiceUrl ? [selectedPaymentForPrint.invoiceUrl] : []);

            return (
              <div key={`bulk-pay-${selectedPaymentForPrint.id}`}>
                <OfficialPaymentReceipt
                  payment={selectedPaymentForPrint}
                  elementId={`pdf-bulk-payment-${selectedPaymentForPrint.id}`}
                  currentBranch={currentBranch}
                />

                {selectedPaymentForPrint.hasReturn && (
                  <div
                    className="print-page"
                    id={`pdf-bulk-payment-${selectedPaymentForPrint.id}-return-receipt`}
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
                        ...(selectedPaymentForPrint.returnDetails || {}),
                        supplier: selectedPaymentForPrint.companyName,
                        branchId: selectedPaymentForPrint.storeId || currentBranch,
                        storeId: selectedPaymentForPrint.storeId || currentBranch,
                        totalPrice: selectedPaymentForPrint.returnDeductionAmount || selectedPaymentForPrint.returnDetails?.returnAmount || 0,
                        returnNumber: selectedPaymentForPrint.returnDetails?.returnNumber || selectedPaymentForPrint.returnNumber || `RTV-${selectedPaymentForPrint.invoiceNumber || (selectedPaymentForPrint.id ? selectedPaymentForPrint.id.slice(0, 6) : Date.now().toString().slice(-6))}`,
                        transferOutNumber: selectedPaymentForPrint.returnDetails?.transferOutNumber || selectedPaymentForPrint.transferOutNumber || "",
                        agentName: selectedPaymentForPrint.returnDetails?.agentName || selectedPaymentForPrint.supplierRepName || "",
                        agentNationalId: selectedPaymentForPrint.returnDetails?.agentNationalId || selectedPaymentForPrint.supplierNationalId || "",
                        agentMobile: selectedPaymentForPrint.returnDetails?.agentMobile || "",
                        items: (selectedPaymentForPrint.returnDetails?.items && selectedPaymentForPrint.returnDetails.items.length > 0)
                          ? selectedPaymentForPrint.returnDetails.items
                          : [{
                              barcode: "N/A",
                              itemName: selectedPaymentForPrint.returnDetails?.reason || "بضاعة مرتجعة مخصومة من سداد المورد بموجب إذن خروج",
                              quantity: 1,
                              unitPrice: Number(selectedPaymentForPrint.returnDeductionAmount || 0),
                              totalPrice: Number(selectedPaymentForPrint.returnDeductionAmount || 0)
                            }],
                        settlementMethod: "money",
                        paymentTiming: "now",
                        isSettled: true,
                        settledByVoucher: selectedPaymentForPrint.invoiceNumber || selectedPaymentForPrint.id,
                        paymentVoucherNumber: selectedPaymentForPrint.invoiceNumber || selectedPaymentForPrint.id,
                        returnedAt: selectedPaymentForPrint.returnDetails?.returnedAt || selectedPaymentForPrint.date,
                        date: selectedPaymentForPrint.date,
                        createdAt: selectedPaymentForPrint.createdAt,
                        createdBy: selectedPaymentForPrint.createdBy
                      }}
                      currentBranch={currentBranch}
                    />
                  </div>
                )}

                {(selectedPaymentForPrint.method === 'bank_transfer' || selectedPaymentForPrint.method === 'bank' || selectedPaymentForPrint.bankTransferReceiptUrl) && selectedPaymentForPrint.bankTransferReceiptUrl && (
                  <BankTransferReceiptPrintPage
                    payment={selectedPaymentForPrint}
                    currentBranch={currentBranch}
                    elementId={`pdf-bulk-payment-${selectedPaymentForPrint.id}-bank-receipt`}
                  />
                )}

                {urls.map((url: string, index: number) => (
                  <div key={`bulk-pay-${selectedPaymentForPrint.id}-invoice-${index}`} id={`pdf-bulk-payment-${selectedPaymentForPrint.id}-invoice-${index}`} style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
                      <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>Supplier Invoice {urls.length > 1 ? `(Page ${index + 1})` : ''}</h1>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>Inv: {selectedPaymentForPrint.invoiceNumber || 'N/A'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0 }}>مرفق الفاتورة</h1>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>{selectedPaymentForPrint.companyName}</p>
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

    </div>
  );
}
