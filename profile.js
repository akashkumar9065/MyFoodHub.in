import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

const ADMIN_EMAIL = "akashkumar906552@gmail.com";
let cancelTimers = {}; // Timer track karne ke liye

function escapeHTML(value) {
    return String(value || "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
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
    if (profileGreeting) profileGreeting.innerText = name.split(" ")[0]; 
    if (document.getElementById("editName")) document.getElementById("editName").value = userInfo?.name || "";
    if (document.getElementById("editPhone")) document.getElementById("editPhone").value = userInfo?.phone || "";
    if (document.getElementById("editAddress")) document.getElementById("editAddress").value = userInfo?.address || "";
    if (document.getElementById("editCity")) document.getElementById("editCity").value = userInfo?.city || "";
    if (document.getElementById("editPincode")) document.getElementById("editPincode").value = userInfo?.pincode || "";
    renderSavedAddress(userInfo);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        if(displayName) displayName.innerText = user.displayName || "Foodie";
        if(displayEmail) displayEmail.innerText = user.email;
        if(profileGreeting) profileGreeting.innerText = (user.displayName || "Foodie").split(" ")[0];

        // Admin Panel Button Injection (Agar user admin hai toh profile menu mein button dikhega)
        if (user.email === ADMIN_EMAIL) {
            const profileSidebar = document.querySelector(".cart-section") || document.querySelector("aside") || document.querySelector(".nav-links");
            if (profileSidebar && !document.getElementById("adminPanelQuickBtn")) {
                const adminBtnHTML = `
                    <a id="adminPanelQuickBtn" href="admin.html" style="background: #ff5722; color: white; padding: 10px 15px; border-radius: 8px; display: block; margin: 15px 0; text-align: center; font-weight: bold; text-decoration: none;">
                        <i class="fa-solid fa-gauge"></i> Admin Panel
                    </a>
                `;
                profileSidebar.insertAdjacentHTML("beforeend", adminBtnHTML);
            }
        }

        // Profile Photo Logic
        const savedPic = localStorage.getItem("userProfilePic_" + user.email);
        if (savedPic) {
            if (displayImage) displayImage.src = savedPic;
            if (navProfileImg) navProfileImg.src = savedPic;
        } else {
            if (displayImage) displayImage.src = defaultProfileImage;
        }

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

        // LIVE ORDERS FETCHING (onSnapshot)
        if(orderList) {
            const q = query(collection(db, "orders"), where("userId", "==", user.uid));
            
            onSnapshot(q, (querySnapshot) => {
                // Puraane timers clear karo
                Object.values(cancelTimers).forEach(clearInterval);
                cancelTimers = {};
                
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

                const ordersArray = [];
                querySnapshot.forEach((doc) => {
                    ordersArray.push({ id: doc.id, ...doc.data() });
                });
                
                ordersArray.sort((a, b) => (b.orderTime?.seconds || 0) - (a.orderTime?.seconds || 0));

                ordersArray.forEach((order) => {
                    const status = String(order.status || "Pending");
                    let statusColor = status.toLowerCase() === "delivered" ? "#28a745" : (status.toLowerCase() === "confirmed" ? "#007bff" : status.toLowerCase() === "cancelled" ? "#dc3545" : "#ff9800");
                    let statusBg = status.toLowerCase() === "delivered" ? "#e6f4ea" : (status.toLowerCase() === "confirmed" ? "#e7f1ff" : status.toLowerCase() === "cancelled" ? "#ffebe8" : "#fff3e0");

                    let dateStr = "Date unavailable";
                    if (order.orderTime && order.orderTime.seconds) {
                        dateStr = new Date(order.orderTime.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
                    } else if (order.date) {
                        dateStr = order.date;
                    }

                    let itemsStr = "Order details unavailable";
                    if (Array.isArray(order.items)) {
                        itemsStr = order.items.map(i => `${i.name} (x${i.quantity || 1})`).join(", ");
                    } else if (order.items) {
                        itemsStr = order.items;
                    }
                    
                    const totalPrice = order.totalAmount || order.totalPrice || "0";

                    orderList.innerHTML += `
                    <div class="order-card" style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #eaeaea; border-radius:10px; padding:20px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                        <div class="order-details-left">
                            <h4 style="margin:0 0 5px 0; color:#333; font-size:15px;">Order #${escapeHTML(order.id.slice(0,6).toUpperCase())}</h4>
                            <p style="margin:0 0 10px 0; color:#666; font-size:13px; max-width:250px;">${escapeHTML(itemsStr)}</p>
                            <small style="color:#999; font-size:12px;"><i class="fa-regular fa-clock"></i> ${escapeHTML(dateStr)}</small>
                        </div>
                        <div class="order-details-right" style="text-align:right;">
                            <h3 style="margin:0 0 8px 0; color:#ff5722; font-size:18px;">₹${escapeHTML(String(totalPrice))}</h3>
                            <span style="background:${statusBg}; color:${statusColor}; padding:5px 12px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block;">
                                ${escapeHTML(status)}
                            </span>
                            <div id="actions-${order.id}" style="margin-top: 12px;"></div>
                        </div>
                    </div>`;
                });

                // Render hone ke baad Timers start karo
                ordersArray.forEach((order) => {
                    const status = String(order.status || "Pending");
                    if (status.toLowerCase() === "pending" && order.orderTime) {
                        startCancelTimer(order.orderTime.seconds, order.id);
                    }
                });

            }, (error) => {
                console.error("Order load error: ", error);
                orderList.innerHTML = "<p class=\"orders-error\" style='color:red;'>Orders could not be loaded.</p>";
            });
        }

        // PROFILE UPDATE LOGIC
        const updateProfileForm = document.getElementById("updateProfileForm");
        const profileRef = doc(db, "users", user.uid);
        
        getDoc(profileRef).then(snapshot => {
            showProfileDetails(user, snapshot.exists() ? snapshot.data() : null);
        }).catch(() => {
            showProfileDetails(user, null);
        });

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

                if (!/^\d{10}$/.test(phone)) return phoneInput.reportValidity();
                if (!/^\d{6}$/.test(pincode)) return pincodeInput.reportValidity();
                
                const userInfo = { name, phone, address, city, pincode };
                const button = document.getElementById("updateProfileBtn");
                if (button) button.disabled = true;

                try {
                    await setDoc(profileRef, { ...userInfo, email: user.email, updatedAt: serverTimestamp() }, { merge: true });
                    showProfileDetails(user, userInfo);
                    if (window.showToast) window.showToast("Profile details saved successfully!", "success");
                } catch (error) {
                    console.error("Profile save failed:", error);
                } finally {
                    if (button) button.disabled = false;
                }
            });
        }

        if (editAddressBtn) {
            editAddressBtn.addEventListener("click", () => document.getElementById("editAddress")?.focus());
        }
        document.body.classList.remove("profile-loading");

    } else {
        window.location.href = "login.html";
    }
});

// CANCEL TIMER LOGIC
function startCancelTimer(orderTimeSeconds, docId) {
    const actionsContainer = document.getElementById(`actions-${docId}`);
    if(!actionsContainer) return;

    const updateTimer = () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const elapsed = nowSeconds - orderTimeSeconds;
        const remaining = 120 - elapsed; 

        if (remaining > 0) {
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            actionsContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                    <small style="color: #dc3545; font-weight: bold;"><i class="fa-regular fa-clock"></i> Cancel in: ${minutes}m ${seconds}s</small>
                    <button onclick="cancelOrder('${docId}')" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">
                        Cancel Order
                    </button>
                </div>
            `;
        } else {
            actionsContainer.innerHTML = `<small style="color: #28a745;"><i class="fa-solid fa-fire-burner"></i> Preparing</small>`; 
            clearInterval(cancelTimers[docId]);
        }
    };

    updateTimer(); 
    cancelTimers[docId] = setInterval(updateTimer, 1000);
}

// GLOBAL CANCEL FUNCTION
window.cancelOrder = async function(docId) {
    if (confirm("Are you sure you want to cancel this order?")) {
        try {
            await updateDoc(doc(db, "orders", docId), { status: "Cancelled" });
            if(window.showToast) window.showToast("Order cancelled successfully.", "info");
        } catch (error) {
            console.error("Cancel failed:", error);
            alert("Failed to cancel order. Time might have expired.");
        }
    }
};

const logoutBtn = document.getElementById("logoutBtn");
if(logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        if (!confirm("Are you sure you want to log out?")) return;
        signOut(auth).then(() => {
            window.location.href = "login.html";
        });
    });
}
