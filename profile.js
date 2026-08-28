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
        <div style="display:flex; align-items:flex-start; gap:10px;">
            <i class="fa-solid fa-location-dot" style="color:#ff5722; margin-top:4px;"></i>
            <div>
                <h4 style="margin:0; font-size:16px;">${escapeHTML(userInfo.name || "Home")}</h4>
                <p style="margin:5px 0 0 0; color:#555; font-size:14px; line-height:1.5;">
                    ${escapeHTML(location)}<br>
                    ${userInfo.phone ? `<i class="fa-solid fa-phone" style="font-size:12px;"></i> +91 ${escapeHTML(userInfo.phone)}` : ""}
                </p>
            </div>
        </div>`;
}

function showProfileDetails(user, userInfo = null) {
    const name = userInfo?.name?.trim() || user.displayName || "Foodie";

    if (displayName) displayName.innerText = name;
    if (profileGreeting) profileGreeting.innerText = name.split(" ")[0]; // Sirf First Name
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
        if(profileGreeting) profileGreeting.innerText = (user.displayName || "Foodie").split(" ")[0];

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
            // UserId ke hisab se order search karega (Best Practice)
            const q = query(collection(db, "orders"), where("userId", "==", user.uid));
            
            getDocs(q).then((querySnapshot) => {
                orderList.innerHTML = ""; 
                
                if(querySnapshot.empty) {
                    orderList.innerHTML = `
                        <div class="empty-orders" style="text-align:center; padding: 40px 20px; background:#fff; border-radius:10px; border:1px solid #eee;">
                            <img src="https://cdn-icons-png.flaticon.com/512/1046/1046874.png" width="80" style="opacity:0.5; margin-bottom:15px;">
                            <h3 style="color:#333;">No orders yet</h3>
                            <p style="color:#777; margin-bottom:20px;">Your delicious orders will appear here after checkout.</p>
                            <a href="menu.html" style="text-decoration:none; padding:10px 20px; background:#ff5722; color:#fff; border-radius:5px;">Explore the menu</a>
                        </div>`;
                    return;
                }

                // Convert snapshot to array to sort by date
                const ordersArray = [];
                querySnapshot.forEach((doc) => {
                    ordersArray.push({ id: doc.id, ...doc.data() });
                });
                
                // Sort orders: Latest first
                ordersArray.sort((a, b) => (b.orderDate || 0) - (a.orderDate || 0));

                ordersArray.forEach((order) => {
                    const status = String(order.status || "Pending");
                    
                    // Dynamic styling based on status
                    let statusColor = status.toLowerCase() === "delivered" ? "#28a745" : (status.toLowerCase() === "confirmed" ? "#007bff" : "#ff9800");
                    let statusBg = status.toLowerCase() === "delivered" ? "#e6f4ea" : (status.toLowerCase() === "confirmed" ? "#e7f1ff" : "#fff3e0");

                    // Date formatting (Handle both Firestore Timestamp and String)
                    let dateStr = "Date unavailable";
                    if (order.orderDate && typeof order.orderDate.toDate === 'function') {
                        dateStr = order.orderDate.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
                    } else if (order.date) {
                        dateStr = order.date;
                    }

                    // Items formatting (Handle Array or String)
                    let itemsStr = "Order details unavailable";
                    if (Array.isArray(order.items)) {
                        itemsStr = order.items.map(i => `${i.name} (x${i.quantity || 1})`).join(", ");
                    } else if (order.items) {
                        itemsStr = order.items;
                    }
                    
                    const totalPrice = order.totalAmount || order.totalPrice || "0";

                    // Premium Order Card Design
                    orderList.innerHTML += `
                    <div class="order-card" style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #eaeaea; border-radius:10px; padding:20px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                        <div class="order-details-left">
                            <h4 style="margin:0 0 5px 0; color:#333; font-size:15px;">Order #${escapeHTML(order.id.slice(0,6).toUpperCase())}</h4>
                            <p style="margin:0 0 10px 0; color:#666; font-size:13px; max-width:250px;">${escapeHTML(itemsStr)}</p>
                            <small style="color:#999; font-size:12px;"><i class="fa-regular fa-clock"></i> ${escapeHTML(dateStr)}</small>
                        </div>
                        <div class="order-details-right" style="text-align:right;">
                            <h3 style="margin:0 0 8px 0; color:#ff5722; font-size:18px;">₹${escapeHTML(String(totalPrice))}</h3>
                            <span style="background:${statusBg}; color:${statusColor}; padding:5px 12px; border-radius:20px; font-size:12px; font-weight:600;">
                                ${escapeHTML(status)}
                            </span>
                        </div>
                    </div>`;
                });
            }).catch((error) => {
                console.error("Order load error: ", error);
                orderList.innerHTML = "<p class=\"orders-error\" style='color:red;'>Orders could not be loaded. Please refresh and try again.</p>";
            });
        }

        // ==========================================
        // 5. PROFILE UPDATE LOGIC
        // ==========================================
        const updateProfileForm = document.getElementById("updateProfileForm");

        localStorage.removeItem("userInfo_" + user.email);
        const profileRef = doc(db, "users", user.uid);
        getDoc(profileRef).then(snapshot => {
            showProfileDetails(user, snapshot.exists() ? snapshot.data() : null);
        }).catch(() => {
            showProfileDetails(user, null);
            if (typeof showToast === "function") showToast("Profile could not be loaded. You can still save your details.", "info");
        });

        // Final Data Save karne ka logic
        if (updateProfileForm) {
            const phoneInput = document.getElementById("editPhone");
            const pincodeInput = document.getElementById("editPincode");

            [phoneInput, pincodeInput].forEach(input => {
                input?.addEventListener("input", () => {
                    input.value = input.value.replace(/\D/g, "");
                    input.setCustomValidity("");
                });
            });

            updateProfileForm.addEventListener("submit", async function(e) {
                e.preventDefault(); 

                const name = document.getElementById("editName").value.trim();
                const address = document.getElementById("editAddress").value.trim();
                const city = document.getElementById("editCity").value.trim();
                const phone = phoneInput.value.trim();
                const pincode = pincodeInput.value.trim();

                if (!name || !phone || !address || !city || !pincode) {
                    if (typeof showToast === "function") showToast("Please fill all the fields.", "error");
                    else if (window.showToast) window.showToast("Please fill all the fields.", "error");
                    else alert("Please fill all the fields before updating your profile.");
                    return;
                }

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
                
                const userInfo = { name, phone, address, city, pincode };
                const button = document.getElementById("updateProfileBtn");
                if (button) button.disabled = true;

                try {
                    await setDoc(profileRef, { ...userInfo, email: user.email, updatedAt: serverTimestamp() }, { merge: true });
                    showProfileDetails(user, userInfo);
                    
                    if (typeof showToast === "function") showToast("Profile details saved successfully!", "success");
                    else if (window.showToast) window.showToast("Profile details saved successfully!", "success");
                } catch (error) {
                    console.error("Profile save failed:", error);
                    if (typeof showToast === "function") showToast("Profile could not be saved.", "error");
                    else if (window.showToast) window.showToast("Profile could not be saved.", "error");
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

        document.body.classList.remove("profile-loading");

    } else {
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
