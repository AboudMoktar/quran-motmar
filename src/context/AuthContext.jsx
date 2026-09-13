import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "../firebase"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [name, setName] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid))
        setUser(firebaseUser)
        setRole(snap.exists() ? snap.data().role : null)
        setName(snap.exists() ? snap.data().name : null)
      } else {
        setUser(null)
        setRole(null)
        setName(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, role, name, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
