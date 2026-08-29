import { db, auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_EMAIL = "akashkumar906552@gmail.com";

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
// 2. ORDERS DASHBOARD LOGIC
// ==========================================
const ordersTableBody = document.getElementById("ordersTableBody");

if (ordersTableBody) {
    const qOrders = query(collection(db, "orders"), orderBy("orderTime", "desc"));
    onSnapshot(qOrders, (snapshot) => {
        let revenue = 0, pending = 0, delivered = 0, total = snapshot.size;
        ordersTableBody.innerHTML = "";

        if (snapshot.empty) {
            ordersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No orders found.</td></tr>';
            updateKPIs(0, 0, 0, 0);
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;

            if (data.status === "Delivered") { revenue += Number(data.totalPrice || 0); delivered++; }
            if (data.status === "Pending") pending++;

            let statusClass = "admin-bg-pending";
            if (data.status === "Delivered") statusClass = "admin-bg-delivered";
            if (data.status === "Cancelled") statusClass = "admin-bg-cancelled";

            const row = `
                <tr>
                    <td><strong>${data.orderId || docId.substring(0,8)}</strong></td>
                    <td>${data.customerName || "Guest"}<br><small>${data.customerPhone || "N/A"}</small></td>
                    <td title="${data.items}" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.items || "No items"}</td>
                    <td>₹${data.totalPrice || 0}</td>
                    <td><small>${data.paymentMode || "COD"}</small></td>
                    <td><span class="admin-badge ${statusClass}">${data.status || "Pending"}</span></td>
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

        updateKPIs(total, revenue, pending, delivered);

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
    });
}

function updateKPIs(total, revenue, pending, delivered) {
    if (document.getElementById("totalOrders")) document.getElementById("totalOrders").innerText = total;
    if (document.getElementById("totalRevenue")) document.getElementById("totalRevenue").innerText = `₹ ${revenue}`;
    if (document.getElementById("pendingOrders")) document.getElementById("pendingOrders").innerText = pending;
    if (document.getElementById("deliveredOrders")) document.getElementById("deliveredOrders").innerText = delivered;
}

// ==========================================
// 3. MANAGE MENU: ADD & UPDATE LOGIC
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
        const description = document.getElementById("foodDesc").value.trim();
        const docId = editFoodId.value;

        if (!name || !price || !restaurant || !image) {
            alert("Please fill out all required fields.");
            return;
        }

        try {
            if (docId) {
                // Update Existing Item
                await updateDoc(doc(db, "menu", docId), {
                    name,
                    price: Number(price),
                    restaurant,
                    image,
                    description,
                    updatedAt: serverTimestamp()
                });
                alert("Menu item updated successfully!");
                resetMenuForm();
            } else {
                // Add New Item
                await addDoc(collection(db, "menu"), {
                    name,
                    price: Number(price),
                    restaurant,
                    image,
                    description,
                    createdAt: serverTimestamp()
                });
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
    menuForm.reset();
    editFoodId.value = "";
    if (menuSubmitBtn) {
        menuSubmitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add New Item';
        menuSubmitBtn.className = "admin-btn admin-btn-success";
    }
    if (cancelEditBtn) cancelEditBtn.style.display = "none";
}

// ==========================================
// 4. MANAGE MENU: LOAD, DELETE & EDIT LOGIC
// ==========================================
const menuTableBody = document.getElementById("menuTableBody");

if (menuTableBody) {
    const qMenu = query(collection(db, "menu"), orderBy("name"));
    
    onSnapshot(qMenu, (snapshot) => {
        menuTableBody.innerHTML = "";

        if (snapshot.empty) {
            menuTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No menu items found.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;

            const row = `
                <tr>
                    <td><img src="${data.image}" alt="${data.name}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px;"></td>
                    <td><strong>${data.name}</strong><br><small style="color:#777;">${data.description || ""}</small></td>
                    <td><span style="text-transform: uppercase; font-weight: 600; color: #ff5722;">${data.restaurant}</span></td>
                    <td>₹${data.price}</td>
                    <td>
                        <button class="admin-btn admin-btn-secondary edit-menu-btn" 
                            data-id="${docId}" 
                            data-name="${data.name}" 
                            data-price="${data.price}" 
                            data-restaurant="${data.restaurant}" 
                            data-image="${data.image}" 
                            data-desc="${data.description || ''}" 
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
    });

    // EVENT DELEGATION: Robust listener for Delete & Edit clicks
    menuTableBody.addEventListener("click", async (e) => {
        // DELETE BUTTON CLICKED
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

        // EDIT BUTTON CLICKED
        if (e.target.classList.contains("edit-menu-btn")) {
            const btn = e.target;
            editFoodId.value = btn.getAttribute("data-id");
            document.getElementById("foodName").value = btn.getAttribute("data-name");
            document.getElementById("foodPrice").value = btn.getAttribute("data-price");
            document.getElementById("foodRestaurant").value = btn.getAttribute("data-restaurant");
            document.getElementById("foodImage").value = btn.getAttribute("data-image");
            document.getElementById("foodDesc").value = btn.getAttribute("data-desc");

            if (menuSubmitBtn) {
                menuSubmitBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Update Item';
                menuSubmitBtn.className = "admin-btn admin-btn-primary";
            }
            if (cancelEditBtn) cancelEditBtn.style.display = "inline-block";

            // Scroll to form section smoothly
            document.getElementById("manage-menu-section").scrollIntoView({ behavior: 'smooth' });
        }
    });
}
