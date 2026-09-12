import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCHYNTYw95bSbnCng6L8pAAQxyDCH6uYXMeI",
  authDomain: "brothers-vayanasala-2.firebaseapp.com",
  projectId: "brothers-vayanasala-2",
  storageBucket: "brothers-vayanasala-2.firebasestorage.app",
  messagingSenderId: "95634722926",
  appId: "1:95634722926:web:2143abfb706779914d67f"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);

export { app, auth, db };
