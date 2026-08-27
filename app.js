// ========================================================
// FOODHUB - ORDER SUMMARY & CONTACT FORM (app.js)
// ========================================================

document.addEventListener("DOMContentLoaded", function () {

    // ---------- 1. LOAD ORDER SUMMARY & CALCULATE TOTAL ----------
    const orderItems = document.getElementById("orderItems");
    const grandTotal = document.getElementById("grandTotal");
    const deliveryFee = document.getElementById("deliveryFee");

    function updateOrderSummary() {
        if (!orderItems || !grandTotal || !deliveryFee) return;

        let cart = [];
        try {
            cart = JSON.parse(localStorage.getItem("cart")) || [];
        } catch (e) {
            cart = [];
        }

        let subtotal = 0;
        orderItems.innerHTML = "";

        if (cart.length === 0) {
            orderItems.innerHTML = "<p style='color: #888;'>Your Cart is Empty</p>";
            deliveryFee.textContent = "₹0";
            grandTotal.innerHTML = "Total : ₹0";
            return;
        }

        // Cart ke items aur price calculate karna
        cart.forEach(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;
            const itemTotal = price * quantity;

            subtotal += itemTotal;

            orderItems.innerHTML += `
                <p>
                    ${item.name} × ${quantity}
                    <span>₹${itemTotal}</span>
                </p>
            `;
        });

        // Delivery Charge ₹40 add karna
        const delivery = 40;
        const total = subtotal + delivery;

        // Total Update
        deliveryFee.textContent = "₹" + delivery;
        grandTotal.innerHTML = "Total : ₹" + total;
    }

    updateOrderSummary();

});


// ================= CONTACT FORM → WHATSAPP =================
window.sendContactWhatsApp = function () {
    // Input values read karna
    const nameEl = document.getElementById("name");
    const emailEl = document.getElementById("email");
    const subjectEl = document.getElementById("subject");
    const messageEl = document.getElementById("message");

    const name = nameEl ? nameEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";
    const subject = subjectEl ? subjectEl.value.trim() : "";
    const message = messageEl ? messageEl.value.trim() : "";

    // Validation
    if (!name || !email || !message) {
        showToast("Please fill name, email, and message before sending.", "error");
        return;
    }

    // Clean WhatsApp Message Format
    let waText = "📩 *FOODHUB - CUSTOMER MESSAGE*\n";
    waText += "══════════════════════\n\n";

    waText += "👤 *SENDER DETAILS*\n";
    waText += "• *Name:* " + name + "\n";
    waText += "• *Email:* " + email + "\n\n";

    waText += "📌 *SUBJECT*\n";
    waText += (subject || "General Inquiry") + "\n\n";

    waText += "💬 *MESSAGE*\n";
    waText += message + "\n\n";

    waText += "══════════════════════\n";
    waText += "_Sent via FoodHub Contact Page_";

    // WhatsApp URL
    const whatsappNumber = "919065521532";
    const whatsappURL = "https://api.whatsapp.com/send?phone=" + whatsappNumber + "&text=" + encodeURIComponent(waText);

    // Direct WhatsApp Open in New Tab
    window.open(whatsappURL, "_blank");
};
