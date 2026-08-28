// 1. CLEAN IMPORTS (Sirf ek baar)
import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"; 
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    GoogleAuthProvider,
    FacebookAuthProvider,   // NAYA IMPORT: Facebook ke liye
    signInWithPopup
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
    nextToStep2Btn.addEventListener("click", () => {
        const email = document.getElementById("signupEmail").value.trim();
        if (email === "" || !email.includes("@")) {
            window.showToast?.("Please enter a valid email address.", "error");
            return;
        }
        step1.style.display = "none";
        step2.style.display = "block";
    });

    backToStep1Btn.addEventListener("click", () => {
        step2.style.display = "none";
        step1.style.display = "block";
    });

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
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                name: "",
                phone: "",
                address: "",
                city: "",
                pincode: "",
                createdAt: serverTimestamp()
            });

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

        const emailInput = document.getElementById("loginEmail");
        const email = emailInput ? emailInput.value.trim() : "";

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

// ==========================================
// 4. GOOGLE LOGIN SYSTEM
// ==========================================
const googleLoginBtn = document.getElementById("googleLoginBtn");

if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        const provider = new GoogleAuthProvider();
        
        try {
            googleLoginBtn.innerText = "Connecting...";
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            const profileRef = doc(db, "users", user.uid);
            const profileSnap = await getDoc(profileRef);
            
            if (!profileSnap.exists()) {
                await setDoc(profileRef, {
                    email: user.email,
                    name: user.displayName || "",
                    phone: "",
                    address: "",
                    city: "",
                    pincode: "",
                    createdAt: serverTimestamp()
                });
            }

            window.showToast?.("Google Login successful!", "success");
            window.location.href = "index.html"; 
            
        } catch (error) {
            console.error("Google Login Error:", error);
            googleLoginBtn.innerHTML = '<i class="fab fa-google"></i> Login with Google';
            if (error.code === 'auth/popup-closed-by-user') {
                window.showToast?.("Login cancelled.", "info");
            } else {
                window.showToast?.("Google Login failed: " + error.message, "error");
            }
        }
    });
}

// ==========================================
// 5. FACEBOOK LOGIN SYSTEM
// ==========================================
const facebookLoginBtn = document.getElementById("facebookLoginBtn");

if (facebookLoginBtn) {
    facebookLoginBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        const provider = new FacebookAuthProvider();
        
        try {
            facebookLoginBtn.innerText = "Connecting...";
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            const profileRef = doc(db, "users", user.uid);
            const profileSnap = await getDoc(profileRef);
            
            if (!profileSnap.exists()) {
                await setDoc(profileRef, {
                    email: user.email || "", // Facebook sometimes hides email
                    name: user.displayName || "",
                    phone: "",
                    address: "",
                    city: "",
                    pincode: "",
                    createdAt: serverTimestamp()
                });
            }

            window.showToast?.("Facebook Login successful!", "success");
            window.location.href = "index.html"; 
            
        } catch (error) {
            console.error("Facebook Login Error:", error);
            facebookLoginBtn.innerHTML = '<i class="fab fa-facebook-f"></i> Login with Facebook';
            
            if (error.code === 'auth/popup-closed-by-user') {
                window.showToast?.("Login cancelled.", "info");
            } else if (error.code === 'auth/account-exists-with-different-credential') {
                 window.showToast?.("An account already exists with the same email but different login method.", "error");
            } else {
                window.showToast?.("Facebook Login failed: " + error.message, "error");
            }
        }
    });
}
