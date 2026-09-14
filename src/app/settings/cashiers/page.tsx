"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, query, where } from "firebase/firestore";
import { Users, Trash2, PlusCircle, Lock, Store, Clock, Building, Dices } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function CashierSettingsPage() {
  const { currentBranch, availableBranches } = useBranch();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  const isManager = useMemo(() => {
    if (typeof window === "undefined") return false;
    const role = localStorage.getItem("circlek_role");
    const email = currentUser?.email?.toLowerCase() || "";
    if (email.includes("halawany") || email.includes("admin") || email.includes("youssef")) return false;
    return role === "manager";
  }, [currentUser]);

  const [cashiers, setCashiers] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [pin, setPin] = useState("");
  const [shiftType, setShiftType] = useState("All");
  const [branchId, setBranchId] = useState<string>("");
  const [features, setFeatures] = useState<any>({});
  
  useEffect(() => {
    if (!branchId && currentBranch !== "all") {
      setBranchId(currentBranch);
    }
  }, [currentBranch, branchId]);

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (isManager && editId) {
      setEditId(null);
    }
  }, [isManager, editId]);

  const generateUniquePin = () => {
    let newPin = "";
    let isUnique = false;
    while (!isUnique) {
      newPin = Math.floor(1000 + Math.random() * 9000).toString();
      isUnique = !cashiers.some(c => c.pin === newPin);
    }
    setPin(newPin);
    toast.success("Generated secure unique PIN");
  };

  const fetchCashiers = async () => {
    setLoading(true);
    try {
      const empSnap = await getDocs(collection(db, "employees"));
      const employeesMap = new Map<string, any>(empSnap.docs.map(d => [d.data().name, { id: d.id, ...d.data() }]));

      const snap = await getDocs(collection(db, "cashiers"));
      const allCashiers: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const activeCashiers: any[] = [];
      for (const c of allCashiers) {
        const emp = employeesMap.get(c.name);
        if (emp && !c.employeeId) {
          try {
            await updateDoc(doc(db, "cashiers", c.id), { employeeId: emp.id });
            c.employeeId = emp.id;
          } catch (err) {}
        }
        activeCashiers.push(c);
      }

      setCashiers(activeCashiers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, "employees"));
      const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeEmps = emps.filter((e: any) => e.status === "active");
      setEmployeesList(activeEmps);
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  useEffect(() => {
    fetchCashiers();
    fetchEmployees();
  }, []);

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId && isManager) {
      toast.error("Managers are not authorized to edit cashiers.");
      return;
    }
    if (pin.length !== 4) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }
    setAdding(true);
    try {
      const selectedEmp = employeesList.find(emp => emp.name === name);
      const empId = selectedEmp ? selectedEmp.id : "";

      if (editId) {
        await updateDoc(doc(db, "cashiers", editId), {
          name,
          storeId,
          pin,
          shiftType,
          employeeId: empId,
          branchId,
          features
        });
      } else {
        await addDoc(collection(db, "cashiers"), {
          name,
          storeId,
          pin,
          shiftType,
          employeeId: empId,
          branchId,
          features,
          createdAt: new Date().toISOString()
        });
      }
      
      setName("");
      setStoreId("");
      setPin("");
      setShiftType("All");
      setFeatures({});
      setEditId(null);
      fetchCashiers();
      toast.success("Cashier saved successfully!");
    } catch (e) {
      console.error(e);
      toast.error(`Failed to save cashier: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (cashier: any) => {
    if (isManager) {
      toast.error("Managers are not authorized to edit cashiers.");
      return;
    }
    setEditId(cashier.id);
    setName(cashier.name);
    setStoreId(cashier.storeId);
    setPin(cashier.pin);
    setShiftType(cashier.shiftType || "All");
    setBranchId(cashier.branchId || "alamein4");
    setFeatures(cashier.features || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (isManager) {
      toast.error("Managers are not authorized to delete cashiers.");
      return;
    }
    const target = cashiers.find(c => c.id === id);
    const cashierName = target?.name || "this cashier";

    toast.warning(`Remove ${cashierName}? All users currently logged in from this account will be logged out immediately.`, {
      action: {
        label: "Delete & Logout All",
        onClick: async () => {
          try {
            // 1. Immediately register in revoked_cashier_sessions to notify all listening devices
            await setDoc(doc(db, "revoked_cashier_sessions", id), {
              cashierId: id,
              name: target?.name || "",
              employeeId: target?.employeeId || "",
              storeId: target?.storeId || "",
              revokedAt: new Date().toISOString(),
              deletedBy: currentUser?.email || "admin",
              forceLogout: true
            });

            if (target?.name) {
              const nameSlug = target.name.trim().toLowerCase().replace(/\s+/g, "_");
              await setDoc(doc(db, "revoked_cashier_sessions", `name_${nameSlug}`), {
                cashierId: id,
                name: target.name,
                revokedAt: new Date().toISOString(),
                forceLogout: true
              }).catch(() => {});
            }

            // 2. Query and terminate any active_sessions in Firestore matching this cashier
            try {
              const [q1, q2, q3] = await Promise.all([
                getDocs(query(collection(db, "active_sessions"), where("cashierId", "==", id))),
                target?.name ? getDocs(query(collection(db, "active_sessions"), where("userName", "==", target.name))) : null,
                getDocs(query(collection(db, "active_sessions"), where("userId", "==", id)))
              ]);

              const sessionsToPurge = new Map();
              q1?.docs.forEach(d => sessionsToPurge.set(d.id, d.ref));
              q2?.docs.forEach(d => sessionsToPurge.set(d.id, d.ref));
              q3?.docs.forEach(d => sessionsToPurge.set(d.id, d.ref));

              await Promise.all(Array.from(sessionsToPurge.values()).map(ref => 
                updateDoc(ref, { forceLogout: true }).catch(() => {}).then(() => deleteDoc(ref).catch(() => {}))
              ));
            } catch (sessionErr) {
              console.warn("Active sessions purge notice:", sessionErr);
            }

            // 3. Delete the cashier document from cashiers collection
            await deleteDoc(doc(db, "cashiers", id));

            // 4. If current device is logged in with this cashier account, purge local session immediately
            if (typeof window !== "undefined") {
              const currentLocal = localStorage.getItem("active_cashier_session");
              if (currentLocal) {
                try {
                  const parsed = JSON.parse(currentLocal);
                  if (parsed.id === id || parsed.name === target?.name) {
                    localStorage.removeItem("active_cashier_session");
                    sessionStorage.removeItem("active_cashier_session");
                  }
                } catch (e) {}
              }
            }

            fetchCashiers();
            toast.success(`Cashier ${cashierName} removed and logged out of all connected devices.`);
          } catch (e) {
            console.error(e);
            toast.error("Failed to delete cashier");
          }
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 bg-background min-h-screen">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Cashier Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage cashier profiles, store assignments, and 4-digit security PINs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ADD / EDIT FORM */}
        <div className="md:col-span-1">
          <form onSubmit={handleAddCashier} className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold flex items-center gap-2">
                <PlusCircle className={`h-5 w-5 ${editId ? 'text-blue-500' : 'text-red-500'}`} /> 
                {editId ? 'Edit Cashier' : 'Add New Cashier'}
              </h2>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setName(''); setStoreId(''); setPin(''); setShiftType('All'); setFeatures({}); }} className="text-xs text-slate-500 underline">Cancel Edit</button>
              )}
            </div>
            
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Full Name</label>
              <input
                required
                type="text"
                list="employee-names"
                value={name}
                onChange={e => {
                  const selectedName = e.target.value;
                  setName(selectedName);
                  const selectedEmp = employeesList.find(emp => emp.name === selectedName);
                  if (selectedEmp && selectedEmp.storeId) {
                    setStoreId(selectedEmp.storeId);
                  }
                }}
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold"
                placeholder="Enter or select name..."
              />
              <datalist id="employee-names">
                {employeesList.map(emp => (
                  <option key={emp.id} value={emp.name}>
                    {emp.position || "Employee"}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Building className="h-3 w-3" /> Branch</label>
              <select
                required
                value={branchId}
                onChange={e => {
                  const bId = e.target.value;
                  setBranchId(bId);
                  if (bId === 'alamein4') setStoreId('eL-alamein-4');
                  else if (bId === 'ola') setStoreId('ola-el-koronfol');
                }}
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold"
              >
                <option value="">Select Branch...</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Store className="h-3 w-3" /> Default Store ID</label>
              <input required value={storeId} onChange={e => setStoreId(e.target.value)} type="text" className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold" placeholder="e.g. eL-alamein-4" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Allowed Shift</label>
              <select
                value={shiftType}
                onChange={e => setShiftType(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold"
              >
                <option value="All">All (Cashier chooses)</option>
                <option value="Morning">Morning Only</option>
                <option value="Noon">Noon Only</option>
                <option value="Night">Night Only</option>
              </select>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Special Features</label>
              <label className="flex items-center justify-between cursor-pointer p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Master Item Scanner</p>
                  <p className="text-xs text-muted-foreground">Scan barcodes to view detailed pricing and history.</p>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={features.canUseMasterScanner || false}
                    onChange={(e) => setFeatures({...features, canUseMasterScanner: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-500"></div>
                </div>
              </label>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Lock className="h-3 w-3" /> 4-Digit PIN</label>
              <div className="flex gap-2">
                <input required value={pin} onChange={e => setPin(e.target.value)} type="text" pattern="[0-9]{4}" maxLength={4} className="flex-1 p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 font-mono tracking-widest text-center text-lg" placeholder="1234" />
                <button type="button" onClick={generateUniquePin} className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-border rounded-lg text-slate-500 transition-colors" title="Generate Unique PIN">
                  <Dices className="h-5 w-5" />
                </button>
              </div>
            </div>

            <button disabled={adding} type="submit" className={`w-full py-3 text-white rounded-lg font-bold disabled:opacity-50 transition-colors ${editId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {adding ? "Saving..." : editId ? "Save Changes" : "Add Cashier"}
            </button>
          </form>
        </div>

        {/* CASHIERS LIST */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Users className="h-5 w-5 text-slate-500" /> Active Cashiers</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cashiers.filter(c => {
              if (currentBranch === 'all') return true;
              if (c.branchId) return c.branchId === currentBranch;
              
              // Backward compatibility for cashiers without branchId
              const store = (c.storeId || "").toLowerCase();
              if (currentBranch === 'alamein4') {
                return store.includes('alamein') || (!store.includes('alamein') && !store.includes('ola'));
              } else if (currentBranch === 'ola') {
                return store.includes('ola');
              }
              return true;
            }).map(c => (
              <div key={c.id} className="bg-card border border-border p-4 rounded-xl flex justify-between items-center shadow-sm relative overflow-hidden">
                <div>
                  <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] uppercase font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/50">
                      {c.shiftType || 'All'} Shift
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1"><Store className="h-3 w-3 inline-block -mt-0.5 mr-1" />{c.storeId}</p>
                  <p className="text-xs bg-red-500/10 text-red-650 dark:text-red-400 font-mono px-2 py-0.5 rounded mt-2 inline-block border border-red-200/50 dark:border-red-905/30"><Lock className="h-3 w-3 inline-block -mt-0.5 mr-1" />PIN: ****</p>
                </div>
                <div className="flex gap-2">
                  {!isManager && (
                    <button onClick={() => handleEdit(c)} className="px-3 py-1 text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-200/50 dark:border-blue-905/30">
                      Edit
                    </button>
                  )}
                  {!isManager && (
                    <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors" title="Remove Cashier">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {cashiers.length === 0 && (
              <div className="col-span-full text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
                No cashiers registered yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
