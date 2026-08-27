import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const displayImage = document.getElementById("displayImage");
const displayName = document.getElementById("displayName");
const displayEmail = document.getElementById("displayEmail");
const profileGreeting = document.getElementById("profileGreeting");
const uploadPic = document.getElementById("upload-pic");
const removePhotoBtn = document.getElementById("removePhotoBtn");
const navProfileImg = document.querySelector(".nav-profile-icon img");
const orderList = document.querySelector(".order-list");
const savedAddressSummary = document.getElementById("savedAddressSummary");
const editAddressBtn = document.getElementById("editAddressBtn");
const defaultProfileImage = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

function escapeHTML(value) {
    return String(value || "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    }[character]));
}

function renderSavedAddress(userInfo) {
    if (!savedAddressSummary) return;

    if (!userInfo || !userInfo.address) {
        savedAddressSummary.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <p>Add your delivery address above to make checkout faster.</p>`;
        return;
    }

    const location = [userInfo.address, userInfo.city, userInfo.pincode].filter(Boolean).join(", ");
    savedAddressSummary.innerHTML = `
        <i class="fa-solid fa-location-dot"></i>
        <div>
            <strong>${escapeHTML(userInfo.name || "Saved delivery address")}</strong>
            <p>${escapeHTML(location)}</p>
            ${userInfo.phone ? `<small><i class="fa-solid fa-phone"></i> ${escapeHTML(userInfo.phone)}</small>` : ""}
        </div>`;
}

function showProfileDetails(user, userInfo = null) {
    const name = userInfo?.name?.trim() || user.displayName || "Foodie";

    if (displayName) displayName.innerText = name;
    if (profileGreeting) profileGreeting.innerText = name;
    if (document.getElementById("editName")) document.getElementById("editName").value = userInfo?.name || "";
    if (document.getElementById("editPhone")) document.getElementById("editPhone").value = userInfo?.phone || "";
    if (document.getElementById("editAddress")) document.getElementById("editAddress").value = userInfo?.address || "";
    if (document.getElementById("editCity")) document.getElementById("editCity").value = userInfo?.city || "";
    if (document.getElementById("editPincode")) document.getElementById("editPincode").value = userInfo?.pincode || "";
    renderSavedAddress(userInfo);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        // 1. User ki basic details set karein
        if(displayName) displayName.innerText = user.displayName || "Foodie";
        if(displayEmail) displayEmail.innerText = user.email;
        if(profileGreeting) profileGreeting.innerText = user.displayName || "Foodie";

        // 2. User ki apni photo load karein
        const savedPic = localStorage.getItem("userProfilePic_" + user.email);
        if (savedPic) {
            if (displayImage) displayImage.src = savedPic;
            if (navProfileImg) navProfileImg.src = savedPic;
        } else {
            if (displayImage) displayImage.src = defaultProfileImage;
        }

        // 3. Nayi Photo sirf is user ke liye save karein
        if (uploadPic) {
            uploadPic.onchange = function () {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const base64Image = e.target.result;
                        if (displayImage) displayImage.src = base64Image;
                        if (navProfileImg) navProfileImg.src = base64Image;
                        
                        localStorage.setItem("userProfilePic_" + user.email, base64Image); 
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        if (removePhotoBtn) {
            removePhotoBtn.addEventListener("click", () => {
                if (!confirm("Remove your profile photo?")) return;

                localStorage.removeItem("userProfilePic_" + user.email);
                if (uploadPic) uploadPic.value = "";
                if (displayImage) displayImage.src = defaultProfileImage;
                if (navProfileImg) navProfileImg.src = defaultProfileImage;
            });
        }

        // 4. Sirf IS USER ke Previous Orders Firebase se layein
        if(orderList) {
            const q = query(collection(db, "orders"), where("userEmail", "==", user.email));
            
            getDocs(q).then((querySnapshot) => {
                orderList.innerHTML = ""; 
                
                if(querySnapshot.empty) {
                    orderList.innerHTML = `
                        <div class="empty-orders">
                            <i class="fa-solid fa-bowl-food"></i>
                            <h3>No orders yet</h3>
                            <p>Your delicious orders will appear here after checkout.</p>
                            <a href="menu.html">Explore the menu</a>
                        </div>`;
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const order = doc.data();
                    const status = String(order.status || "Confirmed");
                    const statusClass = status.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "confirmed";
                    orderList.innerHTML += `
                    <div class="order-card">
                        <div class="order-details">
                            <span class="order-number">Order #${doc.id.slice(0,6).toUpperCase()}</span>
                            <p>${escapeHTML(order.items || "Order details unavailable")}</p>
                            <span class="order-date"><i class="fa-regular fa-calendar"></i> ${escapeHTML(order.date || "Date unavailable")}</span>
                        </div>
                        <div class="order-price">
                            <h4>₹${escapeHTML(order.totalPrice)}</h4>
                            <span class="status ${statusClass}">${escapeHTML(status)}</span>
                        </div>
                    </div>`;
                });
            }).catch(() => {
                orderList.innerHTML = "<p class=\"orders-error\">Orders could not be loaded. Please refresh and try again.</p>";
            });
        }

        // ==========================================
        // 5. PROFILE UPDATE LOGIC (BINA OTP KE)
        // ==========================================
        const updateProfileForm = document.getElementById("updateProfileForm");

        // Each Firebase user has their own profile document. Old browser-local
        // demo values are deliberately ignored so new profiles start blank.
        localStorage.removeItem("userInfo_" + user.email);
        const profileRef = doc(db, "users", user.uid);
        getDoc(profileRef).then(snapshot => {
            showProfileDetails(user, snapshot.exists() ? snapshot.data() : null);
        }).catch(() => {
            showProfileDetails(user, null);
            window.showToast?.("Profile could not be loaded. You can still save your details.", "info");
        });

        // Final Data Save karne ka logic (Direct Update button dabane par)
        if (updateProfileForm) {
            const phoneInput = document.getElementById("editPhone");
            const pincodeInput = document.getElementById("editPincode");

            // Keep both fields numeric while typing or pasting.
            [phoneInput, pincodeInput].forEach(input => {
                input?.addEventListener("input", () => {
                    input.value = input.value.replace(/\D/g, "");
                    input.setCustomValidity("");
                });
            });

            updateProfileForm.addEventListener("submit", async function(e) {
                e.preventDefault(); // Form ko page refresh karne se rokna

                const phone = phoneInput.value.trim();
                const pincode = pincodeInput.value.trim();

                if (!/^\d{10}$/.test(phone)) {
                    phoneInput.setCustomValidity("Please enter a valid 10-digit mobile number.");
                    phoneInput.reportValidity();
                    phoneInput.focus();
                    return;
                }

                if (!/^\d{6}$/.test(pincode)) {
                    pincodeInput.setCustomValidity("Please enter a valid 6-digit pincode.");
                    pincodeInput.reportValidity();
                    pincodeInput.focus();
                    return;
                }

                phoneInput.setCustomValidity("");
                pincodeInput.setCustomValidity("");
                
                const userInfo = {
                    name: document.getElementById("editName").value.trim(),
                    phone,
                    address: document.getElementById("editAddress").value.trim(),
                    city: document.getElementById("editCity").value.trim(),
                    pincode
                };

                const button = document.getElementById("updateProfileBtn");
                if (button) button.disabled = true;
                try {
                    await setDoc(profileRef, { ...userInfo, email: user.email, updatedAt: serverTimestamp() }, { merge: true });
                    showProfileDetails(user, userInfo);
                    showToast("Profile details saved successfully!", "success");
                } catch (error) {
                    console.error("Profile save failed:", error);
                    showToast("Profile could not be saved. Please try again.", "error");
                } finally {
                    if (button) button.disabled = false;
                }
            });
        }

        if (editAddressBtn) {
            editAddressBtn.addEventListener("click", () => {
                document.getElementById("editAddress")?.focus();
            });
        }

        // User profile data is ready; keep the order skeleton until Firestore responds.
        document.body.classList.remove("profile-loading");

    } else {
        // Agar login nahi hai toh login page par bhejo
        window.location.href = "login.html";
    }
});

// Logout ka button
const logoutBtn = document.getElementById("logoutBtn");
if(logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        if (!confirm("Are you sure you want to log out?")) return;
        signOut(auth).then(() => {
            window.location.href = "login.html";
        });
    });
}
