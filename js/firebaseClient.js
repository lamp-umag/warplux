import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQiq3vIUA_ZqpOCOcXmraQXIhwEz4JVLY",
  authDomain: "warplux-a839b.firebaseapp.com",
  projectId: "warplux-a839b",
  storageBucket: "warplux-a839b.firebasestorage.app",
  messagingSenderId: "164221122848",
  appId: "1:164221122848:web:f8c6cf3f2c5455cf60ff45"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };
