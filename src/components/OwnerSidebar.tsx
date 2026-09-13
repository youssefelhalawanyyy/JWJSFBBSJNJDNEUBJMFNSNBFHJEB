"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Wallet, Building, ArrowDownToLine, LogOut, Settings } from "lucide-react";
import { playPopSound } from "@/lib/sounds";
import { useLanguage } from "@/context/LanguageContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export function OwnerSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { language: lang } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");

  const TABS = [
    { id: "dashboard", labelEn: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard, path: "/owner" },
    { id: "sales", labelEn: "Sales", labelAr: "المبيعات", icon: TrendingUp, path: "/owner/sales" },
    { id: "payments", labelEn: "Payments", labelAr: "المدفوعات", icon: Wallet, path: "/owner/payments" },
    { id: "credits", labelEn: "Credits", labelAr: "الذمم", icon: Building, path: "/owner/credits" },
    { id: "deposits", labelEn: "Deposits", labelAr: "الايداعات", icon: ArrowDownToLine, path: "/owner/deposits" },
  ];

  useEffect(() => {
    if (pathname === "/owner") setActiveTab("dashboard");
    else if (pathname.includes("/owner/sales")) setActiveTab("sales");
    else if (pathname.includes("/owner/payments")) setActiveTab("payments");
    else if (pathname.includes("/owner/credits")) setActiveTab("credits");
    else if (pathname.includes("/owner/deposits")) setActiveTab("deposits");

    TABS.forEach(tab => {
      try { router.prefetch(tab.path); } catch(e) {}
    });
  }, [pathname, router]);

  const handleNav = (tab: any) => {
    if (activeTab === tab.id) return;
    playPopSound();
    setActiveTab(tab.id);
    router.push(tab.path);
  };

  const handleLogout = async () => {
    playPopSound();
    if (typeof window !== "undefined") {
      localStorage.removeItem("circlek_logged_in");
      localStorage.removeItem("circlek_user_email");
      localStorage.removeItem("circlek_role");
      localStorage.removeItem("circlek_user_name");
      sessionStorage.clear();
    }
    await signOut(auth);
  };

  return (
    <div 
      className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 bg-[#0B1121]/90 backdrop-blur-2xl border-r border-white/5 z-50 p-6"
      style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
    >
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl bg-[#22d3ee] flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
          <Settings size={20} color="#0B1121" />
        </div>
        <div>
          <h1 className="text-[#f8fafc] font-bold text-lg tracking-wide leading-none">CIRCLE K</h1>
          <p className="text-[#64748b] text-[10px] uppercase font-bold tracking-widest mt-1">Enterprise</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleNav(tab)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? "bg-[rgba(34,211,238,0.15)] text-[#22d3ee] border border-[rgba(34,211,238,0.3)]" 
                  : "bg-transparent text-[#64748b] hover:bg-[#151E32] hover:text-[#f8fafc] border border-transparent"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-sm ${isActive ? "font-bold" : "font-semibold"}`}>
                {lang === "en" ? tab.labelEn : tab.labelAr}
              </span>
            </button>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors bg-[rgba(239,68,68,0.1)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] mt-auto"
      >
        <LogOut size={20} />
        <span className="text-sm font-semibold">
          {lang === "en" ? "Sign Out" : "تسجيل خروج"}
        </span>
      </button>
    </div>
  );
}
