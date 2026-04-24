const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const User = require("../../models/User");
const Expense = require("../../models/Expense");
const Transaction = require("../../models/Transaction");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const sendNotification = require("../../utils/sendNotification");
const Notification = require("../../models/Notification");
const NormalDeal = require("../../models/NormalDeal");
const Deal24Hr = require("../../models/24HrDeal");
const Drop = require("../../models/FruitDrop");
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const mongoose = require("mongoose");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
});

// =========================================================
//    HELPER: ATOMIC SUCCESS LOGIC (Fixed for Cron Loop)
// =========================================================
const finalizeSuccessfulOrder = async (orderId, paymentId, signature, externalSession = null) => {
    const session = externalSession || await mongoose.startSession();
    if (!externalSession) session.startTransaction();

    try {
        // 1. Order lock aur status update (Double processing rokne ke liye)
        const order = await Order.findOneAndUpdate(
            { _id: orderId, isPaymentFinalized: false },
            { 
                $set: { 
                    razorpayPaymentId: paymentId, 
                    razorpaySignature: signature || "verified"
                } 
            },
            { session, new: true }
        );

        if (!order) {
            if (!externalSession) await session.abortTransaction();
            return { alreadyProcessed: true };
        }

        // 2. Items Processing
        for (const item of order.items) {
            let sellerId = item.seller;

            // 🔥 FIX: Pehle "Effective Price" (Asli Kimat) nikaalo discount katne ke baad
            // Agar discount 0 hai, toh ye hamesha original price hi rakhega.
            const effectivePrice = item.price - (item.price * (item.discount / 100));
            
            // Item ka total revenue (Price Paid * Quantity)
            const itemTotalRevenue = Math.round(effectivePrice * item.quantity);

            // --- SELLER SETTLEMENT (90% of Effective Price) ---
            // Ab seller ko wahi milega jo customer ne pay kiya uska 90%
            const sellerEarnings = Math.round(itemTotalRevenue * 0.90); 

            // Seller ke Pending Balance mein sahi paisa add karo
            await User.findByIdAndUpdate(sellerId, { $inc: { pendingBalance: sellerEarnings } }, { session });

            // Seller ki Transaction entry (Status ON_HOLD)
            await Transaction.create([{
                user: sellerId, 
                orderId: order._id, 
                amount: sellerEarnings,
                type: "CREDIT", 
                description: `Sale: ${item.title} (Price: ${item.price}, Discount: ${item.discount}%)`,
                status: "ON_HOLD", 
                paymentGateway: "SYSTEM"
            }], { session });

            // Buyer ke kharche ka record (Expense Tracker mein Discounted Price hi dikhao)
            await Expense.create([{
                user: order.user, 
                title: `Item: ${item.title}`, 
                amount: itemTotalRevenue,
                category: "Shopping", 
                paymentMethod: order.paymentMethod === 'WALLET' ? 'WALLET' : 'ONLINE',
                expenseDate: new Date()
            }], { session });
        }

        // 3. Finalize Order Status
        order.paymentStatus = "PAID";
        order.orderStatus = "Processing";
        order.isPaymentFinalized = true;
        order.reservationExpiry = null; 
        order.deliveryFee = 0; 
        await order.save({ session });

        // 4. Buyer Transaction Log (Debit)
        await Transaction.create([{
            user: order.user, 
            orderId: order._id, 
            amount: order.totalAmount, // Ye total amount wahi hai jo Checkout ke waqt pay hua
            type: "DEBIT", 
            description: `Order Payment #${order._id.toString().slice(-6).toUpperCase()}`,
            status: "SUCCESS", 
            paymentGateway: order.paymentMethod === 'WALLET' ? 'WALLET' : 'RAZORPAY',
            gatewayTransactionId: paymentId
        }], { session });

        // 5. Referral & Gamification Rewards (Pehle jaisa hi hai)
        const dropsEarned = Math.floor(order.totalAmount / 10);
        const buyer = await User.findById(order.user).session(session);

        if (buyer.referredBy && !buyer.isFirstOrderDone) {
            await User.findByIdAndUpdate(buyer.referredBy, { $inc: { walletBalance: 50 } }, { session });
            await Transaction.create([{
                user: buyer.referredBy, 
                amount: 50, 
                type: "CREDIT",
                description: `Referral Bonus from ${buyer.name}`, 
                status: "SUCCESS"
            }], { session });
        }

        await User.findByIdAndUpdate(order.user, { 
            $inc: { "game.waterDrops": dropsEarned }, 
            $set: { isFirstOrderDone: true } 
        }, { session });

        // Clear user cart
        await Cart.findOneAndDelete({ user: order.user }).session(session);
        
        if (!externalSession) await session.commitTransaction();
        
        sendNotification(order.user, "Order Confirmed! 🎉", "Your items are being packed. Seller will dispatch soon.", "ORDER");
        
        return order;

    } catch (err) {
        if (!externalSession) await session.abortTransaction();
        console.error(`Finalize Error: ${err.message}`);
        throw err; 
    } finally {
        if (!externalSession) session.endSession();
    }
};
// =========================================================
// API 1: CREATE ORDER
// =========================================================
exports.createOrder = async (req, res) => {
    // 1. Session Start karo atomicity ke liye
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user._id || req.user.id;
        const { paymentMethod, shippingAddress } = req.body;

        const cart = await Cart.findOne({ user: userId }).session(session);
        if (!cart || cart.items.length === 0) {
            throw new Error("Cart empty");
        }

        // --- STEP 2: STOCK RESERVATION (Race Condition Fix) ---
        for (const item of cart.items) {
            let actualProductId = null;

            // Deal type ke hisaab se Product ID nikaalo
            if (item.itemType === "NormalDeal") {
                const deal = await NormalDeal.findById(item.itemId).session(session);
                if (deal) actualProductId = deal.product;
            } else if (item.itemType === "24HrDeal") {
                const deal = await Deal24Hr.findById(item.itemId).session(session);
                if (deal) actualProductId = deal.product;
            } else if (item.itemType === "Drop") {
                const drop = await Drop.findById(item.itemId).session(session);
                if (drop) actualProductId = drop.product;
            }

            if (!actualProductId) actualProductId = item.itemId;

            // Atomic Stock Check aur Deduction
            // Agar remaining stock item.quantity se kam hai, toh ye null return karega
            const inventory = await Inventory.findOneAndUpdate(
                { 
                    product: actualProductId, 
                    seller: item.seller, 
                    remaining: { $gte: item.quantity } 
                },
                { $inc: { remaining: -item.quantity, sold: item.quantity } },
                { session, new: true }
            );

            if (!inventory) {
                throw new Error(`Out of Stock: ${item.title}`);
            }
        }

        // --- STEP 3: ORDER CREATION ---
        const order = new Order({
            user: userId, 
            items: cart.items, 
            totalAmount: cart.totalAmount,
            shippingAddress, 
            subtotal: cart.subtotal, 
            deliveryFee: cart.deliveryFee,
            paymentMethod, 
            paymentStatus: "PENDING", 
            orderStatus: "Pending",
            isStockReserved: true, // Mark kar rahe hain ki stock kat chuka hai
            reservationExpiry: new Date(Date.now() + 15 * 60 * 1000) // 15 Min lock
        });

        // --- STEP 4: PAYMENT METHOD HANDLING ---

        // A. WALLET PAYMENT
        if (paymentMethod === "WALLET") {
            const user = await User.findOneAndUpdate(
                { _id: userId, walletBalance: { $gte: cart.totalAmount } },
                { $inc: { walletBalance: -cart.totalAmount } },
                { session, new: true }
            );

            if (!user) throw new Error("Insufficient Balance");

            await order.save({ session });
            
            // finalizeSuccessfulOrder ko session pass karna zaroori hai
            // Note: finalizeSuccessfulOrder ke andar se stock deduction wala code hata dena 
            // kyunki hum upar kar chuke hain.
            await finalizeSuccessfulOrder(order._id, `WALLET_${order._id}`, "wallet_pay", session);

            await session.commitTransaction();
            session.endSession();
            return res.status(201).json({ success: true, message: "Wallet Order Placed", orderId: order._id });
        }

        // B. COD PAYMENT
        if (paymentMethod === "COD") {
            order.orderStatus = "Processing";
            order.isPaymentFinalized = true;
            order.reservationExpiry = null; // COD hai toh lock ki zaroorat nahi
            await order.save({ session });
            await Cart.findOneAndDelete({ user: userId }).session(session);
            
            await session.commitTransaction();
            session.endSession();
            return res.status(201).json({ success: true, message: "COD Order Placed", orderId: order._id });
        }

        // C. ONLINE PAYMENT
        if (paymentMethod === "ONLINE") {
            const rzpOrder = await razorpay.orders.create({
                amount: Math.round(cart.totalAmount * 100),
                currency: "INR",
                receipt: order._id.toString()
            });
            order.razorpayOrderId = rzpOrder.id;
            await order.save({ session });
            
            await session.commitTransaction();
            session.endSession();
            
            return res.json({ 
                success: true, 
                orderId: order._id, 
                razorpayOrderId: rzpOrder.id, 
                amount: rzpOrder.amount, 
                key: process.env.RAZORPAY_KEY_ID 
            });
        }

    } catch (err) {
        
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Create Order Error:", err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};
// =========================================================
// API: CANCEL ORDER (Atomic Restock & Reversal)
// =========================================================
exports.cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user._id || req.user.id;
        const { orderId } = req.body;

        const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
        if (!order) throw new Error("Order nahi mila.");

        // 1. LOGISTICS CHECK: Multi-vendor safety
        const isAnyItemShipped = order.items.some(item => 
            ["Shipped", "Delivered", "Return_Requested", "Picked_Up"].includes(item.status)
        );

        if (order.orderStatus === "Cancelled" || isAnyItemShipped) {
            throw new Error("Order cancel nahi ho sakta (Maal nikal chuka hai ya pehle cancel ho gaya).");
        }

        // 2. 24 HOUR WINDOW CHECK
        const diffInHours = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60);
        if (diffInHours > 24) throw new Error("Cancellation window (24 hours) khatam ho chuki hai.");

        // --- STEP 1: INVENTORY RESTOCK & ITEM STATUS ---
        for (const item of order.items) {
            let actualProductId = null;
            // Deal types handle karo
            if (item.itemType === "NormalDeal") {
                const deal = await NormalDeal.findById(item.itemId).session(session);
                if (deal) actualProductId = deal.product;
            } else if (item.itemType === "24HrDeal") {
                const deal = await Deal24Hr.findById(item.itemId).session(session);
                if (deal) actualProductId = deal.product;
            } else if (item.itemType === "Drop") {
                const drop = await Drop.findById(item.itemId).session(session);
                if (drop) actualProductId = drop.product;
            }
            if (!actualProductId) actualProductId = item.itemId;

            // Stock Seller-wise wapas badhao
            await Inventory.findOneAndUpdate(
                { product: actualProductId, seller: item.seller },
                { $inc: { remaining: item.quantity, sold: -item.quantity } },
                { session }
            );
            item.status = "Cancelled";
        }

        // --- STEP 2: MULTI-VENDOR SELLER REVERSAL ---
        const sellerTxns = await Transaction.find({ orderId: order._id, type: "CREDIT", status: "ON_HOLD" }).session(session);

        for (const txn of sellerTxns) {
            // Seller ke pending balance se paisa kaato
            await User.findByIdAndUpdate(txn.user, { $inc: { pendingBalance: -txn.amount } }, { session });

            txn.status = "CANCELLED";
            txn.description = `Reversal: Order #${order._id.toString().slice(-6).toUpperCase()} Cancelled`;
            await txn.save({ session });
        }

        // --- STEP 3: REWARD REVERSAL (Fraud Protection) ---
        const buyer = await User.findById(userId).session(session);
        
        // A. Water Drops wapas lo
        const dropsToDeduct = Math.floor(order.totalAmount / 10);
        await User.findByIdAndUpdate(userId, { $inc: { "game.waterDrops": -dropsToDeduct } }, { session });

        // B. Referral Bonus Reversal (Agar referrer ko ₹50 mile the toh kaato)
        if (buyer.referredBy && buyer.isFirstOrderDone) {
            // Referrer dhoondo aur ₹50 minus karo
            await User.findByIdAndUpdate(buyer.referredBy, { $inc: { walletBalance: -50 } }, { session });
            
            // Transaction record for Reversal
            await Transaction.create([{
                user: buyer.referredBy,
                amount: 50,
                type: "DEBIT",
                description: `Referral Bonus Reversal: ${buyer.name} cancelled order`,
                status: "SUCCESS"
            }], { session });
        }

        // --- STEP 4: CUSTOMER REFUND (100%) ---
        if (order.paymentStatus === "PAID") {
            await User.findByIdAndUpdate(userId, { $inc: { walletBalance: order.totalAmount } }, { session });
            await Transaction.create([{
                user: userId,
                orderId: order._id,
                amount: order.totalAmount,
                type: "CREDIT",
                description: `Refund: Order #${order._id.toString().slice(-6).toUpperCase()} Cancelled`,
                status: "SUCCESS",
                paymentGateway: "WALLET"
            }], { session });
        }

        // --- STEP 5: FINALIZE ---
        order.orderStatus = "Cancelled";
        await order.save({ session });

        await session.commitTransaction();
        res.status(200).json({ success: true, message: "Order cancelled and rewards reversed." });

    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(400).json({ success: false, message: err.message });
    } finally {
        session.endSession();
    }
};
 

exports.verifyPayment = async (req, res) => {
    try {
        const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");

        if (expectedSignature !== razorpay_signature) return res.status(400).json({ success: false, message: "Invalid Signature" });

        const order = await Order.findOne({ _id: orderId, razorpayOrderId: razorpay_order_id });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.isPaymentFinalized) return res.status(200).json({ success: true, orderId: order._id });

        await finalizeSuccessfulOrder(order._id, razorpay_payment_id, razorpay_signature);
        res.status(200).json({ success: true, message: "Payment Successful!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.handleWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    try {
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
        shasum.update(JSON.stringify(req.body));
        if (shasum.digest('hex') !== signature) return res.status(400).send('Invalid');

        const event = req.body.event;
        const payload = req.body.payload;

        if (event === 'payment.captured') {
            const rzpPayment = payload.payment.entity;
            const rzpOrderId = rzpPayment.order_id;
            const rzpPaymentId = rzpPayment.id;

            const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
            if (order && !order.isPaymentFinalized) {
                await finalizeSuccessfulOrder(order._id, rzpPaymentId, "webhook_verified");
            }
        }
        res.json({ status: 'ok' });
    } catch (err) {
        res.status(500).send('Failed');
    }
};

exports.syncPendingOrders = async (req, res) => {
    try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const pendingOrders = await Order.find({
            paymentMethod: "ONLINE", paymentStatus: "PENDING",
            razorpayOrderId: { $exists: true }, createdAt: { $lte: tenMinutesAgo }
        });

        for (const order of pendingOrders) {
            try {
                const rzpOrders = await razorpay.orders.fetchPayments(order.razorpayOrderId);
                const success = rzpOrders.items.find(pay => pay.status === 'captured');
                if (success) await finalizeSuccessfulOrder(order._id, success.id, "cron_reconciled");
            } catch (e) { console.error(`Sync error for ${order._id}:`, e.message); }
        }
        if (res) res.json({ success: true });
    } catch (err) {
        if (res) res.status(500).json({ success: false });
    }
};

// --- GETTERS ---
// controllers/Api/orderControllerApi.js mein getMyOrders badlo

exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        const orders = await Order.find({ user: userId })
            // 🔥 DHAYAN SE DEKHO: items ke andar wale otp ko select karna hai
            .select("+items.deliveryDetails.otp +items.returnDetails.pickupOTP") 
            .sort({ createdAt: -1 });

        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.markPaymentFailed = async (req, res) => {
    try {
        const { orderId } = req.body;
        await Order.updateOne({ _id: orderId, paymentStatus: "PENDING" }, { paymentStatus: "FAILED", orderStatus: "Payment_Failed" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// --- AUTO REFUND HELPER (Final fix for the Loop) ---
const handleAutoRefund = async (orderId, paymentId) => {
    const refundSession = await mongoose.startSession();
    refundSession.startTransaction();
    try {
        const refundTxnId = `REFUND_${paymentId}`;

        // 1. Pehle check karo kya ye transaction pehle hi ban chuki hai?
        // Isse Duplicate Key Error (E11000) aana band ho jayega
        const existingTxn = await Transaction.findOne({ gatewayTransactionId: refundTxnId }).session(refundSession);

        if (existingTxn) {
            // Agar refund pehle hi ho chuka hai, toh bas Order ko Cancel mark karo 
            // taaki Cron Job loop mein na phanse
            await Order.findByIdAndUpdate(orderId, { 
                orderStatus: "Cancelled", 
                paymentStatus: "REFUNDED",
                isPaymentFinalized: true 
            }).session(refundSession);

            await refundSession.commitTransaction();
            
            return;
        }

        // 2. Agar naya refund hai, toh original logic chalao
        const order = await Order.findById(orderId).session(refundSession);
        if (!order) throw new Error("Order not found");

        // Order block karo
        order.orderStatus = "Cancelled";
        order.paymentStatus = "REFUNDED";
        order.isPaymentFinalized = true; // 👈 Ye Cron Job ko rokne ke liye zaroori hai
        await order.save({ session: refundSession });

        // User ka balance wapas karo
        await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: order.totalAmount } }, { session: refundSession });

        // Transaction record banao
        await Transaction.create([{
            user: order.user,
            orderId: order._id,
            amount: order.totalAmount,
            type: "CREDIT",
            description: "Auto-Refund: Items Out of Stock",
            status: "SUCCESS",
            gatewayTransactionId: refundTxnId
        }], { session: refundSession });

        await refundSession.commitTransaction();
        sendNotification(order.user, "Order Refunded 💸", "Item out of stock. Refund added to wallet.", "ORDER");
    } catch (e) { 
        await refundSession.abortTransaction(); 
        console.error("Auto-Refund Error:", e.message);
    } finally { 
        refundSession.endSession(); 
    }
};



 
exports.verifyDeliveryOTP = async (req, res) => {
    try {
        const { orderId, otp, sellerId } = req.body; // 🔥 Naya: sellerId bhi bhejni hogi link se
        const Order = require("../../models/Order");
        const Transaction = require("../../models/Transaction");

        // select items.deliveryDetails.otp because it's hidden in schema
        const order = await Order.findById(orderId).select("+items.deliveryDetails.otp");

        if (!order) return res.status(404).json({ success: false, message: "Order not found!" });

        // 🔥 Logic: Sirf us seller ke items dhoondo jiska dabba deliver ho raha hai
        let sellerItems = order.items.filter(it => it.seller.toString() === sellerId.toString());

        if (sellerItems.length === 0) {
            return res.status(404).json({ success: false, message: "Seller items not found." });
        }

        // OTP Check (Pehle item ka OTP check kar lo kyunki saare items ek hi dappe mein honge us seller ke)
        if (sellerItems[0].deliveryDetails.otp !== otp) {
            return res.status(400).json({ success: false, message: "Wrong OTP" });
        }

        // Status Update: Sirf is seller ke items ko "Delivered" mark karo
        sellerItems.forEach(item => {
            item.status = "Delivered";
            item.deliveryDetails.deliveredAt = new Date();
        });

        //Agar saare sellers ke saare items deliver ho gaye, toh main status "Delivered" karo
        const allDelivered = order.items.every(it => it.status === "Delivered");
        if (allDelivered) {
            order.orderStatus = "Delivered";
        }

        await order.save();

        //15-DAY TIMER TRIGGER (Sirf is specific seller ke liye)
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + 15);

        await Transaction.updateMany(
            { orderId: order._id, user: sellerId, type: "CREDIT", status: "ON_HOLD" },
            { $set: { releaseDate: releaseDate } }
        );

        res.status(200).json({ success: true, message: "Delivery Verified" });

    } catch (err) {
        console.error("OTP VERIFY ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
 // controllers/Api/orderControllerApi.js

exports.requestReturn = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const Order = require("../../models/Order");

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found!" });

        // 1. Find the specific item in the items array
        const item = order.items.find(it => it.itemId.toString() === itemId.toString());
        if (!item) return res.status(404).json({ success: false, message: "Item notfound!" });

        // 🔥 CRITICAL FIX: Check item-level delivery status
        // Ab hum poore order ka status nahi dekhenge, sirf is item ka status dekhenge
        if (item.status !== "Delivered") {
            return res.status(400).json({ 
                success: false, 
                message: "Return unavailable before delivery" 
            });
        }

        // 2. 7 Days Window Check (Specific item ki delivery date se)
        //Agar item-level date nahi hai toh global date se check karo
        const deliveredDate = item.deliveryDetails?.deliveredAt || order.deliveryDetails?.deliveredAt;
        
        if (!deliveredDate) {
             return res.status(400).json({ success: false, message: "Delivery date record not found." });
        }

        const diffDays = Math.ceil((new Date() - new Date(deliveredDate)) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
            return res.status(400).json({ success: false, message: "7-day return policy is over." });
        }

        // 3. Update Statuses
        item.status = "Return_Requested";
        
        // Order ka global status "Return_Requested" hi rakho (taaki seller dashboard alert rahe)
        order.orderStatus = "Return_Requested"; 

        // Global returnDetails record (current session ke liye)
        order.returnDetails.status = "REQUESTED";
        order.returnDetails.reason = reason;
        order.returnDetails.requestedAt = new Date();

        // Mongoose ko batao ki array ke andar change hua hai
        order.markModified('items');
        await order.save();

        res.json({ success: true, message: "Is item ke liye return request submit ho gayi!" });

    } catch (err) {
        console.error("RETURN PROCESS ERROR:", err);
        res.status(500).json({ success: false, message: "Server Error: " + err.message });
    }
};
// controllers/Api/orderControllerApi.js
// controllers/Api/orderControllerApi.js

// controllers/Api/orderControllerApi.js

exports.confirmReceiptByCustomer = async (req, res) => {
    try {
        const { orderId, sellerId } = req.body; // 🔥 Next.js ab sellerId bhi bhejega
        const userId = req.user._id || req.user.id;

        const Order = require("../../models/Order");
        const Transaction = require("../../models/Transaction");

        // 1. Order dhundo aur check karo ki ye isi user ka hai
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found!" });

        // 2. Filter items belonging to THIS seller
        let sellerItems = order.items.filter(it => it.seller.toString() === sellerId.toString());

        if (sellerItems.length === 0) {
            return res.status(400).json({ success: false, message: "No items from this seller in this order." });
        }

        // 3. Check status (Sirf Shipped items hi confirm ho sakte hain)
        const canConfirm = sellerItems.some(it => it.status === "Shipped");
        if (!canConfirm) {
            return res.status(400).json({ success: false, message: "Your order is not on its way yet." });
        }

        // 4. ✅ Update items for THIS seller only
        sellerItems.forEach(item => {
            item.status = "Delivered";
            item.deliveryDetails.deliveredAt = new Date();
        });

        //  Global Status Logic: Agar saare sellers ke saare items deliver ho gaye, 
        // toh main Order Status ko bhi "Delivered" kar do
        const allItemsDelivered = order.items.every(it => it.status === "Delivered");
        if (allItemsDelivered) {
            order.orderStatus = "Delivered";
        }

        await order.save();

        // 5. 15 DIN KA PAYOUT TIMER (Sirf is specific seller ke liye)
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + 15);

        await Transaction.updateMany(
            { 
                orderId: order._id, 
                user: sellerId, //   Important: Sirf is seller ka paisa trigger karo
                type: "CREDIT", 
                status: "ON_HOLD" 
            },
            { $set: { releaseDate: releaseDate } }
        );

        res.status(200).json({ 
            success: true, 
            message: "Items received!." 
        });

    } catch (err) {
        console.error("CONFIRM RECEIPT ERROR:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
};
// controllers/Api/orderControllerApi.js
// controllers/Api/orderControllerApi.js
exports.verifyReturnOTP = async (req, res) => {
    try {
        const { orderId, otp } = req.body;
        const Order = require("../../models/Order");

        // 🔥 IMPORTANT: Items ke andar wala pickupOTP select karo
        const order = await Order.findById(orderId).select("+items.returnDetails.pickupOTP");

        if (!order) return res.status(404).json({ success: false, message: "Order not found!" });

        //  LOGIC: Items array mein dhoondo ki ye OTP kiska hai
        let matchedItem = null;
        order.items.forEach(item => {
            if (item.returnDetails?.pickupOTP === otp) {
                matchedItem = item;
            }
        });

        if (!matchedItem) {
            return res.status(400).json({ success: false, message: "Invalid OTP! Check Again." });
        }

        // Status update sirf us item ka jiska OTP match hua
        matchedItem.status = "Picked_Up";
        matchedItem.returnDetails.status = "PICKED_UP";
        matchedItem.returnDetails.pickedUpAt = new Date();

        // Mongoose ko array change ke baare mein batao
        order.markModified('items');
        await order.save();

        res.json({ success: true, message: "Item Picked Up successfully!" });
    } catch (err) {
        console.error("PICKUP VERIFY ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// User confirm karega ki usne courier wale ko dabba de diya hai
exports.confirmReturnHandover = async (req, res) => {
    try {
        const { orderId, itemId } = req.body; // 🔥 Frontend se itemId bhi lo
        const Order = require("../../models/Order");

        // 1. Order dhundo
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // 2. 🔥 ITEM LEVEL UPDATE (Sabse important part)
        let itemFound = false;
        order.items.forEach(item => {
            // Check karo ki ye wahi item hai jise user handover kar raha hai
            if (item.itemId.toString() === itemId.toString()) {
                item.status = "Picked_Up"; // Status badlo taaki UI se button hat jaye
                
                // Item ke andar wale return details bhi update karo
                if (item.returnDetails) {
                    item.returnDetails.status = "PICKED_UP";
                    item.returnDetails.pickedUpAt = new Date();
                }
                itemFound = true;
            }
        });

        if (!itemFound) {
            return res.status(404).json({ success: false, message: "Item not present in list" });
        }

        // 3. Global Status update (Records ke liye)
        order.returnDetails.status = "PICKED_UP";
        
        // Check: Agar saare items pick ho gaye hain toh global status bhi update kar do
        const allProcessed = order.items.every(it => 
            ["Picked_Up", "Delivered", "Cancelled", "Returned"].includes(it.status)
        );
        if (allProcessed) {
            order.orderStatus = "Picked_Up";
        }

        // 4. Mongoose ko batao ki array ke andar change hua hai
        order.markModified('items');
        await order.save();

        res.json({ 
            success: true, 
            message: "Handover confirmed! Status updated to Picked Up." 
        });

    } catch (err) {
        console.error("Handover Error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
};