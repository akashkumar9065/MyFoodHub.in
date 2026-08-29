import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 👇 AAPKA ASLI FIREBASE CONFIG YAHAN HAI 👇
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

// Browser ka title padh kar page pata lagana
const pageTitle = document.title.toLowerCase();
let currentPageTag = "";

if (pageTitle.includes("kfc")) currentPageTag = "kfc";
else if (pageTitle.includes("domino")) currentPageTag = "dominoes";
else if (pageTitle.includes("burger")) currentPageTag = "burgerking";
else if (pageTitle.includes("biryani")) currentPageTag = "biryanihouse";
else if (pageTitle.includes("menu")) currentPageTag = "menu";

if (currentPageTag !== "") {
    onSnapshot(collection(db, "menu"), (snapshot) => {
        
        // Purane dynamic items hatao refresh hone par
        document.querySelectorAll('.firebase-dynamic-item').forEach(el => el.remove());

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // Customer View Card Structure
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

            // 1. Agar hum individual restaurant page par hain (Jaise kfc.html)
            if (currentPageTag === data.restaurant) {
                const container = document.querySelector('.food-container') || document.querySelector('.menu-container');
                if (container) {
                    container.prepend(card);
                }
            }
            
            // 2. Agar hum main menu.html par hain
            else if (currentPageTag === "menu") {
                // Alag-alag options check karega taaki item kahan load hona hai miss na ho
                const targetSection = 
                    document.getElementById(data.restaurant + '-menu') || 
                    document.querySelector(`.${data.restaurant}-menu`) || 
                    document.querySelector(`[data-restaurant="${data.restaurant}"]`) ||
                    document.querySelector(`#${data.restaurant} .food-container`);

                if (targetSection) {
                    targetSection.prepend(card);
                } else {
                    // Fallback: Agar specific section na mile toh general menu container mein daal dega
                    const generalContainer = document.querySelector('.menu-container') || document.querySelector('.food-container');
                    if (generalContainer) {
                        generalContainer.prepend(card);
                    }
                }
            }
        });
    });
}
