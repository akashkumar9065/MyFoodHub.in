// Lightweight, reusable notification system for all FoodHub pages.
(() => {
    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation",
        info: "fa-circle-info"
    };

    function getContainer() {
        let container = document.querySelector(".toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "true");
            document.body.appendChild(container);
        }
        return container;
    }

    window.showToast = (message, type = "success") => {
        const toast = document.createElement("div");
        toast.className = `toast toast--${icons[type] ? type : "info"}`;
        toast.setAttribute("role", "status");
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" aria-hidden="true"></i><span></span><button type="button" aria-label="Dismiss notification"><i class="fa-solid fa-xmark"></i></button>`;
        toast.querySelector("span").textContent = message;
        toast.querySelector("button").addEventListener("click", () => toast.remove());
        getContainer().appendChild(toast);
        window.setTimeout(() => {
            toast.classList.add("is-leaving");
            window.setTimeout(() => toast.remove(), 220);
        }, 3500);
    };

    window.updateGlobalCartBadges = () => {
        let cart = [];
        try { cart = JSON.parse(localStorage.getItem("cart")) || []; } catch { cart = []; }
        const count = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        document.querySelectorAll('a[href="cart.html"]').forEach(link => {
            let badge = link.querySelector(".cart-count");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "cart-count";
                link.appendChild(badge);
            }
            badge.textContent = count > 99 ? "99+" : String(count);
            badge.hidden = count === 0;
        });
    };

    window.updateGlobalCartBadges();
    window.addEventListener("storage", window.updateGlobalCartBadges);
})();
