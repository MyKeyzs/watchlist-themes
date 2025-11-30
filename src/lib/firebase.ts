// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmkcYxJuN1D7Fq-LtdkzILcpCfQ6_1S0s",
  authDomain: "watchlist-themes.firebaseapp.com",
  projectId: "watchlist-themes",
  storageBucket: "watchlist-themes.firebasestorage.app",
  messagingSenderId: "759723575090",
  appId: "1:759723575090:web:670d9178d33b8eb300f92b",
  // measurementId is only needed for Analytics, you can leave it out:
  // measurementId: "G-5CJ10KRZJH",
};

const app = initializeApp(firebaseConfig);

// Export these for the rest of the app
export const auth = getAuth(app);
export const db = getFirestore(app);