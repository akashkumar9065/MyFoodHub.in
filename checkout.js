import { auth, db } from "./firebase.js";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// Google Sheets order-report endpoint
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
// 2. ORDER PLACE KARNE KA LOGIC (CASHFREE INTEGRATED)
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
            
            // Payment method check
            const paymentElement = document.querySelector('input[name="paymentMethod"]:checked') || document.querySelector('input[name="payment"]:checked');
            const payment = paymentElement ? paymentElement.value : "COD";
            
            if (!name || !phone || !address || !city || !pincode) {
                window.showToast?.("Please fill all delivery details, including city and pincode.", "error");
                return;
            }

            if (!/^\d{10}$/.test(phone)) {
                deliveryPhoneInput.setCustomValidity("Please enter a valid 10-digit mobile number.");
                deliveryPhoneInput.reportValidity();
                window.showToast?.("Mobile number must contain exactly 10 digits.", "error");
                return;
            }

            if (!/^\d{6}$/.test(pincode)) {
                deliveryPincodeInput.setCustomValidity("Please enter a valid 6-digit pincode.");
                deliveryPincodeInput.reportValidity();
                window.showToast?.("Pincode must contain exactly 6 digits.", "error");
                return;
            }

            let itemNames = cartItems.map(item => `${item.name} x${item.quantity}`).join(", ");
            let subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
            
            // ==========================================
            // PROFESSIONAL DYNAMIC DELIVERY FEE LOGIC
            // ==========================================
            let deliveryFee = 0;
            if (subtotal >= 100) {
                deliveryFee = Math.round(subtotal * 0.10); // 10% of subtotal
                if (deliveryFee < 15) {
                    deliveryFee = 15; // Minimum ₹15
                } else if (deliveryFee > 50) {
                    deliveryFee = 50; // Maximum ₹50
                }
            } else {
                deliveryFee = 0; // Free delivery if under ₹100
            }

            let finalTotal = subtotal + deliveryFee;
            let tempOrderId = "ORD-" + Math.floor(Math.random() * 1000000);

            if (payment === "COD" || payment === "Cash on Delivery") {
                // Direct Save for COD
                await processFinalOrder(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, tempOrderId, "Cash on Delivery", "Pending");
            } else {
                // Trigger Cashfree for Online Payment
                triggerCashfreePayment(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, tempOrderId, payment);
            }
        }
    });
}

// ==========================================
// 3. CASHFREE LIVE PAYMENT TRIGGER
// ==========================================
async function triggerCashfreePayment(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, orderId, method) {
    try {
        isPlacingOrder = true;
        placeOrderBtn.innerText = "Initializing Cashfree...";
        placeOrderBtn.disabled = true;

        const cashfree = Cashfree({
            mode: "production" 
        });

        let checkoutOptions = {
            paymentSessionId: "session_mock_live_" + Math.random().toString(36).substring(2, 10), 
            redirectTarget: "_modal",
        };

        cashfree.checkout(checkoutOptions).then(async function(result) {
            if (result.error) {
                window.showToast?.("Payment Failed: " + result.error.message, "error");
                isPlacingOrder = false;
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerText = "Place Order";
            }
            if (result.paymentDetails) {
                const paymentStatus = `Paid Online (${method}) - ID: ${result.paymentDetails.paymentId}`;
                await processFinalOrder(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, orderId, paymentStatus, "Paid & Pending");
            }
        });

    } catch (error) {
        console.error("Cashfree Initialization Error:", error);
        window.showToast?.("Could not start Cashfree payment.", "error");
        isPlacingOrder = false;
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerText = "Place Order";
    }
}

// ==========================================
// 4. FINAL ORDER SAVE FUNCTION
// ==========================================
async function processFinalOrder(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, orderId, paymentStatus, orderStatus) {
    try {
        isPlacingOrder = true;
        placeOrderBtn.innerText = "Saving Order...";
        placeOrderBtn.disabled = true;

        const fullAddress = `${address}, ${city} - ${pincode}`;

        // 1. Firebase mein Save
        const orderReference = await addDoc(collection(db, "orders"), {
            userId: user.uid, 
            userEmail: user.email,
            customerName: name,
            customerPhone: phone,
            deliveryAddress: fullAddress,
            paymentMode: paymentStatus,
            items: itemNames,
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            totalPrice: finalTotal,
            date: new Date().toLocaleDateString(),
            orderTime: serverTimestamp(), 
            status: "Pending", 
            orderId: orderId 
        });

        // 2. Google Sheets mein Sync
        await syncOrderToGoogleSheet({
            orderId: orderReference.id,
            orderedAt: new Date().toISOString(),
            customerName: name,
            phone: phone,
            email: user.email,
            address: fullAddress,
            items: itemNames,
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            total: finalTotal,
            payment: paymentStatus,
            status: "Pending",
            restaurant: "FoodHub"
        });

        // 3. Last order update for success page
        localStorage.setItem("lastOrder", JSON.stringify({
            id: orderReference.id,
            total: finalTotal,
            address: fullAddress,
            payment: paymentStatus,
            itemCount: itemNames.split(",").length
        }));

        // 4. Cart khali karein aur Success page par bhejein
        document.dispatchEvent(new Event("foodhub-clear-cart"));
        window.showToast?.("Order Placed Successfully!", "success");
        setTimeout(() => {
            window.location.href = "profile.html"; 
        }, 1500);

    } catch (err) {
        console.error("Firebase Save Error:", err);
        window.showToast?.("Error saving order. Try again.", "error");
        isPlacingOrder = false;
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerText = "Place Order";
    }
}
