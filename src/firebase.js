import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDFBgSUsH1zX9dRJNiDcBgQm8g3-Em3D1c",
  authDomain: "jcr-flooring.firebaseapp.com",
  projectId: "jcr-flooring",
  storageBucket: "jcr-flooring.firebasestorage.app",
  messagingSenderId: "674973259143",
  appId: "1:674973259143:web:4749ea6d8499ed9dd02f22"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
