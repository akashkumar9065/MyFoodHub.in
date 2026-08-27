import { auth } from "./firebase.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// ==========================================
// 1. SIGNUP SYSTEM (Multi-Step & Email Link)
// ==========================================
const signupForm = document.getElementById("signupForm");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const nextToStep2Btn = document.getElementById("nextToStep2");
const backToStep1Btn = document.getElementById("backToStep1");

if (signupForm) {
    
    // NEXT BUTTON LOGIC
    nextToStep2Btn.addEventListener("click", () => {
        const email = document.getElementById("signupEmail").value.trim();
        if (email === "" || !email.includes("@")) {
            showToast("Please enter a valid email address.", "error");
            return;
        }
        step1.style.display = "none";
        step2.style.display = "block";
    });

    // BACK BUTTON LOGIC
    backToStep1Btn.addEventListener("click", () => {
        step2.style.display = "none";
        step1.style.display = "block";
    });

    // FINAL SUBMIT (Create Account)
    signupForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            showToast("Passwords do not match.", "error");
            return;
        }

        try {
            document.getElementById("createAccountBtn").innerText = "Creating Account...";
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);

            showToast("Account created! Please verify the link sent to your email.", "success");
            window.location.href = "login.html";

        } catch (error) {
            console.error("Firebase Signup Error:", error);
            showToast("Signup failed: " + error.message, "error");
            document.getElementById("createAccountBtn").innerText = "Create Account";
        }
    });
}

// ==========================================
// 2. STRICT LOGIN SYSTEM (Verification Required)
// ==========================================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault(); 

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // MAIN SECURITY CHECK
            if (!userCredential.user.emailVerified) {
                await signOut(auth); 
                showToast("Please verify your email before logging in. Check inbox or spam.", "info");
                return; 
            }

            showToast("Login successful! Welcome to FoodHub.", "success");
            window.location.href = "index.html"; 

        } catch (error) {
            console.error("Firebase Login Error:", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                showToast("Login failed. Incorrect email or password.", "error");
            } else {
                showToast("Login failed: " + error.message, "error");
            }
        }
    });
}
