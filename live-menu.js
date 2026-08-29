import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 👇 APNA FIREBASE CONFIG YAHAN DAALEIN 👇
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
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
            
            // DHYAN DEIN: Yahan koi Delete Button nahi hai (Sirf Customer View)
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

            // 1. Agar hum individual restaurant (Jaise kfc.html) par hain
            if (currentPageTag === data.restaurant) {
                // Yeh code dono (food-container ya menu-container) dhoond lega!
                const container = document.querySelector('.food-container') || document.querySelector('.menu-container');
                if (container) {
                    container.prepend(card);
                }
            }
            
            // 2. Agar hum main menu.html par hain
            else if (currentPageTag === "menu") {
                const section = document.getElementById(data.restaurant + '-menu');
                if (section) {
                    section.prepend(card);
                }
            }
        });
    });
}
