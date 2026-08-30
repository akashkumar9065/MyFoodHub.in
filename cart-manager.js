import { auth, db } from "./firebase.js";
import { doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const CART_KEY = "cart";
const CART_OWNER_KEY = "cartOwnerUid";
let cart = readLocalCart();
let stopCartListener = null;
let activeUserId = null;

function readLocalCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY)) || [];
        return Array.isArray(saved) ? saved.map(normalizeItem).filter(Boolean) : [];
    } catch { return []; }
}

function normalizeItem(item) {
    if (!item?.name || !Number(item.price)) return null;
    return { name: String(item.name), price: Number(item.price), quantity: Math.max(1, Number(item.quantity) || 1), image: item.image || "" };
}

function mergeCarts(first = [], second = []) {
    const merged = new Map();
    [...first, ...second].map(normalizeItem).filter(Boolean).forEach(item => {
        const existing = merged.get(item.name);
        merged.set(item.name, existing ? { ...existing, quantity: existing.quantity + item.quantity } : item);
    });
    return [...merged.values()];
}

function updateLocalCart(items, ownerId = activeUserId) {
    cart = items.map(normalizeItem).filter(Boolean);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    if (ownerId) localStorage.setItem(CART_OWNER_KEY, ownerId);
    else localStorage.removeItem(CART_OWNER_KEY);
    renderCart();
    
    // Global badges update functions safety check
    if (typeof window.updateGlobalCartBadges === "function") {
        window.updateGlobalCartBadges();
    }
    document.dispatchEvent(new CustomEvent("foodhub-cart-updated", { detail: { cart } }));
}

async function saveRemoteCart() {
    if (!activeUserId) return;
    try {
        await setDoc(doc(db, "carts", activeUserId), { items: cart, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error("Cart sync failed:", error);
        window.showToast?.("Cart sync failed. Please check your connection.", "error");
    }
}

function updateCart(items, { sync = true } = {}) {
    updateLocalCart(items);
    if (sync) void saveRemoteCart();
}

function cartCount() { return cart.reduce((total, item) => total + item.quantity, 0); }

function renderCart() {
    const tbody = document.querySelector(".cart-section tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    let subtotal = 0;
    if (!cart.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">🛒 Your Cart is Empty</td></tr>';
    } else {
        cart.forEach((item, index) => {
            const total = item.price * item.quantity;
            subtotal += total;
            tbody.insertAdjacentHTML("beforeend", `<tr><td>${item.name}</td><td>₹${item.price}</td><td><input type="number" value="${item.quantity}" min="1" onchange="changeQty(${index}, this.value)"></td><td>₹${total}</td><td><button onclick="removeItem(${index})" style="background:#dc3545; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Remove</button></td></tr>`);
        });
    }

    // ==========================================
    // PROFESSIONAL DYNAMIC DELIVERY FEE LOGIC
    // ==========================================
    let delivery = 0;
    if (cart.length > 0) {
        if (subtotal >= 100) {
            delivery = Math.round(subtotal * 0.10); // 10% of subtotal
            if (delivery < 15) {
                delivery = 15; // Minimum ₹15
            } else if (delivery > 50) {
                delivery = 50; // Maximum ₹50
            }
        } else {
            delivery = 0; // Free delivery if under ₹100
        }
    }

    const spans = document.querySelectorAll(".bill-summary span");
    if (spans.length >= 3) {
        spans[0].textContent = cartCount();
        spans[1].textContent = `₹${subtotal}`;
        spans[2].textContent = `₹${delivery}`;
    }
    const totalText = document.querySelector(".bill-summary h3");
    if (totalText) totalText.textContent = `Total : ₹${subtotal + delivery}`;
}

function addItem(item) {
    const next = [...cart];
    const existing = next.find(entry => entry.name === item.name);
    if (existing) existing.quantity += 1;
    else next.push({ ...item, quantity: 1 });
    updateCart(next);
}

document.addEventListener("click", event => {
    const button = event.target.closest(".add-to-cart");
    if (!button) return;
    event.preventDefault();
    const item = normalizeItem({ name: button.dataset.name, price: button.dataset.price, image: button.dataset.image || "" });
    if (!item) return window.showToast?.("Food details could not be found.", "error");
    addItem(item);
    window.showToast?.(`${item.name} added to cart!`, "success");
});

window.changeQty = (index, value) => updateCart(cart.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, Number(value) || 1) } : item));
window.removeItem = index => {
    if (confirm("Remove this item from cart?")) updateCart(cart.filter((_, itemIndex) => itemIndex !== index));
};
document.addEventListener("foodhub-clear-cart", () => updateCart([]));

onAuthStateChanged(auth, user => {
    if (stopCartListener) { stopCartListener(); stopCartListener = null; }
    if (!user) {
        activeUserId = null;
        if (localStorage.getItem(CART_OWNER_KEY)) updateLocalCart([], null);
        return;
    }
    activeUserId = user.uid;
    const localOwner = localStorage.getItem(CART_OWNER_KEY);
    const guestCart = localOwner ? [] : readLocalCart();
    let isInitialLoad = true;
    const cartRef = doc(db, "carts", user.uid);
    
    stopCartListener = onSnapshot(cartRef, snapshot => {
        const cloudCart = snapshot.exists() ? (snapshot.data().items || []) : [];
        const combined = isInitialLoad && !localOwner
            ? mergeCarts(cloudCart, guestCart)
            : cloudCart.map(normalizeItem).filter(Boolean);
        updateLocalCart(combined, user.uid);
        if (isInitialLoad && !localOwner && guestCart.length) void saveRemoteCart();
        isInitialLoad = false;
    }, error => {
        console.error("Cart listener failed:", error);
        updateLocalCart(readLocalCart(), user.uid);
    });
});

document.addEventListener("DOMContentLoaded", () => { 
    renderCart(); 
    if (typeof window.updateGlobalCartBadges === "function") {
        window.updateGlobalCartBadges();
    }
});
