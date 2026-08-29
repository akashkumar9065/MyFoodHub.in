import { db } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ordersTableBody = document.getElementById("ordersTableBody");

// Firebase se orders ko real-time mein aur naye se purane ke kram (descending) mein lana
const q = query(collection(db, "orders"), orderBy("orderTime", "desc"));

onSnapshot(q, (snapshot) => {
    let revenue = 0;
    let pending = 0;
    let delivered = 0;
    let total = snapshot.size;

    ordersTableBody.innerHTML = "";

    if (snapshot.empty) {
        ordersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No orders found.</td></tr>';
        document.getElementById("totalOrders").innerText = 0;
        document.getElementById("totalRevenue").innerText = "₹ 0";
        document.getElementById("pendingOrders").innerText = 0;
        document.getElementById("deliveredOrders").innerText = 0;
        return;
    }

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;

        // KPI Calculations
        if (data.status === "Delivered") {
            revenue += Number(data.totalPrice || 0);
            delivered++;
        }
        if (data.status === "Pending") pending++;

        // Status Badge Styling
        let statusClass = "admin-bg-pending";
        if(data.status === "Delivered") statusClass = "admin-bg-delivered";
        if(data.status === "Cancelled") statusClass = "admin-bg-cancelled";

        // Table Row Render
        const row = `
            <tr>
                <td><strong>${data.orderId || docId.substring(0,8)}</strong></td>
                <td>${data.customerName}<br><small>${data.customerPhone}</small></td>
                <td title="${data.items}" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${data.items}
                </td>
                <td>₹${data.totalPrice}</td>
                <td><small>${data.paymentMode}</small></td>
                <td><span class="admin-badge ${statusClass}">${data.status}</span></td>
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

    // Update Dashboard Cards
    document.getElementById("totalOrders").innerText = total;
    document.getElementById("totalRevenue").innerText = `₹ ${revenue}`;
    document.getElementById("pendingOrders").innerText = pending;
    document.getElementById("deliveredOrders").innerText = delivered;

    // Dropdown change hone par Firebase mein status update karna
    document.querySelectorAll('.admin-status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const id = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            
            try {
                // Dropdown disable karein jab tak update ho raha ho
                e.target.disabled = true;
                await updateDoc(doc(db, "orders", id), { status: newStatus });
                // Note: onSnapshot apne aap naya data fetch kar lega aur dropdown wapas enable/refresh ho jayega
            } catch (error) {
                console.error("Error updating status:", error);
                alert("Failed to update status. Check your connection or permissions.");
                e.target.disabled = false;
            }
        });
    });
});
