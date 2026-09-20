import { addDoc, collection } from "firebase/firestore"
import { db, auth } from "../firebase"

export async function logActivity(action, details) {
  try {
    await addDoc(collection(db, "activity_logs"), {
      action,
      details: details || "",
      userId: auth.currentUser?.uid || "",
      timestamp: Date.now(),
    })
  } catch {
    // ne jamais bloquer l'action principale si le journal échoue
  }
}
