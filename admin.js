import { db, auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_EMAIL = "akashkumar906552@gmail.com";

// ==========================================
// UTILITY: Safe HTML Escape
// ==========================================
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================
// 1. ADMIN AUTHENTICATION SECURITY GUARD
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email === ADMIN_EMAIL) {
            const emailDisplay = document.getElementById("adminEmailDisplay");
            if (emailDisplay) emailDisplay.innerText = user.email;
        } else {
            alert("Access Denied! You are not authorized as Admin.");
            window.location.href = "index.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

// Logout Button Logic
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to logout?")) {
            signOut(auth).then(() => {
                window.location.href = "login.html";
            });
        }
    });
}

// ==========================================
// 2. ORDERS DASHBOARD & PAGINATION LOGIC
// ==========================================
const ordersTableBody = document.getElementById("ordersTableBody");
let allOrdersData = [];
let currentPage = 1;
const rowsPerPage = 10;

if (ordersTableBody) {
    const qOrders = query(collection(db, "orders"), orderBy("orderTime", "desc"));
    onSnapshot(qOrders, (snapshot) => {
        allOrdersData = [];
        let revenue = 0, pending = 0, delivered = 0, total = snapshot.size;

        if (snapshot.empty) {
            ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No orders found.</td></tr>';
            updateKPIs(0, 0, 0, 0);
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            allOrdersData.push({ id: docId, ...data });

            if (data.status === "Delivered") { revenue += Number(data.totalPrice || 0); delivered++; }
            if (data.status === "Pending") pending++;
        });

        updateKPIs(total, revenue, pending, delivered);
        renderFilteredAndPaginatedOrders();
    });
}

function renderFilteredAndPaginatedOrders() {
    const searchTerm = document.getElementById("orderSearchInput")?.value.toLowerCase() || "";
    const statusFilter = document.getElementById("statusFilterSelect")?.value || "All";

    const filteredOrders = allOrdersData.filter(order => {
        const orderId = (order.orderId || order.id).toLowerCase();
        const customerName = (order.customerName || "").toLowerCase();
        const customerPhone = (order.customerPhone || "").toLowerCase();
        
        const matchesSearch = orderId.includes(searchTerm) || customerName.includes(searchTerm) || customerPhone.includes(searchTerm);
        const matchesStatus = (statusFilter === "All") || (order.status === statusFilter);

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredOrders.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * rowsPerPage;
    const paginatedData = filteredOrders.slice(start, start + rowsPerPage);

    ordersTableBody.innerHTML = "";
    if (paginatedData.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No matching orders found.</td></tr>';
    } else {
        paginatedData.forEach((data) => {
            const docId = data.id;
            let statusClass = "admin-bg-pending";
            if (data.status === "Delivered") statusClass = "admin-bg-delivered";
            if (data.status === "Cancelled") statusClass = "admin-bg-cancelled";

            const row = `
                <tr>
                    <td><strong>${escapeHTML(data.orderId || docId.substring(0,8))}</strong></td>
                    <td>${escapeHTML(data.customerName || "Guest")}<br><small>${escapeHTML(data.customerPhone || "N/A")}</small></td>
                    <td>
                        <div class="table-scroll-box" title="${escapeHTML(data.deliveryAddress || 'Not Provided')}">
                            📍 ${escapeHTML(data.deliveryAddress || "Address not provided")}
                        </div>
                    </td>
                    <td>
                        <div class="table-scroll-box">
                            🛒 ${escapeHTML(data.items || "No items")}
                        </div>
                    </td>
                    <td>₹${Number(data.totalPrice || 0)}</td>
                    <td><small>${escapeHTML(data.paymentMode || "COD")}</small></td>
                    <td><span class="admin-badge ${statusClass}">${escapeHTML(data.status || "Pending")}</span></td>
                    <td>
                        <select class="admin-status-select" data-id="${docId}">
                            <option value="Pending" ${data.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Cooking" ${data.status === 'Cooking' ? 'selected' : ''}>Cooking</option>
                            <option value="Out for Delivery" ${data.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${data.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${data.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                </tr>
            `;
            ordersTableBody.insertAdjacentHTML("beforeend", row);
        });
    }

    const pageInfo = document.getElementById("pageInfo");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (pageInfo) pageInfo.innerText = `Page ${currentPage} of ${totalPages} (Total: ${filteredOrders.length} orders)`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    attachStatusChangeEvent();
}

document.getElementById("orderSearchInput")?.addEventListener("input", () => { currentPage = 1; renderFilteredAndPaginatedOrders(); });
document.getElementById("statusFilterSelect")?.addEventListener("change", () => { currentPage = 1; renderFilteredAndPaginatedOrders(); });

document.getElementById("prevPageBtn")?.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderFilteredAndPaginatedOrders(); }
});
document.getElementById("nextPageBtn")?.addEventListener("click", () => {
    currentPage++; renderFilteredAndPaginatedOrders();
});

function updateKPIs(total, revenue, pending, delivered) {
    if (document.getElementById("totalOrders")) document.getElementById("totalOrders").innerText = total;
    if (document.getElementById("totalRevenue")) document.getElementById("totalRevenue").innerText = `₹ ${revenue}`;
    if (document.getElementById("pendingOrders")) document.getElementById("pendingOrders").innerText = pending;
    if (document.getElementById("deliveredOrders")) document.getElementById("deliveredOrders").innerText = delivered;
}

function attachStatusChangeEvent() {
    document.querySelectorAll('.admin-status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const id = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            try {
                e.target.disabled = true;
                await updateDoc(doc(db, "orders", id), { status: newStatus });
            } catch (error) {
                console.error("Error updating status:", error);
                e.target.disabled = false;
            }
        });
    });
}

// ==========================================
// 3. MANAGE RESTAURANTS & DYNAMIC DROPDOWNS
// ==========================================
const restaurantForm = document.getElementById("restaurantForm");
const foodRestaurantSelect = document.getElementById("foodRestaurant");

if (restaurantForm) {
    restaurantForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("restName").value.trim();
        const slug = document.getElementById("restSlug").value.trim().toLowerCase();
        const image = document.getElementById("restBanner").value.trim();
        const rating = document.getElementById("restRating").value.trim();
        const reviews = document.getElementById("restReviews").value.trim();
        const deliveryTime = document.getElementById("restTime").value.trim();

        if (!name || !slug || !image) {
            alert("Please fill out all required fields.");
            return;
        }

        try {
            await addDoc(collection(db, "restaurants"), {
                name,
                slug,
                image,
                rating: Number(rating),
                reviews,
                deliveryTime,
                createdAt: serverTimestamp()
            });

            alert("Restaurant and Banner added successfully!");
            restaurantForm.reset();
        } catch (error) {
            console.error("Error adding restaurant: ", error);
            alert("Failed to add restaurant.");
        }
    });
}

function loadDynamicDropdowns() {
    const qRest = query(collection(db, "restaurants"), orderBy("name"));
    
    onSnapshot(qRest, (snapshot) => {
        if (foodRestaurantSelect) {
            foodRestaurantSelect.innerHTML = '<option value="">Select Restaurant...</option>';
        }

        if (snapshot.empty) return;

        snapshot.forEach((docSnap) => {
            const rest = docSnap.data();
            const restSlug = rest.slug;
            const restName = rest.name;

            if (foodRestaurantSelect) {
                const opt = document.createElement("option");
                opt.value = restSlug;
                opt.textContent = restName;
                foodRestaurantSelect.appendChild(opt);
            }
        });
    });
}

loadDynamicDropdowns();

// ==========================================
// 4. MANAGE MENU: ADD & UPDATE LOGIC
// ==========================================
const menuForm = document.getElementById("menuForm");
const editFoodId = document.getElementById("editFoodId");
const menuSubmitBtn = document.getElementById("menuSubmitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

if (menuForm) {
    menuForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("foodName").value.trim();
        const price = document.getElementById("foodPrice").value.trim();
        const restaurant = document.getElementById("foodRestaurant").value.trim().toLowerCase();
        const image = document.getElementById("foodImage").value.trim();
        const rating = document.getElementById("foodRating").value.trim();
        const description = document.getElementById("foodDesc").value.trim();
        const docId = editFoodId.value;

        if (!name || !price || !restaurant || !image) {
            alert("Please fill out all required fields.");
            return;
        }

        const foodPayload = {
            name,
            price: Number(price),
            restaurant,
            image,
            rating: rating ? Number(rating) : 4.5,
            description
        };

        try {
            if (docId) {
                foodPayload.updatedAt = serverTimestamp();
                await updateDoc(doc(db, "menu", docId), foodPayload);
                alert("Menu item updated successfully!");
                resetMenuForm();
            } else {
                foodPayload.createdAt = serverTimestamp();
                await addDoc(collection(db, "menu"), foodPayload);
                alert("New menu item added successfully!");
                menuForm.reset();
            }
        } catch (error) {
            console.error("Error saving menu item: ", error);
            alert("Operation failed. Check console.");
        }
    });
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        resetMenuForm();
    });
}

function resetMenuForm() {
    if (menuForm) menuForm.reset();
    if (editFoodId) editFoodId.value = "";
    if (menuSubmitBtn) {
        menuSubmitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add New Item';
        menuSubmitBtn.className = "admin-btn admin-btn-success";
    }
    if (document.getElementById("formTitle")) document.getElementById("formTitle").innerText = "Add New Food Item";
    if (cancelEditBtn) cancelEditBtn.style.display = "none";
}

// ==========================================
// 5. RESTAURANT-WISE MENU DISPLAY & COLLAPSE / EXPAND SYSTEM
// ==========================================
const restaurantWiseMenuContainer = document.getElementById("restaurantWiseMenuContainer");
let allRestaurantsData = [];
let allMenuItemsData = [];

if (restaurantWiseMenuContainer) {
    // Real-time listener for Restaurants
    onSnapshot(query(collection(db, "restaurants"), orderBy("name")), (restSnap) => {
        allRestaurantsData = [];
        restSnap.forEach((docSnap) => {
            allRestaurantsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderRestaurantWiseMenu();
    });

    // Real-time listener for Menu Items
    onSnapshot(query(collection(db, "menu"), orderBy("name")), (menuSnap) => {
        allMenuItemsData = [];
        menuSnap.forEach((docSnap) => {
            allMenuItemsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderRestaurantWiseMenu();
    });
}

function renderRestaurantWiseMenu() {
    if (!restaurantWiseMenuContainer) return;

    if (allRestaurantsData.length === 0) {
        restaurantWiseMenuContainer.innerHTML = '<p style="text-align:center; color:#777; padding: 20px;">No restaurants found. Please add a restaurant first.</p>';
        return;
    }

    restaurantWiseMenuContainer.innerHTML = "";

    allRestaurantsData.forEach((rest) => {
        const restSlug = rest.slug.toLowerCase();
        
        // Match items case-insensitively with restaurant slug
        const matchedItems = allMenuItemsData.filter(item => 
            item.restaurant && item.restaurant.toLowerCase() === restSlug
        );

        let itemsHTML = "";
        if (matchedItems.length === 0) {
            itemsHTML = `<tr><td colspan="4" style="text-align:center; color:#888; padding: 15px;">No food items added for this restaurant yet.</td></tr>`;
        } else {
            matchedItems.forEach(item => {
                itemsHTML += `
                    <tr>
                        <td style="width: 60px;"><img src="${escapeHTML(item.image)}" alt="" onerror="this.src='https://via.placeholder.com/40?text=Img'" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px;"></td>
                        <td><strong>${escapeHTML(item.name)}</strong><br><small style="color:#666;">⭐ ${item.rating || 4.5} | ${escapeHTML(item.description || '')}</small></td>
                        <td><strong>₹${Number(item.price)}</strong></td>
                        <td style="text-align: right;">
                            <button class="admin-btn admin-btn-secondary edit-menu-btn" 
                                data-id="${item.id}" 
                                data-name="${escapeHTML(item.name)}" 
                                data-price="${item.price}" 
                                data-restaurant="${escapeHTML(item.restaurant)}" 
                                data-image="${escapeHTML(item.image)}" 
                                data-rating="${item.rating || 4.5}" 
                                data-desc="${escapeHTML(item.description || '')}"
                                style="padding: 5px 10px; font-size: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;">
                                Edit
                            </button>
                            <button class="admin-btn admin-btn-danger delete-menu-btn" data-id="${item.id}" 
                                style="padding: 5px 10px; font-size: 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Delete
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        // Restaurant Card Structure with Dropdown Toggle (Without Close / View Button)
        const cardHTML = `
            <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="background: #f8f9fa; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd;">
                    <div style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex-grow: 1;" onclick="const body = document.getElementById('menu-body-${restSlug}'); const icon = document.getElementById('icon-${restSlug}'); if(body.style.display === 'none'){ body.style.display='block'; icon.className='fa-solid fa-chevron-up'; } else { body.style.display='none'; icon.className='fa-solid fa-chevron-down'; }">
                        <img src="${escapeHTML(rest.image)}" alt="" onerror="this.src='https://via.placeholder.com/40?text=Rest'" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;">
                        <h4 style="margin: 0; color: #333; font-size: 18px;">${escapeHTML(rest.name)} <span style="font-size: 13px; color: #666; font-weight: normal;">(${matchedItems.length} items)</span></h4>
                        <i id="icon-${restSlug}" class="fa-solid fa-chevron-down" style="margin-left: 10px; color: #666; font-size: 14px;"></i>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button type="button" onclick="document.getElementById('foodRestaurant').value='${rest.slug}'; document.getElementById('formTitle').innerText='Add Item to ${escapeHTML(rest.name)}'; document.getElementById('manage-menu-section').scrollIntoView({behavior: 'smooth'});" style="background: #28a745; color: white; border: none; padding: 8px 14px; border-radius: 4px; font-size: 13px; cursor: pointer;">
                            <i class="fa-solid fa-plus"></i> Add Item
                        </button>
                    </div>
                </div>
                <div id="menu-body-${restSlug}" style="padding: 0 15px; display: none;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        restaurantWiseMenuContainer.insertAdjacentHTML("beforeend", cardHTML);
    });
}

// EVENT DELEGATION: Delete & Edit clicks inside Restaurant-Wise Menu Cards
if (restaurantWiseMenuContainer) {
    restaurantWiseMenuContainer.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-menu-btn")) {
            const id = e.target.getAttribute("data-id");
            if (confirm("Are you sure you want to delete this food item?")) {
                try {
                    await deleteDoc(doc(db, "menu", id));
                    alert("Item deleted successfully!");
                } catch (err) {
                    console.error("Delete error:", err);
                    alert("Failed to delete item.");
                }
            }
        }

        if (e.target.classList.contains("edit-menu-btn")) {
            const btn = e.target;
            editFoodId.value = btn.getAttribute("data-id");
            document.getElementById("foodName").value = btn.getAttribute("data-name");
            document.getElementById("foodPrice").value = btn.getAttribute("data-price");
            document.getElementById("foodRestaurant").value = btn.getAttribute("data-restaurant").toLowerCase();
            document.getElementById("foodImage").value = btn.getAttribute("data-image");
            document.getElementById("foodRating").value = btn.getAttribute("data-rating");
            document.getElementById("foodDesc").value = btn.getAttribute("data-desc");

            if (menuSubmitBtn) {
                menuSubmitBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Update Item';
                menuSubmitBtn.className = "admin-btn admin-btn-primary";
            }
            if (document.getElementById("formTitle")) document.getElementById("formTitle").innerText = "Edit Food Item";
            if (cancelEditBtn) cancelEditBtn.style.display = "inline-block";

            document.getElementById("manage-menu-section").scrollIntoView({ behavior: 'smooth' });
        }
    });
}
