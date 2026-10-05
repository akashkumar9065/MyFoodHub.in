import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const ADMIN_EMAIL = "akashkumar906552@gmail.com";

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
    let profileBtn = document.getElementById("nav-profile");
    let adminBtn = document.getElementById("nav-admin-panel");
    const navLinks = document.querySelector(".nav-links");

    if (user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (signupBtn) signupBtn.style.display = "none";

        // If profile item not in DOM, create it
        if (!profileBtn && navLinks) {
            const profileLi = document.createElement("li");
            profileLi.id = "nav-profile";
            profileLi.className = "auth-nav-item";
            profileLi.innerHTML = `
                <a href="profile.html" class="nav-profile-icon" title="My Profile">
                    <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Profile" class="navProfileImg">
                </a>
            `;
            navLinks.appendChild(profileLi);
            profileBtn = profileLi;
        }

        if (profileBtn) {
            profileBtn.style.display = "inline-flex";
            const navProfileImg = profileBtn.querySelector("img");
            const savedPic = localStorage.getItem("userProfilePic_" + user.email);
            if (savedPic && navProfileImg) {
                navProfileImg.src = savedPic;
            } else if (navProfileImg) {
                navProfileImg.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            }
        }

        // Show Admin Panel button if user is Admin
        if (user.email === ADMIN_EMAIL) {
            if (!adminBtn && navLinks) {
                const adminLi = document.createElement("li");
                adminLi.id = "nav-admin-panel";
                adminLi.className = "auth-nav-item";
                adminLi.innerHTML = `
                    <a href="admin.html" class="nav-admin-btn">
                        <i class="fa-solid fa-gauge"></i> Admin Panel
                    </a>
                `;
                navLinks.appendChild(adminLi);
                adminBtn = adminLi;
            }
            if (adminBtn) adminBtn.style.display = "inline-flex";
        } else {
            if (adminBtn) adminBtn.style.display = "none";
        }
    } else {
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (signupBtn) signupBtn.style.display = "inline-block";
        if (profileBtn) profileBtn.style.display = "none";
        if (adminBtn) adminBtn.style.display = "none";
    }

    removePending();
});
