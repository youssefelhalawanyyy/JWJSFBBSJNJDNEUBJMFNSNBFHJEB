import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { productsDb } from "./firebase";

export async function syncProductsToMaster(items: any[], poDate: string, supplierName?: string) {
  if (!items || items.length === 0) return;

  const syncItem = async (item: any) => {
    let barcode = item.barcode?.toString().trim();
    
    if (!barcode) {
      if (item.description) {
        // Fallback to a sanitized version of the description as the ID
        barcode = item.description.toString().trim().replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 50);
      }
    }
    
    if (!barcode) return;

    const unitPrice = Number(item.unitPrice) || 0;
    const docRef = doc(productsDb, "products", barcode);
    
    try {
      const docSnap = await getDoc(docRef);

      const newHistoryEntry = { 
        price: unitPrice, 
        date: poDate, 
        timestamp: Date.now(),
        supplier: supplierName || "Unknown Supplier" 
      };

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check if we already have this exact entry to prevent duplicates from rapid saves
        const isDuplicate = data.priceHistory?.some(
          (h: any) => h.date === poDate && h.supplier === (supplierName || "Unknown Supplier") && h.price === unitPrice
        );

        if (!isDuplicate) {
          await updateDoc(docRef, {
            currentPrice: unitPrice,
            lastUpdated: poDate,
            priceHistory: [...(data.priceHistory || []), newHistoryEntry]
          });
        }
      } else {
        // Create new product
        await setDoc(docRef, {
          barcode,
          description: item.description || "",
          currentPrice: unitPrice,
          lastUpdated: poDate,
          priceHistory: [newHistoryEntry]
        });
      }
    } catch (err) {
      console.warn(`Failed to sync product ${barcode}:`, err);
    }
  };

  // Run all items in parallel rather than sequential loop for 10x faster execution
  await Promise.allSettled(items.map(syncItem));
}
