import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// URL path se detect karenge ki kaun sa page khula hai
const path = window.location.pathname.toLowerCase();
let currentPageTag = "";

if (path.includes("kfc")) currentPageTag = "kfc";
else if (path.includes("domino")) currentPageTag = "dominoes";
else if (path.includes("burger")) currentPageTag = "burgerking";
else if (path.includes("biryani")) currentPageTag = "biryanihouse";
else if (path.includes("menu")) currentPageTag = "menu";

console.log("Detected Page Tag:", currentPageTag);

if (currentPageTag !== "") {
    onSnapshot(collection(db, "menu"), (snapshot) => {
        console.log("Total menu items from Firebase:", snapshot.size);
        
        // Purane dynamic items hatao taaki duplicate na ho
        document.querySelectorAll('.firebase-dynamic-item').forEach(el => el.remove());

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const dbRestaurant = String(data.restaurant || "").toLowerCase().trim();
            
            const card = document.createElement('div');
            card.className = 'food-card firebase-dynamic-item';
            card.innerHTML = `
                <img src="${data.image}" alt="${data.name}">
                <h3>${data.name}</h3>
                <p>${data.description}</p>
                <div class="rating">⭐⭐⭐⭐⭐ 4.8</div>
                <span class="price">₹${data.price}</span>
                <button type="button" class="add-to-cart" data-name="${data.name}" data-price="${data.price}" data-image="${data.image}">
                    Add to Cart
                </button>
            `;

            // 1. Agar individual restaurant page par hain (jaise kfc.html)
            if (currentPageTag === dbRestaurant) {
                const container = document.querySelector('.food-container') || document.querySelector('.menu-container');
                if (container) container.prepend(card);
            }
            
            // 2. Agar main menu.html page par hain
            else if (currentPageTag === "menu") {
                let targetContainer = document.getElementById(dbRestaurant + '-menu');

                // Agar ID na mile, toh section ke heading se dhoond lo
                if (!targetContainer) {
                    const sections = document.querySelectorAll('.restaurant-section');
                    sections.forEach(sec => {
                        const headingText = sec.querySelector('h2')?.textContent.toLowerCase() || "";
                        if (headingText.includes(dbRestaurant)) {
                            targetContainer = sec.querySelector('.food-container');
                        }
                    });
                }

                if (targetContainer) {
                    targetContainer.prepend(card);
                } else {
                    // Fallback container
                    const generalContainer = document.querySelector('.food-container');
                    if (generalContainer) generalContainer.prepend(card);
                }
            }
        });
    });
}
