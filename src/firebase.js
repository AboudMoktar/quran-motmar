import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCUou8SgBMCY-EE5_BES2PfsZo09Y-XEqo",
  authDomain: "quran-motmar-7e99c.firebaseapp.com",
  projectId: "quran-motmar-7e99c",
  storageBucket: "quran-motmar-7e99c.firebasestorage.app",
  messagingSenderId: "1089832085812",
  appId: "1:1089832085812:web:78a3ca0949c8467aebdd61"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

const secondaryApp = getApps().find((a) => a.name === "Secondary")
  || initializeApp(firebaseConfig, "Secondary")
export const secondaryAuth = getAuth(secondaryApp)

export const LOGIN_DOMAIN = "quran-motmar.local"
