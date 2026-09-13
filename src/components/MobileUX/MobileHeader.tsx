"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { Store, Languages, Clock, Bell, LogOut, UserCheck, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";
import { playPopSound } from "@/lib/sounds";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

// Obsidian Design Tokens
const O = {
  bg: '#09090B',
  surface: '#18181B',
  elevated: '#27272A',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(225,29,72,0.3)',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textDim: '#52525B',
  rose: '#E11D48',
  orange: '#F97316',
  success: '#22C55E',
  amber: '#F59E0B',
};

export function MobileHeader() {
  const pathname = usePathname();
  const { currentBranch, setBranch, availableBranches } = useBranch();
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";

  const [isOnline, setIsOnline] = useState(true);
  const [timeString, setTimeString] = useState("");
  const [userRole, setUserRole] = useState("manager");
  const [managerName, setManagerName] = useState("Manager");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("circlek_role") || "manager";
      setUserRole(storedRole);

      const storedName = localStorage.getItem("circlek_user_name") || "Manager";
      setManagerName(storedName);
    }

    const handleRoleChanged = (e: CustomEvent) => {
      if (e.detail) setUserRole(e.detail);
    };

    const handleUserChanged = (e: CustomEvent) => {
      if (e.detail) setManagerName(e.detail);
    };

    window.addEventListener("circlek_role_changed", handleRoleChanged as any);
    window.addEventListener("circlek_user_changed", handleUserChanged as any);

    return () => {
      window.removeEventListener("circlek_role_changed", handleRoleChanged as any);
      window.removeEventListener("circlek_user_changed", handleUserChanged as any);
    };
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [isAr]);

  // Format branches dynamically according to user authorization
  const displayBranches = React.useMemo(() => {
    const activeRole = userRole || (typeof window !== "undefined" ? localStorage.getItem("circlek_role") : "manager") || "manager";
    const isManager = activeRole === "manager";

    if (isManager) {
      if (availableBranches && availableBranches.length > 0) {
        return availableBranches.map(b => ({
          id: b.id,
          labelEn: b.name,
          labelAr: b.id === "alamein4" ? "العلمين 4" : b.id === "ola" ? "علا القرنفلي" : b.name
        }));
      }
      return [
        { id: "alamein4" as BranchId, labelEn: "El Alamein 4", labelAr: "العلمين 4" }
      ];
    }

    if (availableBranches && availableBranches.length > 0) {
      return [
        { id: "all" as BranchId, labelEn: "All Branches", labelAr: "جميع الفروع" },
        ...availableBranches.map(b => ({
          id: b.id,
          labelEn: b.name,
          labelAr: b.id === "alamein4" ? "العلمين 4" : b.id === "ola" ? "علا القرنفلي" : b.name
        }))
      ];
    }
    return [
      { id: "all" as BranchId, labelEn: "All Branches", labelAr: "جميع الفروع" },
      { id: "alamein4" as BranchId, labelEn: "El Alamein 4", labelAr: "العلمين 4" },
      { id: "ola" as BranchId, labelEn: "Ola El Koronfol", labelAr: "علا القرنفلي" },
    ];
  }, [availableBranches, userRole]);

  const handleBranchSelect = (id: BranchId) => {
    triggerHapticFeedback(10);
    playPopSound();
    setBranch(id);
  };

  const handleLanguageToggle = () => {
    triggerHapticFeedback(12);
    playPopSound();
    setLanguage(language === "en" ? "ar" : "en");
  };

  const handleNotificationToggle = async () => {
    triggerHapticFeedback(12);
    playPopSound();

    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error(isAr ? "الإشعارات غير مدعومة على هذا المتصفح" : "Notifications not supported on this browser");
      return;
    }

    if (Notification.permission === "granted") {
      try {
        new Notification("🔔 Test Push Notification", {
          body: "Test notification dispatched successfully from Circle K Portal!",
          icon: "/icon-manager.png"
        });
      } catch (err) {
        console.warn("Local notification display error:", err);
      }

      toast.success(isAr ? "تم إرسال إشعار تجريبي بنجاح! 🔔" : "Test Notification Sent! 🔔");
    } else {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        try {
          new Notification("🔔 Test Push Notification", {
            body: "Push Notifications Enabled & Verified!",
            icon: "/icon-manager.png"
          });
        } catch (err) {
          console.warn("Local notification display error:", err);
        }
        toast.success(isAr ? "تم تفعيل وتجربة الإشعارات بنجاح! 🔔" : "Push Notifications Enabled & Tested! 🔔");
      } else {
        toast.error(isAr ? "تم رفض الإشعارات. يرجى تفعيلها من إعدادات المتصفح" : "Notification permission denied in browser settings.");
      }
    }
  };

  const handleLogout = async () => {
    triggerHapticFeedback(12);
    playPopSound();
    try {
      await signOut(auth);
      if (typeof window !== "undefined") {
        localStorage.removeItem("circlek_logged_in");
        localStorage.removeItem("circlek_user_email");
        localStorage.removeItem("circlek_role");
        localStorage.removeItem("circlek_user_name");
        sessionStorage.clear();
      }
      toast.success(isAr ? "تم تسجيل الخروج بنجاح" : "Logged out successfully!");
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Get Initials for Manager Avatar
  const getInitials = (name: string) => {
    if (!name || name === "Manager") return "K";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const isManager = userRole === "manager";

  return (
    <header
      className="sticky top-0 z-40 w-full md:hidden no-print transition-all"
      style={{
        background: `${O.bg}F2`,
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        borderBottom: `1px solid ${O.border}`,
        paddingTop: "max(10px, env(safe-area-inset-top))",
        paddingLeft: 14,
        paddingRight: 14,
        paddingBottom: 10,
      }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Top Row: Avatar + Name + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>

        {/* User Profile Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {/* Gradient-ringed Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 16,
              background: 'conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)',
              padding: 2,
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: 14,
                background: O.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: O.textPrimary, fontWeight: 900, fontSize: 14, letterSpacing: '-0.02em',
              }}>
                {getInitials(managerName)}
              </div>
            </div>
            {/* Online indicator */}
            <span style={{
              position: 'absolute', bottom: -1, right: -1,
              width: 10, height: 10, borderRadius: '50%',
              background: isOnline ? O.success : O.amber,
              border: `2.5px solid ${O.bg}`,
              boxShadow: isOnline ? `0 0 8px rgba(34,197,94,0.7)` : 'none',
            }} />
          </div>

          {/* Name + Role */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{
                fontSize: 14, fontWeight: 800, color: O.textPrimary,
                letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', maxWidth: 140, margin: 0,
              }}>
                {managerName}
              </h2>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 8,
                background: 'rgba(225,29,72,0.12)', color: '#FB7185',
                border: '1px solid rgba(225,29,72,0.2)', textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
              }}>
                <ShieldCheck size={10} color="#FB7185" />
                {isManager ? (isAr ? "مدير" : "Mgr") : (isAr ? "مالك" : "Owner")}
              </span>
            </div>
            <p style={{ fontSize: 11, color: O.textSecondary, margin: 0, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} color={O.textDim} />
              <span style={{ fontWeight: 600, color: O.textSecondary }}>{timeString}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Back to Operations Hub Button (Mobile) */}
          {pathname !== '/' && (
            <Link
              href="/"
              prefetch={true}
              style={{
                height: 36,
                padding: '0 10px',
                borderRadius: 12,
                background: 'rgba(225,29,72,0.18)',
                border: '1px solid rgba(225,29,72,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: '#FAFAFA',
                fontSize: 11,
                fontWeight: 800,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={13} color="#FB7185" style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
              <span>{isAr ? "الرئيسية" : "Hub"}</span>
            </Link>
          )}

          {/* Notification Button */}
          <button
            onClick={handleNotificationToggle}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: O.surface, border: `1px solid ${O.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            title="Notifications"
          >
            <Bell size={15} color={O.textSecondary} />
          </button>

          {/* Language Toggle */}
          <button
            onClick={handleLanguageToggle}
            style={{
              height: 36, borderRadius: 12, padding: '0 10px',
              background: O.surface, border: `1px solid ${O.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              cursor: 'pointer', transition: 'all 0.15s',
              fontSize: 11, fontWeight: 800, color: O.textSecondary,
            }}
          >
            <Languages size={13} color={O.textSecondary} />
            {language === "en" ? "عربي" : "EN"}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            title={isAr ? "تسجيل الخروج" : "Logout"}
          >
            <LogOut size={15} color="#FB7185" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Branch Selector Pills */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        overflowX: 'auto', paddingBottom: 2,
        msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: O.textDim, flexShrink: 0, marginRight: 2 }}>
          <Store size={13} color={O.rose} />
          <span>{isAr ? "الفرع:" : "Branch:"}</span>
        </div>

        {displayBranches.map((b) => {
          const isActive = currentBranch === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleBranchSelect(b.id as BranchId)}
              style={{
                padding: '6px 14px', borderRadius: 10,
                fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 6,
                background: isActive ? 'linear-gradient(135deg, #E11D48, #F97316)' : O.surface,
                color: isActive ? '#fff' : O.textSecondary,
                border: isActive ? '1px solid rgba(225,29,72,0.5)' : `1px solid ${O.border}`,
                boxShadow: isActive ? '0 4px 14px rgba(225,29,72,0.2)' : 'none',
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: isActive ? '#fff' : O.textDim,
              }} />
              {b.labelAr && isAr ? b.labelAr : b.labelEn}
            </button>
          );
        })}
      </div>
    </header>
  );
}
