export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { orderId, amount, customerId, customerName, customerEmail, customerPhone } = req.body;

        const clientId = process.env.CASHFREE_CLIENT_ID;
        const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

        const orderData = {
            order_id: orderId,
            order_amount: amount,
            order_currency: "INR",
            customer_details: {
                customer_id: customerId,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone
            }
        };

        const response = await fetch("https://api.cashfree.com/pg/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-client-id": clientId,
                "x-client-secret": clientSecret,
                "x-api-version": "2022-09-01"
            },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || "Cashfree authentication or request failed" });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
