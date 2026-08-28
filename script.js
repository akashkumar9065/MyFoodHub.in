// ===============================
// FOODHUB - script.js
// ===============================

// FIREBASE IMPORTS (Sabse upar hona zaroori hai)
import { db } from "./firebase.js";
import { collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ---------- RESPONSIVE NAVIGATION ----------
const navbar = document.getElementById("navbar");

if (navbar) {
    const navLinks = navbar.querySelector(".nav-links");

    if (navLinks) {
        const toggle = document.createElement("button");
        toggle.className = "menu-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Open navigation menu");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
        navbar.appendChild(toggle);

        const closeMenu = () => {
            navbar.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open navigation menu");
            toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
        };

        toggle.addEventListener("click", () => {
            const isOpen = navbar.classList.toggle("is-open");
            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
            toggle.innerHTML = isOpen
                ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
        });

        navLinks.addEventListener("click", closeMenu);
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeMenu();
        });
        window.addEventListener("resize", () => {
            if (window.innerWidth > 760) closeMenu();
        });
    }
}


// ---------- SEARCH ----------
const searchBox = document.getElementById("searchBox");
const homeSearchResults = document.getElementById("homeSearchResults");
const searchBtn = document.getElementById("searchBtn");
const menuSearchStatus = document.getElementById("menuSearchStatus");

const homeFoods = [
    { name: "Zinger Burger", restaurant: "KFC", image: "kfc/zinger-burger.png" },
    { name: "Chicken Bucket", restaurant: "KFC", image: "kfc/chicken-bucket.png" },
    { name: "Popcorn Chicken", restaurant: "KFC", image: "kfc/popcorn-chicken.png" },
    { name: "Margherita Pizza", restaurant: "Domino's", image: "dominoes/margherita.png" },
    { name: "Cheese Pizza", restaurant: "Domino's", image: "dominoes/cheese-pizza.png" },
    { name: "Farmhouse Pizza", restaurant: "Domino's", image: "dominoes/farmhose.png" },
    { name: "Whopper", restaurant: "Burger King", image: "burgerKing/whopper.png" },
    { name: "Chicken Whopper", restaurant: "Burger King", image: "burgerKing/chicken-whopper.png" },
    { name: "Crispy Veg Burger", restaurant: "Burger King", image: "burgerKing/crispy-veg.png" },
    { name: "Chicken Biryani", restaurant: "Biryani House", image: "biryanihouse/chicken-biryani.png" },
    { name: "Mutton Biryani", restaurant: "Biryani House", image: "biryanihouse/mutton-biryani.png" },
    { name: "Veg Biryani", restaurant: "Biryani House", image: "biryanihouse/bveg-biryani.png" }
];

function showHomeSearchResults(query) {
    if (!homeSearchResults) return;

    const searchTerm = query.trim().toLowerCase();
    if (!searchTerm) {
        homeSearchResults.innerHTML = "";
        return;
    }

    const matches = homeFoods.filter(food =>
        `${food.name} ${food.restaurant}`.toLowerCase().includes(searchTerm)
    );

    homeSearchResults.innerHTML = matches.length
        ? matches.map(food => `
            <a class="home-search-result" href="menu.html?search=${encodeURIComponent(food.name)}">
                <div class="search-result-image"><img src="${food.image}" alt="${food.name}"></div>
                <span><small>${food.restaurant}</small><strong>${food.name}</strong><em>View menu <i class="fa-solid fa-arrow-right"></i></em></span>
            </a>`).join("")
        : '<p class="no-search-result"><i class="fa-solid fa-bowl-food"></i> No food item found. Try pizza, burger or biryani.</p>';
}

function showMenuSearchResults(query) {
    if (homeSearchResults) return;

    const searchTerm = query.trim().toLowerCase();
    const sections = document.querySelectorAll(".restaurant-section");
    let matchCount = 0;

    sections.forEach(section => {
        const restaurant = section.querySelector(".restaurant-info h2")?.textContent.toLowerCase() || "";
        const cards = section.querySelectorAll(".food-card");
        let sectionHasMatch = false;

        cards.forEach(card => {
            const foodName = card.querySelector("h3")?.textContent.toLowerCase() || "";
            const isMatch = !searchTerm || foodName.includes(searchTerm) || restaurant.includes(searchTerm);
            card.hidden = !isMatch;
            if (isMatch) {
                sectionHasMatch = true;
                matchCount++;
            }
        });

        section.hidden = Boolean(searchTerm) && !sectionHasMatch;
        section.classList.toggle("is-searching", Boolean(searchTerm));
    });

    if (menuSearchStatus) {
        menuSearchStatus.textContent = searchTerm
            ? (matchCount ? `${matchCount} delicious item${matchCount === 1 ? "" : "s"} found for “${query.trim()}”` : `No food item found for “${query.trim()}”. Try pizza, burger or biryani.`)
            : "";
        menuSearchStatus.classList.toggle("has-results", Boolean(searchTerm && matchCount));
        menuSearchStatus.classList.toggle("no-results", Boolean(searchTerm && !matchCount));
    }
}

if (searchBox) {
    searchBox.addEventListener("input", function () {
        if (homeSearchResults) {
            showHomeSearchResults(this.value);
            return;
        }
        showMenuSearchResults(this.value);
    });
}

if (searchBtn && searchBox) {
    searchBtn.addEventListener("click", function () {
        if (homeSearchResults) showHomeSearchResults(searchBox.value);
        else showMenuSearchResults(searchBox.value);
    });

    searchBox.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            if (homeSearchResults) showHomeSearchResults(this.value);
            else showMenuSearchResults(this.value);
        }
    });
}

if (searchBox && !homeSearchResults) {
    const menuSearch = new URLSearchParams(window.location.search).get("search");
    if (menuSearch) {
        searchBox.value = menuSearch;
        searchBox.dispatchEvent(new Event("input"));
    }
}


// ---------- SIMPLE FADE ANIMATION (Hardcoded Cards ke liye) ----------
const cards = document.querySelectorAll(".food-card, .menu-card, .card, .review, .why-box");
cards.forEach(card => {
    card.addEventListener("mouseenter", function () {
        card.style.transform = "scale(1.05)";
        card.style.transition = "transform 0.3s ease"; // Smoothness added
    });
    card.addEventListener("mouseleave", function () {
        card.style.transform = "scale(1)";
    });
});


// =======================================================
// FIREBASE DYNAMIC MENU & DELETE LOGIC (NO HTML CHANGES)
// =======================================================

async function loadDynamicFirebaseMenu() {
    // Menu page ke pehle food container ko target kar raha hai
    const firstContainer = document.querySelector(".food-container");
    if (!firstContainer) return; 

    try {
        const querySnapshot = await getDocs(collection(db, "menu"));
        if (querySnapshot.empty) return;

        let menuHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const docId = docSnap.id;

            menuHTML += `
            <div class="food-card live-firebase-card" style="position: relative; border: 2px solid #ff5722; box-shadow: 0 4px 15px rgba(255,87,34,0.15);">
                
                <!-- Delete Button -->
                <button class="delete-dish-btn" data-id="${docId}" style="position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; z-index: 10;" title="Delete this item">
                    <i class="fa-solid fa-trash"></i>
                </button>

                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3075/3075977.png'">
                <h3>${item.name} <span style="font-size: 10px; background: #ff5722; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px; vertical-align: middle;">NEW</span></h3>
                <p>${item.description || 'Delicious freshly added dish.'}</p>
                <div class="rating">⭐⭐⭐⭐⭐ 5.0</div>
                <span class="price">₹${item.price}</span>
                
                <button class="add-to-cart" data-name="${item.name}" data-price="${item.price}" data-image="${item.image}">
                    Add to Cart
                </button>
            </div>
            `;
        });

        // Naye cards ko sabse aage (top par) add karna
        firstContainer.insertAdjacentHTML("afterbegin", menuHTML);

        // Naye cards pe bhi hover animation lagana taaki design match kare
        const newCards = firstContainer.querySelectorAll(".live-firebase-card");
        newCards.forEach(card => {
            card.addEventListener("mouseenter", function () {
                card.style.transform = "scale(1.05)";
                card.style.transition = "transform 0.3s ease";
            });
            card.addEventListener("mouseleave", function () {
                card.style.transform = "scale(1)";
            });
        });

    } catch (error) {
        console.error("Firebase menu fetch error:", error);
    }
}

// Delete Event Listener (Bina refresh delete hone ke liye)
document.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-dish-btn");
    
    if (deleteBtn) {
        const dishId = deleteBtn.getAttribute("data-id");
        
        if (confirm("Are you sure you want to delete this new dish?")) {
            try {
                deleteBtn.innerHTML = "⏳"; // Loading sign
                
                // Firestore se delete karna
                await deleteDoc(doc(db, "menu", dishId));
                
                // HTML se card hatana animation ke sath
                const cardToRemove = deleteBtn.closest(".live-firebase-card");
                cardToRemove.style.opacity = "0";
                setTimeout(() => cardToRemove.remove(), 300);
                
                window.showToast?.("Dish deleted successfully!", "success") || alert("Dish deleted!");
            } catch (error) {
                console.error("Delete error:", error);
                window.showToast?.("Failed to delete.", "error") || alert("Failed to delete.");
                deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
            }
        }
    }
});

// Page load hone par menu load karna
document.addEventListener("DOMContentLoaded", loadDynamicFirebaseMenu);


// ---------- CURRENT YEAR ----------
const footerYear = document.querySelector("footer p:last-child");
if (footerYear) {
    const currentYear = new Date().getFullYear();
    footerYear.innerHTML = `© ${currentYear} FoodHub. All Rights Reserved.`;
}
