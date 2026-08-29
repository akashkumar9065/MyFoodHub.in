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

const pageTitle = document.title.toLowerCase();
let currentPageTag = "";

if (pageTitle.includes("kfc")) currentPageTag = "kfc";
else if (pageTitle.includes("domino")) currentPageTag = "dominoes";
else if (pageTitle.includes("burger")) currentPageTag = "burgerking";
else if (pageTitle.includes("biryani")) currentPageTag = "biryanihouse";
else if (pageTitle.includes("menu")) currentPageTag = "menu";

if (currentPageTag !== "") {
    onSnapshot(collection(db, "menu"), (snapshot) => {
        
        // Purane dynamic items hatao taaki duplicate na ho
        document.querySelectorAll('.firebase-dynamic-item').forEach(el => el.remove());

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
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

            // 1. Agar user individual restaurant page par hai (jaise kfc.html)
            if (currentPageTag === data.restaurant) {
                const container = document.querySelector('.food-container') || document.querySelector('.menu-container');
                if (container) container.prepend(card);
            }
            
            // 2. Agar user main menu.html page par hai
            else if (currentPageTag === "menu") {
                let targetContainer = null;

                // Restaurant category ke hisaab se sahi container dhoondna
                if (data.restaurant === "kfc") {
                    targetContainer = document.getElementById("kfc-menu") || document.querySelector(".restaurant-section:nth-of-type(1) .food-container");
                } else if (data.restaurant === "dominoes") {
                    targetContainer = document.getElementById("dominoes-menu") || document.querySelector(".restaurant-section:nth-of-type(2) .food-container");
                } else if (data.restaurant === "burgerking") {
                    targetContainer = document.getElementById("burgerking-menu") || document.querySelector(".restaurant-section:nth-of-type(3) .food-container");
                } else if (data.restaurant === "biryanihouse") {
                    targetContainer = document.getElementById("biryanihouse-menu") || document.querySelector(".restaurant-section:nth-of-type(4) .food-container");
                }

                // Agar container mil gaya toh item wahan daal do
                if (targetContainer) {
                    targetContainer.prepend(card);
                } else {
                    // Fallback: Agar kuch na mile toh pehle wale container mein daal do
                    const fallbackContainer = document.querySelector('.food-container');
                    if (fallbackContainer) fallbackContainer.prepend(card);
                }
            }
        });
    });
}
