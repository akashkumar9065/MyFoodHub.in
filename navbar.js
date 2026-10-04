import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const removePending = () => {
    const navbar = document.getElementById("navbar");
    if (navbar && navbar.classList.contains("auth-pending")) {
        navbar.classList.remove("auth-pending");
        navbar.removeAttribute("aria-busy");
    }
};

// Fallback timeout: If Firebase auth restoration takes long or runs offline, ensure Login/Signup buttons display.
setTimeout(removePending, 800);

onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById("nav-login");
    const signupBtn = document.getElementById("nav-signup");
    const profileBtn = document.getElementById("nav-profile");
    const navProfileImg = document.querySelector("#nav-profile img");

    if (user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (signupBtn) signupBtn.style.display = "none";
        if (profileBtn) profileBtn.style.display = "inline-block";

        const savedPic = localStorage.getItem("userProfilePic_" + user.email);
        if (savedPic && navProfileImg) {
            navProfileImg.src = savedPic;
        } else if (navProfileImg) {
            navProfileImg.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
        }
    } else {
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (signupBtn) signupBtn.style.display = "inline-block";
        if (profileBtn) profileBtn.style.display = "none";
    }

    removePending();
});
