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

// Browser ka title padh kar pata lagayenge ki hum kis page par hain
const pageTitle = document.title.toLowerCase();
let currentPageTag = "";

if (pageTitle.includes("kfc")) currentPageTag = "kfc";
else if (pageTitle.includes("domino")) currentPageTag = "dominoes";
else if (pageTitle.includes("burger")) currentPageTag = "burgerking";
else if (pageTitle.includes("biryani")) currentPageTag = "biryanihouse";
else if (pageTitle.includes("menu")) currentPageTag = "menu";

// Agar hum sahi page par hain, toh Firebase se live data fetch karo
if (currentPageTag !== "") {
    onSnapshot(collection(db, "menu"), (snapshot) => {
        
        // Refresh hone par purane dynamic items hatao taaki duplicate na ho
        document.querySelectorAll('.firebase-dynamic-item').forEach(el => el.remove());

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // Same aapke purane HTML Card jaisa structure
            const card = document.createElement('div');
            card.className = 'menu-card firebase-dynamic-item';
            card.innerHTML = `
                <img src="${data.image}" alt="${data.name}">
                <h3>${data.name}</h3>
                <p>${data.description}</p>
                <div class="rating">⭐⭐⭐⭐⭐ 4.8</div>
                <h4>₹${data.price}</h4>
                <button type="button" class="add-to-cart" data-name="${data.name}" data-price="${data.price}" data-image="${data.image}">
                    Add to Cart
                </button>
            `;

            // 1. Agar hum individual restaurant (e.g., kfc.html) par hain
            if (currentPageTag === data.restaurant) {
                const container = document.querySelector('.menu-container');
                if (container) {
                    container.prepend(card); // List mein sabse upar add karega
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
