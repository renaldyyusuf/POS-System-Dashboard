import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSCQXldNIgwfOXNHsf9Xw-PmdBXtSRpTU",
  authDomain: "lumina-pos-app.firebaseapp.com",
  projectId: "lumina-pos-app",
  storageBucket: "lumina-pos-app.firebasestorage.app",
  messagingSenderId: "11065927253",
  appId: "1:11065927253:web:9274d002cdeffaf2de56dc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
