// 1. CLEAN IMPORTS (Sirf ek baar)
import { auth, db } from "./firebase.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
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
            window.showToast?.("Please enter a valid email address.", "error");
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
            window.showToast?.("Passwords do not match.", "error");
            return;
        }

        try {
            document.getElementById("createAccountBtn").innerText = "Creating Account...";
            
            // Auth mein account banayein
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // NAYA: Signup hote hi Firestore Database mein ek blank document auto-create karein
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                name: "",
                phone: "",
                address: "",
                city: "",
                pincode: "",
                createdAt: serverTimestamp()
            });

            // Verification Email
            await sendEmailVerification(user);

            window.showToast?.("Account created! Please verify the link sent to your email.", "success");
            window.location.href = "login.html";

        } catch (error) {
            console.error("Firebase Signup Error:", error);
            window.showToast?.("Signup failed: " + error.message, "error");
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
                window.showToast?.("Please verify your email before logging in. Check inbox or spam.", "info");
                return; 
            }

            window.showToast?.("Login successful! Welcome to FoodHub.", "success");
            window.location.href = "index.html"; 

        } catch (error) {
            console.error("Firebase Login Error:", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                window.showToast?.("Login failed. Incorrect email or password.", "error");
            } else {
                window.showToast?.("Login failed: " + error.message, "error");
            }
        }
    });
}

// ==========================================
// 3. FORGOT PASSWORD SYSTEM
// ==========================================
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", async function (e) {
        e.preventDefault();

        // Login email input se email uthayenge
        const emailInput = document.getElementById("loginEmail");
        const email = emailInput ? emailInput.value.trim() : "";

        // Agar user ne email nahi daala hai toh error dikhayein
        if (!email || !email.includes("@")) {
            window.showToast?.("Please enter your registered email address above first.", "info");
            emailInput?.focus();
            return;
        }

        try {
            forgotPasswordBtn.innerText = "Sending...";
            
            await sendPasswordResetEmail(auth, email);
            
            window.showToast?.("Password reset link sent! Please check your email inbox/spam.", "success");
            forgotPasswordBtn.innerText = "Forgot Password?";
            
        } catch (error) {
            console.error("Reset Password Error:", error);
            forgotPasswordBtn.innerText = "Forgot Password?";
            
            if (error.code === 'auth/user-not-found') {
                window.showToast?.("No account found with this email address.", "error");
            } else {
                window.showToast?.("Error: " + error.message, "error");
            }
        }
    });
}
