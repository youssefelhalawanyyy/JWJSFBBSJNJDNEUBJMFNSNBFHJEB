import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, Firestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { queueOfflineWrite } from "./offline-sync";

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  authDomain: "ckkk-576e7.firebaseapp.com",
  projectId: "ckkk-576e7",
  storageBucket: "ckkk-576e7.firebasestorage.app",
  messagingSenderId: "174398232186",
  appId: "1:174398232186:web:a94c68480f27e25a668dc3"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  db = getFirestore(app);
}
export const auth = getAuth(app);

// Guarantee persistent auth sessions across page refreshes and browser tabs
if (typeof window !== "undefined") {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Could not set auth persistence:", err);
    });
  });
}
export const storage = getStorage(app);

// Initialize Cloud Messaging (only works in browser)
export const messaging = typeof window !== "undefined" ? isSupported().then(supported => supported ? getMessaging(app) : null) : null;

// Secondary App for Products
const productsFirebaseConfig = {
  apiKey: "AIzaSyB3-niohjGPupubR2Z66VAMiNqCCUkHf8I",
  authDomain: "anhproducts.firebaseapp.com",
  projectId: "anhproducts",
  storageBucket: "anhproducts.firebasestorage.app",
  messagingSenderId: "173111398956",
  appId: "1:173111398956:web:689a08b712369099a0b789",
  measurementId: "G-TZGGKZ4PNR"
};
const productsApp = getApps().find(a => a.name === "productsApp") || initializeApp(productsFirebaseConfig, "productsApp");

let productsDbLocal: Firestore;
try {
  productsDbLocal = getFirestore(productsApp);
} catch (e) {
  productsDbLocal = getFirestore(productsApp);
}

export const productsDb = productsDbLocal;
export const productsStorage = getStorage(productsApp);

export { app, db, productsApp };

export const getMockMode = () => false; // Disabled
export const setMockMode = (mode: boolean) => {}; // Disabled

export const dbService = {
  getDocs: async (collectionNameOrQuery: string | any): Promise<any[]> => {
    const q = typeof collectionNameOrQuery === 'string' 
      ? query(collection(db, collectionNameOrQuery)) 
      : collectionNameOrQuery;
    const querySnapshot = await getDocs(q);
    const docs: any[] = [];
    querySnapshot.forEach((doc) => {
      docs.push({ id: doc.id, ...(doc.data() as any) });
    });
    return docs;
  },

  getDoc: async (collectionName: string, id: string): Promise<any | null> => {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...(docSnap.data() as any) } : null;
  },

  addDoc: async (collectionName: string, data: any): Promise<any> => {
    const payload = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    };
    try {
      const docRef = await addDoc(collection(db, collectionName), payload);
      const docSnap = await getDoc(docRef);
      
      return { id: docRef.id, ...(docSnap.data() as any) };
    } catch (err: any) {
      if (err?.code?.includes('unavailable') || err?.code?.includes('network') || !navigator.onLine) {
        await queueOfflineWrite({
          operation: "addDoc",
          collectionName,
          data: payload,
          createdAt: new Date().toISOString()
        });
        return { id: `offline_${Date.now()}`, ...payload, _offline: true };
      }
      throw err;
    }
  },

  setDoc: async (collectionName: string, id: string, data: any): Promise<any> => {
    try {
      const docRef = doc(db, collectionName, id);
      await setDoc(docRef, data);

      return { id, ...data };
    } catch (err: any) {
      if (err?.code?.includes('unavailable') || err?.code?.includes('network') || !navigator.onLine) {
        await queueOfflineWrite({
          operation: "setDoc",
          collectionName,
          docId: id,
          data,
          createdAt: new Date().toISOString()
        });
        return { id, ...data, _offline: true };
      }
      throw err;
    }
  },

  updateDoc: async (collectionName: string, id: string, data: any): Promise<boolean> => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, data);
      return true;
    } catch (err: any) {
      if (err?.code?.includes('unavailable') || err?.code?.includes('network') || !navigator.onLine) {
        await queueOfflineWrite({
          operation: "updateDoc",
          collectionName,
          docId: id,
          data,
          createdAt: new Date().toISOString()
        });
        return true;
      }
      throw err;
    }
  },

  deleteDoc: async (collectionName: string, id: string): Promise<boolean> => {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    return true;
  },

  onSnapshot: (collectionNameOrQuery: string | any, callback: (data: any[]) => void): (() => void) => {
    const q = typeof collectionNameOrQuery === 'string' 
      ? query(collection(db, collectionNameOrQuery)) 
      : collectionNameOrQuery;
    const logName = typeof collectionNameOrQuery === 'string' ? collectionNameOrQuery : 'query';
    const unsubscribe = onSnapshot(q, (querySnapshot: any) => {
      const docs: any[] = [];
      querySnapshot.forEach((doc: any) => {
        docs.push({ id: doc.id, ...(doc.data() as any) });
      });
      console.log(`Fetched ${docs.length} from ${logName}`);
      callback(docs);
    }, (error: any) => {
      console.error(`Firebase error on ${logName}:`, error);
    });
    return unsubscribe;
  },

  logAction: async (userEmail: string, userName: string, role: string, action: string, previousValue: string, newValue: string) => {
    const logEntry = {
      userEmail,
      userName,
      role,
      action,
      previousValue: previousValue.slice(0, 300) + (previousValue.length > 300 ? "..." : ""),
      newValue: newValue.slice(0, 300) + (newValue.length > 300 ? "..." : ""),
      timestamp: new Date().toISOString(),
      ip: typeof window !== "undefined" ? "127.0.0.1" : "Server",
      device: typeof window !== "undefined" ? navigator.userAgent.substring(0, 100) : "Server Node"
    };

    try {
      await addDoc(collection(db, "audit_logs"), logEntry);
    } catch (err) {
      console.error("Failed to write live audit log:", err);
    }
  }
};
