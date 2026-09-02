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
const rowsPerPage = 10; // Ek page par sirf 10 orders dikhenge

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

    // 1. Filter Data based on Search & Status
    const filteredOrders = allOrdersData.filter(order => {
        const orderId = (order.orderId || order.id).toLowerCase();
        const customerName = (order.customerName || "").toLowerCase();
        const customerPhone = (order.customerPhone || "").toLowerCase();
        
        const matchesSearch = orderId.includes(searchTerm) || customerName.includes(searchTerm) || customerPhone.includes(searchTerm);
        const matchesStatus = (statusFilter === "All") || (order.status === statusFilter);

        return matchesSearch && matchesStatus;
    });

    // 2. Pagination Calculation
    const totalPages = Math.ceil(filteredOrders.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * rowsPerPage;
    const paginatedData = filteredOrders.slice(start, start + rowsPerPage);

    // 3. Render Table Rows
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

    // Update Pagination UI Info
    const pageInfo = document.getElementById("pageInfo");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (pageInfo) pageInfo.innerText = `Page ${currentPage} of ${totalPages} (Total: ${filteredOrders.length} orders)`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    attachStatusChangeEvent();
}

// Search and Filter Event Listeners
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
// 3. MANAGE MENU: ADD & UPDATE LOGIC (With Rating)
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
        const restaurant = document.getElementById("foodRestaurant").value;
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
    if (cancelEditBtn) cancelEditBtn.style.display = "none";
}

// ==========================================
// 4. MANAGE MENU: LOAD, DELETE & EDIT LOGIC (Restaurant Filtered)
// ==========================================
const menuTableBody = document.getElementById("menuTableBody");
let allMenuItems = [];

if (menuTableBody) {
    const qMenu = query(collection(db, "menu"), orderBy("name"));
    
    onSnapshot(qMenu, (snapshot) => {
        allMenuItems = [];
        snapshot.forEach((docSnap) => {
            allMenuItems.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderMenuTable();
    });

    // Dropdown change hone par table update hogi
    document.getElementById("menuRestaurantFilter")?.addEventListener("change", () => {
        renderMenuTable();
    });
}

function renderMenuTable() {
    if (!menuTableBody) return;

    const selectedRestaurant = document.getElementById("menuRestaurantFilter")?.value || "All";
    
    // Filter items based on dropdown selection
    const filteredMenu = allMenuItems.filter(item => {
        if (selectedRestaurant === "All") return true;
        return item.restaurant === selectedRestaurant;
    });

    menuTableBody.innerHTML = "";

    if (filteredMenu.length === 0) {
        menuTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No menu items found for this restaurant.</td></tr>';
        return;
    }

    filteredMenu.forEach((data) => {
        const docId = data.id;

        const row = `
            <tr>
                <td><img src="${escapeHTML(data.image)}" alt="${escapeHTML(data.name)}" onerror="this.src='https://via.placeholder.com/45?text=No+Image'" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px;"></td>
                <td><strong>${escapeHTML(data.name)}</strong><br><small style="color:#777;">⭐ ${data.rating || 4.5} | ${escapeHTML(data.description || "")}</small></td>
                <td><span style="text-transform: uppercase; font-weight: 600; color: #ff5722;">${escapeHTML(data.restaurant)}</span></td>
                <td>₹${Number(data.price)}</td>
                <td>
                    <button class="admin-btn admin-btn-secondary edit-menu-btn" 
                        data-id="${docId}" 
                        data-name="${escapeHTML(data.name)}" 
                        data-price="${Number(data.price)}" 
                        data-restaurant="${escapeHTML(data.restaurant)}" 
                        data-image="${escapeHTML(data.image)}" 
                        data-rating="${data.rating || 4.5}" 
                        data-desc="${escapeHTML(data.description || '')}" 
                        style="padding: 5px 10px; font-size: 12px; margin-right: 5px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Edit
                    </button>
                    <button class="admin-btn admin-btn-danger delete-menu-btn" data-id="${docId}" 
                        style="padding: 5px 10px; font-size: 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Delete
                    </button>
                </td>
            </tr>
        `;
        menuTableBody.insertAdjacentHTML("beforeend", row);
    });
}

// EVENT DELEGATION: Robust listener for Delete & Edit clicks
if (menuTableBody) {
    menuTableBody.addEventListener("click", async (e) => {
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
            document.getElementById("foodRestaurant").value = btn.getAttribute("data-restaurant");
            document.getElementById("foodImage").value = btn.getAttribute("data-image");
            document.getElementById("foodRating").value = btn.getAttribute("data-rating");
            document.getElementById("foodDesc").value = btn.getAttribute("data-desc");

            if (menuSubmitBtn) {
                menuSubmitBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Update Item';
                menuSubmitBtn.className = "admin-btn admin-btn-primary";
            }
            if (cancelEditBtn) cancelEditBtn.style.display = "inline-block";

            document.getElementById("manage-menu-section").scrollIntoView({ behavior: 'smooth' });
        }
    });
}
