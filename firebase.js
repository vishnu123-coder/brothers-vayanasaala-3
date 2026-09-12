import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Brothers Vayanasala Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHYNTYw95bSbnCng6L8pAAQxyDCH6uYXMeI",
  authDomain: "brothers-vayanasala-2.firebaseapp.com",
  projectId: "brothers-vayanasala-2",
  storageBucket: "brothers-vayanasala-2.firebasestorage.app",
  messagingSenderId: "95634722926",
  appId: "1:95634722926:web:2143abfb706779914d67f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Cloud Firestore database
const db = getFirestore(app);

export { app, db };
