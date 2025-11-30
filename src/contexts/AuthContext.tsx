// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Create / update the Firestore user profile document */
async function saveUserProfile(uid: string, email: string | null) {
  // merge:true so we DON’T blow away subcollections like users/{uid}/holdings
  await setDoc(
    doc(db, "users", uid),
    {
      email: email ?? "",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Ensure users/{uid} doc exists in Firestore
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(userRef);

          if (!snap.exists()) {
            // First time we’ve seen this user → create their profile doc
            await saveUserProfile(firebaseUser.uid, firebaseUser.email);
          }
        } catch (err) {
          console.error("Failed to ensure user profile doc", err);
        }
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will run afterward and ensure the Firestore doc
  }

  async function register(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // create/merge the Firestore user doc immediately on sign-up
    await saveUserProfile(cred.user.uid, cred.user.email);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
