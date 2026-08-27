// Sabse upar saare imports honge
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// Beech mein aapki config hogi

const firebaseConfig = {
    // ... aapki API keys wagerah ...
    apiKey: "AIzaSyBN4o_xEuTEIDqALYWQNRDB5Bj2CoyK4eY",
    authDomain: "foodhub-6a986.firebaseapp.com",
    projectId: "foodhub-6a986",
    storageBucket: "foodhub-6a986.firebasestorage.app",
    messagingSenderId: "330220531332",
    appId: "1:330220531332:web:ee932499601bd602f61cd1",
    measurementId: "G-J8JXSW5P3S"
};

// Sabse last mein variables export honge
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export { app, auth };
export const db = getFirestore(app);