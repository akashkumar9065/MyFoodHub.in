import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    const navbar = document.getElementById("navbar");
    const loginBtn = document.getElementById("nav-login");
    const signupBtn = document.getElementById("nav-signup");
    const profileBtn = document.getElementById("nav-profile");
    const navProfileImg = document.querySelector("#nav-profile img");

    if (user) {
        if(loginBtn) loginBtn.style.display = "none";
        if(signupBtn) signupBtn.style.display = "none";
        if(profileBtn) profileBtn.style.display = "inline-block";

        // HAR USER KI ALAG IMAGE (Email ke hisaab se)
        const savedPic = localStorage.getItem("userProfilePic_" + user.email);
        if (savedPic && navProfileImg) {
            navProfileImg.src = savedPic;
        } else if (navProfileImg) {
            // Agar nai photo nahi hai, toh default dikhao
            navProfileImg.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"; 
        }
        
    } else {
        if(loginBtn) loginBtn.style.display = "inline-block";
        if(signupBtn) signupBtn.style.display = "inline-block";
        if(profileBtn) profileBtn.style.display = "none";
    }

    // Show auth navigation only after Firebase has restored the login state.
    if (navbar) {
        navbar.classList.remove("auth-pending");
        navbar.removeAttribute("aria-busy");
    }
});
