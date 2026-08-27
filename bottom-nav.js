// Mobile-only bottom navigation for quick access to the main FoodHub pages.
document.addEventListener("DOMContentLoaded", () => {
    const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    const activeSection = currentPage === "index.html" ? "home"
        : ["menu.html", "dominos.html", "kfc.html", "burgerking.html", "biryani.html"].includes(currentPage) ? "menu"
        : ["cart.html", "checkout.html"].includes(currentPage) ? "cart"
        : currentPage === "profile.html" ? "profile"
        : "";

    const navigation = document.createElement("nav");
    navigation.className = "mobile-bottom-nav";
    navigation.setAttribute("aria-label", "Mobile navigation");
    navigation.innerHTML = `
        <a href="index.html" data-section="home"><i class="fa-solid fa-house"></i><span>Home</span></a>
        <a href="menu.html" data-section="menu"><i class="fa-solid fa-utensils"></i><span>Menu</span></a>
        <a href="cart.html" data-section="cart" class="mobile-cart-link"><i class="fa-solid fa-bag-shopping"></i><b class="mobile-cart-count" hidden>0</b><span>Cart</span></a>
        <a href="profile.html" data-section="profile"><i class="fa-solid fa-user"></i><span>Profile</span></a>`;

    const activeLink = navigation.querySelector(`[data-section="${activeSection}"]`);
    if (activeLink) {
        activeLink.classList.add("active");
        activeLink.setAttribute("aria-current", "page");
    }

    document.body.appendChild(navigation);

    const updateCartCount = () => {
        let cart = [];
        try {
            cart = JSON.parse(localStorage.getItem("cart")) || [];
        } catch {
            cart = [];
        }

        const count = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        const badge = navigation.querySelector(".mobile-cart-count");
        if (!badge) return;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
    };

    updateCartCount();
    window.addEventListener("storage", updateCartCount);
    document.addEventListener("foodhub-cart-updated", updateCartCount);
    document.addEventListener("click", () => window.setTimeout(updateCartCount, 0));
    document.addEventListener("change", () => window.setTimeout(updateCartCount, 0));
});
