import { auth, db } from "./firebase.js";
import { collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// Google Sheets order-report endpoint (Apps Script Web App).
const GOOGLE_SHEETS_ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwFKIG-mikHTdm_CZwwgGWv-zLZAOiCDjac1E_oK3GtCBsHqmOg6kIjNZIKPqcrhh4lTQ/exec";

function syncOrderToGoogleSheet(order) {
    // no-cors lets the browser send the order to the Apps Script web app without
    // interrupting checkout if the reporting service is temporarily unavailable.
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
        // Email hamesha login user ka rahega
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
                    // Checkbox ON: use only this user's saved Firestore profile.
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
                        showToast("No saved address found in your profile.", "info");
                        this.checked = false; // Agar data nahi hai toh wapas uncheck kar do
                        }
                    } catch (error) {
                        console.error("Profile load failed:", error);
                        showToast("Saved address could not be loaded.", "error");
                        this.checked = false;
                    }
                } else {
                    // Checkbox OFF: Form ko khali kar do taaki naya likh sakein
                    if (name) name.value = "";
                    if (phone) phone.value = "";
                    if (address) address.value = "";
                    if (city) city.value = "";
                    if (pincode) pincode.value = "";
                }
            });
        }
    } else {
        // Agar user login nahi hai, to usko login page par bhej do
        showToast("Please log in to proceed to checkout.", "info");
        window.location.href = "login.html";
    }
});


// ==========================================
// 2. ORDER PLACE KARNE KA LOGIC (FIREBASE + WHATSAPP)
// ==========================================
const placeOrderBtn = document.getElementById("placeOrderBtn"); 
let isPlacingOrder = false;

const deliveryPhoneInput = document.getElementById("phone");
const deliveryPincodeInput = document.getElementById("pincode");

// Only digits are allowed in mobile number and pincode fields, including pasted text.
[deliveryPhoneInput, deliveryPincodeInput].forEach(input => {
    input?.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
        input.setCustomValidity("");
    });
});

if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", async function(e) {
        e.preventDefault(); 

        // Ignore a second click while the first checkout request is still running.
        if (isPlacingOrder) return;

        const user = auth.currentUser;
        
        // LocalStorage se real cart items nikalein
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        if (cartItems.length === 0) {
            showToast("Your cart is empty. Please add some food first.", "info");
            window.location.href = "menu.html";
            return;
        }

        if (user) {
            // Check karein ki form ke saare details bhare hue hain ya nahi
            const name = document.getElementById("name").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const address = document.getElementById("address").value.trim();
            const city = document.getElementById("city") ? document.getElementById("city").value.trim() : "";
            const pincode = document.getElementById("pincode") ? document.getElementById("pincode").value.trim() : "";
            
            const paymentElement = document.querySelector('input[name="payment"]:checked');
            const payment = paymentElement ? paymentElement.value : "Cash on Delivery";
            
            if (!name || !phone || !address || !city || !pincode) {
                showToast("Please fill all delivery details, including city and pincode.", "error");
                return;
            }

            if (!/^\d{10}$/.test(phone)) {
                deliveryPhoneInput.setCustomValidity("Please enter a valid 10-digit mobile number.");
                deliveryPhoneInput.reportValidity();
                deliveryPhoneInput.focus();
                showToast("Mobile number must contain exactly 10 digits.", "error");
                return;
            }

            if (!/^\d{6}$/.test(pincode)) {
                deliveryPincodeInput.setCustomValidity("Please enter a valid 6-digit pincode.");
                deliveryPincodeInput.reportValidity();
                deliveryPincodeInput.focus();
                showToast("Pincode must contain exactly 6 digits.", "error");
                return;
            }

            deliveryPhoneInput.setCustomValidity("");
            deliveryPincodeInput.setCustomValidity("");

            try {
                isPlacingOrder = true;
                placeOrderBtn.innerText = "Placing Order...";
                placeOrderBtn.disabled = true;

                // Cart items ka naam aur quantity ka ek text banayein
                let itemNames = cartItems.map(item => `${item.name} x${item.quantity}`).join(", ");
                
                // Real Price calculate karein (+ ₹40 delivery charge)
                let subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
                let finalTotal = subtotal + 40;

                // ==========================================
                // STEP A: FIREBASE DATABASE MEIN SAVE KAREIN
                // ==========================================
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
                    status: "Confirmed" // Default status
                });

                // Keep the private business report in Google Sheets updated automatically.
                // Firestore remains the main database for the website.
                // Wait for the browser to queue the reporting request before opening
                // WhatsApp and redirecting away from checkout. Without this await,
                // navigation can cancel the request before Apps Script receives it.
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
                    status: "Confirmed",
                    restaurant: "FoodHub"
                });
                
                // ==========================================
                // STEP B: WHATSAPP MESSAGE BANAYEIN
                // ==========================================
                let message = "🍔 *FOODHUB - NEW ORDER*\n";
                message += "══════════════════════\n\n";
                message += `👤 *CUSTOMER INFO*\n• *Name:* ${name}\n• *Phone:* ${phone}\n• *Address:* ${address}, ${city} - ${pincode}\n• *Payment:* ${payment}\n\n`;
                message += "🍽️ *ORDER ITEMS*\n";

                cartItems.forEach((item, index) => {
                    const itemTotal = Number(item.price) * Number(item.quantity);
                    message += `${index + 1}. *${item.name}* × ${item.quantity}  ➜  ₹${itemTotal}\n`;
                });

                message += `\n💵 *BILL SUMMARY*\n• Subtotal: ₹${subtotal}\n• Delivery Fee: ₹40\n• *Total Payable: ₹${finalTotal}*\n\n`;
                message += "✨ _Thank you for ordering with FoodHub!_";

                const whatsappNumber = "919065521532";
                const whatsappURL = "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message);

                // ==========================================
                // STEP C: WHATSAPP OPEN KAREIN AUR REDIRECT KAREIN
                // ==========================================
                
                // WhatsApp naye tab mein kholein
                window.open(whatsappURL, "_blank");

                localStorage.setItem("lastOrder", JSON.stringify({
                    id: orderReference.id,
                    total: finalTotal,
                    address: `${address}, ${city} - ${pincode}`,
                    payment,
                    itemCount: cartItems.reduce((count, item) => count + Number(item.quantity), 0)
                }));

                // Order hone ke baad Cart khali kar dein aur confirmation page par bhej dein
                document.dispatchEvent(new Event("foodhub-clear-cart"));
                window.location.href = "order-success.html"; 
                
            } catch (error) {
                console.error("Error saving order: ", error);
                showToast("Order could not be placed. Please try again.", "error");
                isPlacingOrder = false;
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerText = "Place Order";
            }
        }
    });
}
