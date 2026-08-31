import { auth, db } from "./firebase.js";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// Google Sheets order-report endpoint (Secure Vercel Proxy)
const GOOGLE_SHEETS_ORDER_ENDPOINT = "/api/sync-google-sheet";

// ==========================================
// HELPER FUNCTION: GOOGLE SHEETS SYNC
// ==========================================
async function syncOrderToGoogleSheet(orderData) {
    try {
        await fetch(GOOGLE_SHEETS_ORDER_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderData)
        });
    } catch (error) {
        console.warn("Google Sheet sync failed:", error);
    }
}

// ==========================================
// STATE VARIABLES
// ==========================================
let isPlacingOrder = false;
let currentSubtotal = 0;
let currentDeliveryFee = 0;
let currentFinalTotal = 0;

const placeOrderBtn = document.getElementById("placeOrderBtn");
const useSavedAddress = document.getElementById("useSavedAddress");
const deliveryPhoneInput = document.getElementById("phone");
const deliveryPincodeInput = document.getElementById("pincode");
const checkoutItemsListEl = document.getElementById("checkout-items-list"); // Naya ID for UI
const summaryDeliveryFeeEl = document.getElementById("summary-delivery-fee"); // Naya ID for UI
const summaryTotalEl = document.getElementById("summary-total-price"); // Naya ID for UI

// ==========================================
// 1. AUTHENTICATION & AUTO-FILL LOGIC
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Auto-fill email and make it read-only
        const emailInput = document.getElementById("email");
        if (emailInput) {
            emailInput.value = user.email;
            emailInput.readOnly = true; 
        }

        // Saved Address Logic
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
// 2. INITIALIZATION & DYNAMIC DELIVERY FEE LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    updateOrderSummaryUI();
});

function updateOrderSummaryUI() {
    // Load Cart Data
    let cartItems = JSON.parse(localStorage.getItem("cart")) || [];
    
    if (cartItems.length === 0) {
        if (checkoutItemsListEl) checkoutItemsListEl.innerHTML = "<p>Your cart is empty.</p>";
        currentSubtotal = 0;
        currentDeliveryFee = 0;
        currentFinalTotal = 0;
    } else {
        // Render Items & Calculate Subtotal
        let subtotal = 0;
        if (checkoutItemsListEl) {
            checkoutItemsListEl.innerHTML = cartItems.map(item => {
                const itemTotal = Number(item.price) * Number(item.quantity);
                subtotal += itemTotal;
                return `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 15px; color: #555;">
                        <span>${item.name} × ${item.quantity}</span>
                        <span>₹${itemTotal}</span>
                    </div>
                `;
            }).join("");
        }

        currentSubtotal = subtotal;

        // ==========================================
        // DYNAMIC DELIVERY FEE LOGIC (FIXED)
        // ==========================================
        let deliveryFee = 0;
        if (currentSubtotal >= 100) {
            // Greater than 100: 10% charge
            deliveryFee = Math.round(currentSubtotal * 0.10);
            // Min/Max limit (Optional - jaise cart mein ho)
            if (deliveryFee < 15) deliveryFee = 15;
            else if (deliveryFee > 50) deliveryFee = 50;
        } else {
            // Less than 100: Free Delivery
            deliveryFee = 0;
        }
        
        currentDeliveryFee = deliveryFee;
        currentFinalTotal = currentSubtotal + currentDeliveryFee;
    }

    // Update UI Elements
    if (summaryDeliveryFeeEl) summaryDeliveryFeeEl.innerText = `₹${currentDeliveryFee}`;
    if (summaryTotalEl) summaryTotalEl.innerText = `Total : ₹${currentFinalTotal}`;
}

// ==========================================
// 3. INPUT VALIDATION (NUMBER ONLY)
// ==========================================
[deliveryPhoneInput, deliveryPincodeInput].forEach(input => {
    input?.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
        input.setCustomValidity("");
    });
});

// ==========================================
// 4. PLACE ORDER CLICK HANDLER
// ==========================================
if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", async function(e) {
        e.preventDefault();

        if (isPlacingOrder) return;

        const user = auth.currentUser;
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        // Basic Checks
        if (cartItems.length === 0) {
            window.showToast?.("Your cart is empty. Please add some food first.", "info");
            window.location.href = "menu.html";
            return;
        }

        if (!user) {
            window.showToast?.("Please log in to place an order.", "warning");
            return;
        }

        // Form Data
        const name = document.getElementById("name").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const address = document.getElementById("address").value.trim();
        const city = document.getElementById("city")?.value.trim() || "";
        const pincode = document.getElementById("pincode")?.value.trim() || "";
        const paymentElement = document.querySelector('input[name="paymentMethod"]:checked') || document.querySelector('input[name="payment"]:checked');
        const payment = paymentElement ? paymentElement.value : "COD";

        // Validation
        if (!name || !phone || !address || !city || !pincode) {
            window.showToast?.("Please fill all delivery details, including city and pincode.", "error");
            return;
        }
        if (!/^\d{10}$/.test(phone)) {
            window.showToast?.("Mobile number must contain exactly 10 digits.", "error");
            return;
        }
        if (!/^\d{6}$/.test(pincode)) {
            window.showToast?.("Pincode must contain exactly 6 digits.", "error");
            return;
        }

        // Final Totals Re-calculation before processing
        updateOrderSummaryUI();

        const itemNames = cartItems.map(item => `${item.name} x${item.quantity}`).join(", ");
        const tempOrderId = "ORD-" + Date.now();

        if (payment === "COD" || payment === "Cash on Delivery") {
            // Process COD
            await processFinalOrder(user, name, phone, address, city, pincode, itemNames, currentSubtotal, currentDeliveryFee, currentFinalTotal, tempOrderId, "Cash on Delivery", "Pending");
        } else {
            // Process Online Payment
            await triggerCashfreePayment(user, name, phone, address, city, pincode, itemNames, currentSubtotal, currentDeliveryFee, currentFinalTotal, tempOrderId, payment);
        }
    });
}

// ==========================================
// 5. CASHFREE PAYMENT TRIGGER
// ==========================================
async function triggerCashfreePayment(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, orderId, method) {
    try {
        isPlacingOrder = true;
        placeOrderBtn.innerText = "Creating Payment Session...";
        placeOrderBtn.disabled = true;

        const apiResponse = await fetch("/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId: orderId,
                amount: finalTotal,
                customerId: user.uid,
                customerName: name,
                customerEmail: user.email,
                customerPhone: phone
            })
        });

        const apiData = await apiResponse.json();

        if (!apiResponse.ok || !apiData.payment_session_id) {
            throw new Error(apiData.error || "Failed to fetch payment session from server.");
        }

        placeOrderBtn.innerText = "Initializing Cashfree...";

        const cashfree = Cashfree({ mode: "production" });

        let checkoutOptions = {
            paymentSessionId: apiData.payment_session_id,
            redirectTarget: "_modal",
        };

        cashfree.checkout(checkoutOptions).then(async function(result) {
            if (result.error) {
                window.showToast?.("Payment Failed: " + result.error.message, "error");
                isPlacingOrder = false;
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerText = "Place Order";
            } else if (result.paymentDetails) {
                const paymentStatus = `Paid Online (${method}) - ID: ${result.paymentDetails.paymentId}`;
                await processFinalOrder(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, orderId, paymentStatus, "Paid & Pending");
            }
        });

    } catch (error) {
        console.error("Cashfree Initialization Error:", error);
        window.showToast?.(error.message || "Could not start Cashfree payment.", "error");
        isPlacingOrder = false;
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerText = "Place Order";
    }
}

// ==========================================
// 6. FINAL ORDER SAVE FUNCTION
// ==========================================
async function processFinalOrder(user, name, phone, address, city, pincode, itemNames, subtotal, deliveryFee, finalTotal, orderId, paymentStatus, orderStatus) {
    try {
        isPlacingOrder = true;
        placeOrderBtn.innerText = "Saving Order...";
        placeOrderBtn.disabled = true;

        const fullAddress = `${address}, ${city} - ${pincode}`;

        // 1. Firebase Save
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

        // 2. Google Sheets Sync (via Secure Proxy)
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

        // 3. Success Page Data
        localStorage.setItem("lastOrder", JSON.stringify({
            id: orderReference.id,
            total: finalTotal,
            address: fullAddress,
            payment: paymentStatus,
            itemCount: itemNames.split(",").length
        }));

        // 4. Clear Cart & Redirect
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
