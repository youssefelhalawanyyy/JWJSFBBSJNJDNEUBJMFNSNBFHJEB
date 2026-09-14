"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  Store, 
  User, 
  Sparkles,
  Delete,
  Eye,
  EyeOff
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc, addDoc, collection } from "firebase/firestore";
import { playSuccessSound, playErrorSound, playPopSound } from "@/lib/sounds";

function ResetPinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const cashierId = searchParams.get("id") || "";
  const token = searchParams.get("token") || "";

  // Language state
  const [lang, setLang] = useState<"ar" | "en">("ar");

  // Verification state
  const [validating, setValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cashierData, setCashierData] = useState<{ 
    id: string; 
    name: string; 
    branchId: string; 
    storeId: string; 
    shiftType: string;
    isFirstTime?: boolean;
  } | null>(null);

  // Form states
  const [step, setStep] = useState<1 | 2>(1);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Trigger error shake animation & haptic feedback
  const triggerError = (msg?: string) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40, 80, 40]);
    }
    try {
      playErrorSound();
    } catch {}
    setShake(true);
    setTimeout(() => setShake(false), 500);
    if (msg) setErrorMessage(msg);
  };

  // Initial token verification
  useEffect(() => {
    if (!cashierId || !token) {
      setValidating(false);
      setIsValidToken(false);
      setErrorMessage(lang === "ar" ? "رابط غير مكتمل. يرجى التأكد من الضغط على الرابط بالكامل من رسالة الواتساب." : "Incomplete link. Please click the full link received on WhatsApp.");
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        // Direct read from Firestore (instant & resilient on mobile & desktop)
        const snap = await getDoc(doc(db, "cashiers", cashierId));
        if (!isMounted) return;

        if (snap.exists()) {
          const data = snap.data();
          if (data?.resetPinToken && String(data.resetPinToken).trim() === String(token).trim()) {
            // Check 48 hours expiration
            if (data.resetPinRequestedAt) {
              const reqTime = new Date(data.resetPinRequestedAt).getTime();
              const hoursElapsed = (Date.now() - reqTime) / (1000 * 60 * 60);
              if (hoursElapsed > 48) {
                setIsValidToken(false);
                setErrorMessage(lang === "ar" ? "انتهت صلاحية هذا الرابط (أكثر من 48 ساعة). يرجى طلب رابط جديد من المدير." : "This reset link has expired (48h limit). Please request a new one from your manager.");
                return;
              }
            }

            const isFirstTime = Boolean(data.isFirstTimeSetup || !data.pin);
            setIsValidToken(true);
            setCashierData({
              id: snap.id,
              name: data.name || "الكاشير",
              branchId: data.branchId || "alamein4",
              storeId: data.storeId || "Circle K",
              shiftType: data.shiftType || "All",
              isFirstTime
            });
            return;
          } else {
            setIsValidToken(false);
            setErrorMessage(lang === "ar" ? "الرابط غير صالح أو تم استخدامه مسبقاً وتعيين الرمز." : "This reset link is invalid or has already been used.");
            return;
          }
        } else {
          setIsValidToken(false);
          setErrorMessage(lang === "ar" ? "حساب الكاشير غير موجود أو تم حذفه." : "Cashier account not found.");
          return;
        }
      } catch (err: any) {
        console.warn("Direct verification error, checking API fallback:", err);
        try {
          const res = await fetch(`/api/cashier/reset-pin?id=${encodeURIComponent(cashierId)}&token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const apiData = await res.json();
            if (isMounted && apiData.valid) {
              setIsValidToken(true);
              setCashierData(apiData.cashier);
              return;
            }
          }
        } catch {}

        if (!isMounted) return;
        setIsValidToken(false);
        setErrorMessage(lang === "ar" ? "تعذر التحقق من الرابط. تحقق من اتصال الإنترنت." : "Failed to verify link. Check internet connection.");
      } finally {
        if (isMounted) setValidating(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [cashierId, token, lang]);

  // Handle keypad digit click
  const handleDigitClick = (digit: string) => {
    try {
      playPopSound();
    } catch {}
    setErrorMessage("");

    if (step === 1) {
      if (newPin.length < 4) {
        const updated = newPin + digit;
        setNewPin(updated);
        if (updated.length === 4) {
          // Check weak PINs immediately
          const weakPins = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"];
          if (weakPins.includes(updated)) {
            triggerError(lang === "ar" ? "هذا الرمز سهل التخمين. اختر 4 أرقام أخرى." : "This PIN is too common. Please pick another.");
            setTimeout(() => setNewPin(""), 400);
            return;
          }
          // Proceed to confirm step
          setTimeout(() => {
            setStep(2);
          }, 250);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const updated = confirmPin + digit;
        setConfirmPin(updated);
        if (updated.length === 4) {
          if (updated !== newPin) {
            triggerError(lang === "ar" ? "الرمزان غير متطابقين. يرجى التأكيد مجدداً." : "PINs do not match. Please re-confirm.");
            setTimeout(() => setConfirmPin(""), 400);
            return;
          }
          // Matching! Trigger submit
          executePinReset(newPin);
        }
      }
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    try {
      playPopSound();
    } catch {}
    setErrorMessage("");

    if (step === 1) {
      setNewPin(prev => prev.slice(0, -1));
    } else {
      if (confirmPin.length > 0) {
        setConfirmPin(prev => prev.slice(0, -1));
      } else {
        // Go back to step 1
        setStep(1);
        setNewPin("");
      }
    }
  };

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isValidToken || isSuccess || submitting) return;
      if (/^[0-9]$/.test(e.key)) {
        handleDigitClick(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, newPin, confirmPin, isValidToken, isSuccess, submitting]);

  // Execute reset submission directly to Firestore with API fallback
  const executePinReset = async (finalPin: string) => {
    setSubmitting(true);
    try {
      const cashierRef = doc(db, "cashiers", cashierId);
      const nowIso = new Date().toISOString();
      const nameSlug = (cashierData?.name || "").trim().toLowerCase().replace(/\s+/g, "_");

      // Direct Firestore update
      await updateDoc(cashierRef, {
        pin: finalPin,
        requirePinChange: false,
        resetPinToken: null,
        resetPinRequestedAt: null,
        isFirstTimeSetup: false,
        pinChangedAt: nowIso,
        updatedAt: nowIso
      });

      // Clear any session revocation records so cashier can log in immediately
      await Promise.all([
        deleteDoc(doc(db, "revoked_cashier_sessions", cashierId)).catch(() => {}),
        deleteDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`)).catch(() => {})
      ]);

      // Security audit log
      await addDoc(collection(db, "audit_logs"), {
        timestamp: nowIso,
        action: "CASHIER_PIN_RESET_SELF",
        category: "SECURITY",
        cashierId,
        cashierName: cashierData?.name || "Cashier",
        details: `Cashier ${cashierData?.name || cashierId} set a new 4-digit PIN via self-service link.`
      }).catch(() => {});

      try {
        playSuccessSound();
      } catch {}
      setIsSuccess(true);
    } catch (directErr: any) {
      console.warn("Direct update failed, trying API route fallback:", directErr);
      try {
        const res = await fetch("/api/cashier/reset-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cashierId,
            token,
            newPin: finalPin
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            try {
              playSuccessSound();
            } catch {}
            setIsSuccess(true);
            return;
          }
        }
      } catch (apiErr) {
        console.error("API route fallback error:", apiErr);
      }

      triggerError(lang === "ar" ? "فشل حفظ الرمز الجديد. يرجى المحاولة ثانية." : "Failed to update PIN. Please try again.");
      setConfirmPin("");
    } finally {
      setSubmitting(false);
    }
  };

  const currentPin = step === 1 ? newPin : confirmPin;

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none font-sans relative overflow-hidden" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Background Ambience Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar / Language Switcher */}
      <header className="w-full max-w-md flex items-center justify-between z-10 pt-2 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wider text-cyan-400 uppercase">Circle K Portal</div>
            <div className="text-sm font-bold text-white leading-none">Security PIN Setup</div>
          </div>
        </div>

        <button
          onClick={() => setLang(l => (l === "ar" ? "en" : "ar"))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-bold text-slate-300 transition-all active:scale-95"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>{lang === "ar" ? "English" : "العربية"}</span>
        </button>
      </header>

      {/* Main Body */}
      <main className="w-full max-w-md flex-1 flex flex-col justify-center items-center z-10 my-auto">
        {validating ? (
          <div className="text-center space-y-4 p-8">
            <div className="w-14 h-14 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-400">
              {lang === "ar" ? "جاري التحقق من أمان الرابط..." : "Verifying secure reset link..."}
            </p>
          </div>
        ) : !isValidToken ? (
          /* Error State: Invalid or Expired Token */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full rounded-3xl bg-[#151E32]/90 border border-red-500/30 p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="w-16 h-16 rounded-3xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">
                {lang === "ar" ? "الرابط غير صالح أو منتهي الصلاحية" : "Invalid or Expired Link"}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {errorMessage || (lang === "ar" ? "لم نتمكن من العثور على طلب تغيير رمز سري نشط بهذا الرابط. يرجى طلب رابط جديد من المشرف." : "No active PIN reset request found. Please contact your manager to receive a new link via WhatsApp.")}
              </p>
            </div>

            <button
              onClick={() => router.push("/cashier")}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition-all active:scale-95"
            >
              {lang === "ar" ? "العودة لبوابة الكاشير" : "Return to Cashier Terminal"}
            </button>
          </motion.div>
        ) : isSuccess ? (
          /* Success State: PIN updated */
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full rounded-3xl bg-[#151E32]/95 border border-emerald-500/30 p-6 sm:p-8 text-center space-y-6 shadow-[0_0_60px_rgba(16,185,129,0.2)] backdrop-blur-xl"
          >
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {cashierData?.isFirstTime
                    ? (lang === "ar" ? "تم إنشاء الرمز بنجاح" : "PIN Created Successfully")
                    : (lang === "ar" ? "تم التحديث بنجاح" : "Successfully Updated")}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white">
                {cashierData?.isFirstTime
                  ? (lang === "ar" ? "تم تعيين رمزك السري لأول مرة!" : "Your New PIN is Ready!")
                  : (lang === "ar" ? "تم تعيين رمزك السري الجديد!" : "Your New PIN is Set!")}
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                {lang === "ar" 
                  ? `مرحباً ${cashierData?.name}، تم حفظ رمزك السري بنجاح. يمكنك الآن تسجيل الدخول مباشرة للوردية.` 
                  : `Welcome ${cashierData?.name}, your security PIN is now ready. You can now log into your shift.`}
              </p>
            </div>

            <button
              onClick={() => router.push("/cashier")}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{lang === "ar" ? "تسجيل الدخول الآن" : "Go to Cashier Login"}</span>
              {lang === "ar" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </motion.div>
        ) : (
          /* Active PIN Entry Card */
          <motion.div
            animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="w-full rounded-3xl bg-[#151E32]/90 border border-cyan-500/20 p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center"
          >
            {/* Cashier Badge Header */}
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-800/80 border border-slate-700/60 mb-5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                {cashierData?.name?.charAt(0) || "C"}
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-white">{cashierData?.name}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Store className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{cashierData?.storeId || "Circle K"}</span>
                </div>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                step === 1 ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300" : "bg-slate-800/60 text-slate-400"
              }`}>
                <span>1</span>
                <span>{lang === "ar" ? (cashierData?.isFirstTime ? "إنشاء الرمز" : "الرمز الجديد") : (cashierData?.isFirstTime ? "Create PIN" : "New PIN")}</span>
              </div>

              <div className="w-4 h-[1px] bg-slate-700" />

              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                step === 2 ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300" : "bg-slate-800/60 text-slate-400"
              }`}>
                <span>2</span>
                <span>{lang === "ar" ? "تأكيد الرمز" : "Confirm"}</span>
              </div>
            </div>

            {/* Instructions */}
            <h3 className="text-lg font-black text-white text-center mb-1">
              {step === 1 
                ? (cashierData?.isFirstTime
                    ? (lang === "ar" ? "اختر رمزك السري الجديد (4 أرقام)" : "Choose Your 4-Digit Security PIN")
                    : (lang === "ar" ? "أدخل الرمز السري الجديد (4 أرقام)" : "Enter Your New 4-Digit PIN"))
                : (lang === "ar" ? "أعد إدخال الرمز للتأكيد" : "Re-enter PIN to Confirm")}
            </h3>
            <p className="text-xs text-slate-400 text-center mb-6">
              {step === 1
                ? (cashierData?.isFirstTime
                    ? (lang === "ar" ? "اختر رمزاً سرياً خاصاً بك لتسجيل الدخول للورديات" : "Choose a private 4-digit code to log into your register shifts")
                    : (lang === "ar" ? "يرجى اختيار رمز سري لا يسهل تخمينه" : "Choose a secure 4-digit code for your register"))
                : (lang === "ar" ? "تأكد من مطابقة الأرقام الأربعة" : "Ensure both PIN entries match perfectly")}
            </p>

            {/* 4 PIN Dots / Preview */}
            <div className="flex items-center justify-center gap-4 mb-3">
              {[0, 1, 2, 3].map(idx => {
                const filled = idx < currentPin.length;
                return (
                  <motion.div
                    key={idx}
                    animate={filled ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`w-12 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-black transition-all ${
                      filled
                        ? "bg-gradient-to-b from-cyan-500/25 to-cyan-500/10 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                        : "bg-slate-800/50 border border-slate-700/60 text-slate-600"
                    }`}
                  >
                    {filled ? (showPin ? currentPin[idx] : "•") : ""}
                  </motion.div>
                );
              })}
            </div>

            {/* Eye Peek Toggle & Error Text */}
            <div className="h-6 flex items-center justify-center gap-2 mb-4">
              {errorMessage ? (
                <span className="text-xs font-bold text-red-400 animate-pulse">{errorMessage}</span>
              ) : currentPin.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPin ? (lang === "ar" ? "إخفاء" : "Hide") : (lang === "ar" ? "إظهار" : "Peek")}</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">
                  {step === 2 && (
                    <button onClick={() => { setStep(1); setNewPin(""); setConfirmPin(""); }} className="text-cyan-400 hover:underline">
                      {lang === "ar" ? "← تغيير الرمز الأول" : "← Change First PIN"}
                    </button>
                  )}
                </span>
              )}
            </div>

            {/* Virtual Numpad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
                <button
                  key={num}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDigitClick(num)}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-cyan-500/20 active:border-cyan-500/40 border border-slate-700/60 text-xl font-bold text-white transition-all active:scale-95 shadow-md disabled:opacity-50 flex items-center justify-center"
                >
                  {num}
                </button>
              ))}

              {/* Reset/Cancel */}
              <button
                type="button"
                disabled={submitting || currentPin.length === 0}
                onClick={() => {
                  if (step === 2) {
                    setConfirmPin("");
                  } else {
                    setNewPin("");
                  }
                }}
                className="h-14 rounded-2xl bg-slate-900/60 hover:bg-slate-800 text-xs font-bold text-slate-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center"
              >
                {lang === "ar" ? "مسح" : "Clear"}
              </button>

              {/* 0 */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDigitClick("0")}
                className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-cyan-500/20 active:border-cyan-500/40 border border-slate-700/60 text-xl font-bold text-white transition-all active:scale-95 shadow-md disabled:opacity-50 flex items-center justify-center"
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                disabled={submitting || currentPin.length === 0}
                onClick={handleBackspace}
                className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 active:scale-95 transition-all border border-slate-700/60 disabled:opacity-30 flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {submitting && (
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-cyan-400">
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>{lang === "ar" ? "جاري حفظ الرمز المشفر..." : "Saving encrypted PIN..."}</span>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-3 text-[11px] text-slate-500 z-10">
        Circle K Operations & Enterprise Security • Safe PIN Encryption
      </footer>
    </div>
  );
}

export default function ResetPinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1121] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    }>
      <ResetPinContent />
    </Suspense>
  );
}
