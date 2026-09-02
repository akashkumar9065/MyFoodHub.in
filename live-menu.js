import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBN4o_xEuTEIDqALYWQNRDB5Bj2CoyK4eY",
    authDomain: "foodhub-6a986.firebaseapp.com",
    projectId: "foodhub-6a986",
    storageBucket: "foodhub-6a986.firebasestorage.app",
    messagingSenderId: "330220531332",
    appId: "1:330220531332:web:ee932499601bd602f61cd1",
    measurementId: "G-J8JXSW5P3S"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// URL se query parameter read karna (e.g., menu.html?restaurant=kfc)
const urlParams = new URLSearchParams(window.location.search);
const targetRestaurantSlug = urlParams.get("restaurant")?.toLowerCase().trim() || "";

async function loadDynamicMenu() {
    const container = document.getElementById("dynamicMenuContainer");
    if (!container) return;

    try {
        // 1. Fetch Restaurants & Menu items simultaneously from Firebase
        const [restSnapshot, menuSnapshot] = await Promise.all([
            getDocs(query(collection(db, "restaurants"), orderBy("name"))),
            getDocs(query(collection(db, "menu"), orderBy("name")))
        ]);

        let restaurants = [];
        restSnapshot.forEach(doc => restaurants.push({ id: doc.id, ...doc.data() }));

        let menuItems = [];
        menuSnapshot.forEach(doc => menuItems.push({ id: doc.id, ...doc.data() }));

        if (restaurants.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px;"><p>No restaurants available.</p></div>';
            return;
        }

        // Agar URL mein koi specific restaurant pass kiya hai, toh sirf usi ko filter karo
        if (targetRestaurantSlug) {
            restaurants = restaurants.filter(r => String(r.slug || "").toLowerCase().trim() === targetRestaurantSlug);
        }

        container.innerHTML = "";

        if (restaurants.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px;"><p>Restaurant not found.</p></div>';
            return;
        }

        // 2. Render each restaurant with its banner and food items grid
        restaurants.forEach(rest => {
            const restSlug = String(rest.slug || "").toLowerCase().trim();
            const matchedItems = menuItems.filter(item => String(item.restaurant || "").toLowerCase().trim() === restSlug);

            let itemsHTML = "";
            if (matchedItems.length === 0) {
                itemsHTML = '<p style="color: #777; padding: 20px; text-align: center;">No food items found for this restaurant.</p>';
            } else {
                itemsHTML = `<div class="food-container">` + matchedItems.map(data => `
                    <div class="food-card">
                        <img src="${data.image}" alt="${data.name}" onerror="this.src='https://via.placeholder.com/200?text=No+Image'">
                        <h3>${data.name}</h3>
                        <p>${data.description || ""}</p>
                        <div class="rating">⭐ ${data.rating || 4.5}</div>
                        <span class="price">₹${data.price}</span>
                        <button type="button" class="add-to-cart" data-name="${data.name}" data-price="${data.price}" data-image="${data.image}">
                            Add to Cart
                        </button>
                    </div>
                `).join("") + `</div>`;
            }

            const sectionHTML = `
                <section class="restaurant-section" style="margin-bottom: 40px; padding: 0 20px;">
                    <div class="restaurant-banner" style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 2px solid #ff4757; padding-bottom: 10px;">
                        <img src="${rest.image}" alt="${rest.name}" onerror="this.src='https://via.placeholder.com/60?text=Logo'" style="width: 60px; height: 60px; object-fit: cover; border-radius: 50%;">
                        <div>
                            <h2 style="margin: 0; color: #333; font-size: 24px;">${rest.name}</h2>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">⭐ ${rest.rating || 4.5} (${rest.reviews || 'Reviews'}) • <i class="fa-solid fa-clock"></i> ${rest.deliveryTime || '20-30 mins'}</p>
                        </div>
                    </div>
                    ${itemsHTML}
                </section>
            `;

            container.insertAdjacentHTML("beforeend", sectionHTML);
        });

    } catch (error) {
        console.error("Error loading dynamic menu:", error);
        container.innerHTML = '<div style="text-align:center; padding:40px;"><p style="color: red;">Failed to load menus. Please try again later.</p></div>';
    }
}

document.addEventListener("DOMContentLoaded", loadDynamicMenu);
