import { auth, db } from "./firebase.js";
import { collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// Google Sheets order-report endpoint (Apps Script Web App).
const GOOGLE_SHEETS_ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwFKIG-mikHTdm_CZwwgGWv-zLZAOiCDjac1E_oK3GtCBsHqmOg6kIjNZIKPqcrhh4lTQ/exec";

function syncOrderToGoogleSheet(order) {
    return fetch(GOOGLE_SHEETS_ORDER_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(order)
    }).catch(error => console.warn("Google Sheet sync failed:", error));
}

// ==========================================
// 1. AUTO-FILL SAVED ADDRESS KA LOGIC
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        const emailInput = document.getElementById("email");
        if (emailInput) {
            emailInput.value = user.email;
            emailInput.readOnly = true; 
        }

        const useSavedAddress = document.getElementById("useSavedAddress");
        
        if (useSavedAddress) {
            useSavedAddress.addEventListener("change", async function() {
                const name = document.getElementById("name");
                const phone = document.getElementById("phone");
                const address = document.getElementById("address");
                const city = document.getElementById("city");
                const pincode = document.getElementById("pincode");

                if (this.checked) {
                    try {
                        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
                        const savedUserInfo = profileSnapshot.exists() ? profileSnapshot.data() : null;
                        if (savedUserInfo) {
                            if (name) name.value = savedUserInfo.name || "";
                            if (phone) phone.value = savedUserInfo.phone || "";
                            if (address) address.value = savedUserInfo.address || "";
                            if (city) city.value = savedUserInfo.city || "";
                            if (pincode) pincode.value = savedUserInfo.pincode || "";
                        } else {
                            window.showToast?.("No saved address found in your profile.", "info");
                            this.checked = false;
                        }
                    } catch (error) {
                        console.error("Profile load failed:", error);
                        window.showToast?.("Saved address could not be loaded.", "error");
                        this.checked = false;
                    }
                } else {
                    if (name) name.value = "";
                    if (phone) phone.value = "";
                    if (address) address.value = "";
                    if (city) city.value = "";
                    if (pincode) pincode.value = "";
                }
            });
        }
    } else {
        window.showToast?.("Please log in to proceed to checkout.", "info");
        window.location.href = "login.html";
    }
});


// ==========================================
// 2. ORDER PLACE KARNE KA LOGIC (CUSTOM POPUP)
// ==========================================
const placeOrderBtn = document.getElementById("placeOrderBtn"); 
let isPlacingOrder = false;

const deliveryPhoneInput = document.getElementById("phone");
const deliveryPincodeInput = document.getElementById("pincode");

[deliveryPhoneInput, deliveryPincodeInput].forEach(input => {
    input?.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
        input.setCustomValidity("");
    });
});

if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", async function(e) {
        e.preventDefault(); 

        if (isPlacingOrder) return;

        const user = auth.currentUser;
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        if (cartItems.length === 0) {
            window.showToast?.("Your cart is empty. Please add some food first.", "info");
            window.location.href = "menu.html";
            return;
        }

        if (user) {
            const name = document.getElementById("name").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const address = document.getElementById("address").value.trim();
            const city = document.getElementById("city") ? document.getElementById("city").value.trim() : "";
            const pincode = document.getElementById("pincode") ? document.getElementById("pincode").value.trim() : "";
            
            const paymentElement = document.querySelector('input[name="payment"]:checked');
            const payment = paymentElement ? paymentElement.value : "Cash on Delivery";
            
            if (!name || !phone || !address || !city || !pincode) {
                window.showToast?.("Please fill all delivery details, including city and pincode.", "error");
                return;
            }

            if (!/^\d{10}$/.test(phone)) {
                deliveryPhoneInput.setCustomValidity("Please enter a valid 10-digit mobile number.");
                deliveryPhoneInput.reportValidity();
                deliveryPhoneInput.focus();
                window.showToast?.("Mobile number must contain exactly 10 digits.", "error");
                return;
            }

            if (!/^\d{6}$/.test(pincode)) {
                deliveryPincodeInput.setCustomValidity("Please enter a valid 6-digit pincode.");
                deliveryPincodeInput.reportValidity();
                deliveryPincodeInput.focus();
                window.showToast?.("Pincode must contain exactly 6 digits.", "error");
                return;
            }

            deliveryPhoneInput.setCustomValidity("");
            deliveryPincodeInput.setCustomValidity("");

            try {
                isPlacingOrder = true;
                placeOrderBtn.innerText = "Processing...";
                placeOrderBtn.disabled = true;

                let itemNames = cartItems.map(item => `${item.name} x${item.quantity}`).join(", ");
                let subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
                let finalTotal = subtotal + 40;
                let tempOrderId = "ORD-" + Math.floor(Math.random() * 1000000);

                let message = "🍔 *FOODHUB - NEW ORDER*\n";
                message += "══════════════════════\n\n";
                message += `🏷️ *Order ID:* ${tempOrderId}\n\n`;
                message += `👤 *CUSTOMER INFO*\n• *Name:* ${name}\n• *Phone:* ${phone}\n• *Address:* ${address}, ${city} - ${pincode}\n• *Payment:* ${payment}\n\n`;
                message += "🍽️ *ORDER ITEMS*\n";

                cartItems.forEach((item, index) => {
                    const itemTotal = Number(item.price) * Number(item.quantity);
                    message += `${index + 1}. *${item.name}* × ${item.quantity}  ➜  ₹${itemTotal}\n`;
                });

                message += `\n💵 *BILL SUMMARY*\n• Subtotal: ₹${subtotal}\n• Delivery Fee: ₹40\n• *Total Payable: ₹${finalTotal}*\n\n`;
                message += "✨ _Please confirm my order._";

                const whatsappNumber = "919065521532";
                const whatsappURL = "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message);

                // 1. WhatsApp Open Karein
                window.open(whatsappURL, "_blank");

                // 2. Custom Popup Dikhayein (No Browser Block)
                const popupOverlay = document.createElement("div");
                popupOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;";
                
                popupOverlay.innerHTML = `
                    <div style="background:#fff;padding:30px;border-radius:15px;width:90%;max-width:400px;text-align:center;box-shadow:0 15px 30px rgba(0,0,0,0.3);">
                        <div style="font-size:40px;color:#ff5722;margin-bottom:10px;"><i class="fa-brands fa-whatsapp"></i></div>
                        <h3 style="color:#222;font-size:22px;margin-bottom:15px;">WhatsApp Confirmation</h3>
                        <p style="color:#555;font-size:16px;margin-bottom:25px;line-height:1.5;">Kya aapne WhatsApp par apna order message send kar diya hai?</p>
                        <div style="display:flex;gap:15px;justify-content:center;">
                            <button id="cancelPopupBtn" style="flex:1;background:#f1f1f1;color:#333;border:none;padding:12px;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;transition:0.3s;">Nahi (Cancel)</button>
                            <button id="confirmPopupBtn" style="flex:1;background:#28a745;color:#fff;border:none;padding:12px;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;transition:0.3s;">Haan (Send)</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(popupOverlay);

                // 3. Agar User "Haan (Send)" dabaye -> FIREBASE MEIN SAVE
                document.getElementById("confirmPopupBtn").addEventListener("click", async () => {
                    document.body.removeChild(popupOverlay);
                    placeOrderBtn.innerText = "Saving Order...";
                    
                    try {
                        const orderReference = await addDoc(collection(db, "orders"), {
                            userEmail: user.email,
                            customerName: name,
                            customerPhone: phone,
                            deliveryAddress: `${address}, ${city} - ${pincode}`,
                            paymentMode: payment,
                            items: itemNames,
                            totalPrice: finalTotal,
                            date: new Date().toLocaleDateString(),
                            createdAt: new Date().toISOString(),
                            status: "Pending",
                            orderId: tempOrderId 
                        });

                        await syncOrderToGoogleSheet({
                            orderId: orderReference.id,
                            orderedAt: new Date().toISOString(),
                            customerName: name,
                            phone,
                            email: user.email,
                            address: `${address}, ${city} - ${pincode}`,
                            items: itemNames,
                            subtotal,
                            deliveryFee: 40,
                            total: finalTotal,
                            payment,
                            status: "Pending",
                            restaurant: "FoodHub"
                        });

                        localStorage.setItem("lastOrder", JSON.stringify({
                            id: orderReference.id,
                            total: finalTotal,
                            address: `${address}, ${city} - ${pincode}`,
                            payment,
                            itemCount: cartItems.reduce((count, item) => count + Number(item.quantity), 0)
                        }));

                        document.dispatchEvent(new Event("foodhub-clear-cart"));
                        window.location.href = "order-success.html"; 

                    } catch (err) {
                        console.error("Firebase Save Error:", err);
                        window.showToast?.("Error saving order. Try again.", "error");
                        isPlacingOrder = false;
                        placeOrderBtn.disabled = false;
                        placeOrderBtn.innerText = "Place Order";
                    }
                });

                // 4. Agar User "Nahi (Cancel)" dabaye -> KUCH SAVE NAHI HOGA
                document.getElementById("cancelPopupBtn").addEventListener("click", () => {
                    document.body.removeChild(popupOverlay);
                    isPlacingOrder = false;
                    placeOrderBtn.disabled = false;
                    placeOrderBtn.innerText = "Place Order";
                    window.showToast?.("Order cancelled. Aapka cart safe hai.", "info");
                });

            } catch (error) {
                console.error("Checkout Error: ", error);
                window.showToast?.("Something went wrong.", "error");
                isPlacingOrder = false;
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerText = "Place Order";
            }
        }
    });
}
