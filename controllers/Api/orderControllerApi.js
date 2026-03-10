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
//    HELPER: ATOMIC SUCCESS LOGIC (Updated for Sessions)
// =========================================================
const finalizeSuccessfulOrder = async (orderId, paymentId, signature, externalSession = null) => {
    const session = externalSession || await mongoose.startSession();
    if (!externalSession) session.startTransaction();

    try {
        const order = await Order.findOneAndUpdate(
            { _id: orderId, isPaymentFinalized: false },
            { 
                $set: { 
                    paymentStatus: "PAID", 
                    orderStatus: "Processing", 
                    razorpayPaymentId: paymentId, 
                    razorpaySignature: signature || "verified",
                    isPaymentFinalized: true 
                } 
            },
            { session, new: true }
        );

        if (!order) {
            if (!externalSession) await session.abortTransaction();
            return { alreadyProcessed: true };
        }

        await Transaction.create([{
            user: order.user, orderId: order._id, amount: order.totalAmount,
            type: "DEBIT", description: `Order Payment #${order._id.toString().slice(-6)}`,
            status: "SUCCESS", paymentGateway: order.paymentMethod === 'WALLET' ? 'WALLET' : 'RAZORPAY',
            gatewayTransactionId: paymentId
        }], { session });

        for (const item of order.items) {
            let actualProductId = null;
            let sellerId = item.seller;

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

            const inventory = await Inventory.findOneAndUpdate(
                { product: actualProductId, seller: sellerId, remaining: { $gte: item.quantity } },
                { $inc: { sold: item.quantity, remaining: -item.quantity } },
                { session, new: true }
            );

            if (!inventory) throw new Error(`Out of Stock: ${item.title}`);

            const itemTotal = item.price * item.quantity;
            const sellerEarnings = Math.round(itemTotal * 0.90);
            
            await User.findByIdAndUpdate(sellerId, { $inc: { pendingBalance: sellerEarnings } }, { session });

            const releaseDate = new Date();
            releaseDate.setDate(releaseDate.getDate() + 15);

            await Transaction.create([{
                user: sellerId, orderId: order._id, amount: sellerEarnings,
                type: "CREDIT", description: `Sale: ${item.title} - Hold`,
                status: "ON_HOLD", releaseDate: releaseDate, paymentGateway: "SYSTEM"
            }], { session });

            await Expense.create([{
                user: order.user, title: `Item: ${item.title}`, amount: itemTotal,
                category: "Shopping", paymentMethod: order.paymentMethod === 'COD' ? 'CASH' : 'ONLINE',
                expenseDate: new Date()
            }], { session });
        }

        const dropsEarned = Math.floor(order.totalAmount / 10);
        const buyer = await User.findById(order.user).session(session);

        if (buyer.referredBy && !buyer.isFirstOrderDone) {
            await User.findByIdAndUpdate(buyer.referredBy, { $inc: { walletBalance: 50 } }, { session });
            await Transaction.create([{
                user: buyer.referredBy, amount: 50, type: "CREDIT",
                description: `Referral: ${buyer.name} first order`, status: "SUCCESS"
            }], { session });
        }

        await User.findByIdAndUpdate(order.user, { 
            $inc: { "game.waterDrops": dropsEarned }, 
            $set: { isFirstOrderDone: true } 
        }, { session });

        await Cart.findOneAndDelete({ user: order.user }).session(session);
        
        if (!externalSession) await session.commitTransaction();
        sendNotification(order.user, "Order Confirmed!", "Your items are being packed.", "ORDER");
        return order;

    } catch (err) {
        if (!externalSession) await session.abortTransaction();
        if (err.message.includes("Out of Stock")) await handleAutoRefund(orderId, paymentId);
        throw err;
    } finally {
        if (!externalSession) session.endSession();
    }
};

// =========================================================
// API 1: CREATE ORDER (Wallet Race Condition Solved)
// =========================================================
exports.createOrder = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { paymentMethod, shippingAddress } = req.body;

        const cart = await Cart.findOne({ user: userId });
        if (!cart || cart.items.length === 0) return res.status(400).json({ success: false, message: "Cart empty" });

        const order = new Order({
            user: userId, items: cart.items, totalAmount: cart.totalAmount,
            shippingAddress, subtotal: cart.subtotal, deliveryFee: cart.deliveryFee,
            paymentMethod, paymentStatus: "PENDING", orderStatus: "Pending"
        });
        await order.save();

        if (paymentMethod === "WALLET") {
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                const user = await User.findOneAndUpdate(
                    { _id: userId, walletBalance: { $gte: cart.totalAmount } },
                    { $inc: { walletBalance: -cart.totalAmount } },
                    { session, new: true }
                );

                if (!user) throw new Error("Insufficient Balance");

                await finalizeSuccessfulOrder(order._id, `WALLET_${order._id}`, "wallet_pay", session);
                await session.commitTransaction();
                return res.status(201).json({ success: true, message: "Wallet Order Placed", orderId: order._id });
            } catch (err) {
                await session.abortTransaction();
                order.orderStatus = "Payment_Failed";
                await order.save();
                return res.status(400).json({ success: false, message: err.message });
            } finally {
                session.endSession();
            }
        }

        if (paymentMethod === "COD") {
            order.orderStatus = "Processing";
            order.isPaymentFinalized = true;
            await order.save();
            await Cart.findOneAndDelete({ user: userId });
            return res.status(201).json({ success: true, message: "COD Order Placed", orderId: order._id });
        }

        if (paymentMethod === "ONLINE") {
            const rzpOrder = await razorpay.orders.create({
                amount: Math.round(cart.totalAmount * 100),
                currency: "INR",
                receipt: order._id.toString()
            });
            order.razorpayOrderId = rzpOrder.id;
            await order.save();
            return res.json({ success: true, orderId: order._id, razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, key: RAZORPAY_KEY_ID });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========================================================
// API: CANCEL ORDER (Atomic Restock & Refund Solved)
// =========================================================
exports.cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user._id || req.user.id;
        const { orderId } = req.body;

        const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
        if (!order || ["Shipped", "Delivered", "Cancelled"].includes(order.orderStatus)) {
            throw new Error("Cannot cancel this order.");
        }

        // 24 Hour window check
        if ((new Date() - new Date(order.createdAt)) / (1000 * 60 * 60) > 24) {
            throw new Error("Cancellation window expired.");
        }

        // 1. Restock Inventory
        for (const item of order.items) {
            let actualProductId = null;
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

            await Inventory.findOneAndUpdate(
                { product: actualProductId, seller: item.seller },
                { $inc: { sold: -item.quantity, remaining: item.quantity } },
                { session }
            );
        }

        // 2. Revert Seller Credit
        const sellerTxns = await Transaction.find({ orderId: order._id, type: "CREDIT", status: "ON_HOLD" }).session(session);
        for (const txn of sellerTxns) {
            await User.findByIdAndUpdate(txn.user, { $inc: { pendingBalance: -txn.amount } }, { session });
            txn.status = "CANCELLED";
            await txn.save({ session });
            await Transaction.create([{
                user: txn.user, orderId: order._id, amount: txn.amount,
                type: "DEBIT", description: `Reversal: Order #${order._id.toString().slice(-6)} Cancelled`,
                status: "SUCCESS"
            }], { session });
        }

        // 3. Customer Refund
        if (order.paymentStatus === "PAID" && order.paymentMethod !== "COD") {
            await User.findByIdAndUpdate(userId, { $inc: { walletBalance: order.totalAmount } }, { session });
            await Transaction.create([{
                user: userId, orderId: order._id, amount: order.totalAmount,
                type: "CREDIT", description: `Refund: Order #${order._id.toString().slice(-6)}`,
                status: "SUCCESS", paymentGateway: "WALLET"
            }], { session });
        }

        order.orderStatus = "Cancelled";
        await order.save({ session });

        await session.commitTransaction();
        sendNotification(userId, "Order Cancelled", "Refund processed to wallet.", "ORDER");
        res.status(200).json({ success: true, message: "Cancelled successfully" });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: err.message });
    } finally {
        session.endSession();
    }
};

// =========================================================
// APIs: VERIFY, WEBHOOK, SYNC (Baki logic same rakha hai)
// =========================================================

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
            const receipt = rzpPayment.receipt;

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
            } catch (e) { console.error(e); }
        }
        if (res) res.json({ success: true });
    } catch (err) {
        if (res) res.status(500).json({ success: false });
    }
};

exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
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

const handleAutoRefund = async (orderId, paymentId) => {
    const refundSession = await mongoose.startSession();
    refundSession.startTransaction();
    try {
        const order = await Order.findById(orderId).session(refundSession);
        order.orderStatus = "Cancelled";
        await order.save({ session: refundSession });
        await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: order.totalAmount } }, { session: refundSession });
        await Transaction.create([{
            user: order.user, amount: order.totalAmount, type: "CREDIT",
            description: "Auto-Refund: Out of Stock", status: "SUCCESS",
            gatewayTransactionId: `REFUND_${paymentId}`
        }], { session: refundSession });
        await refundSession.commitTransaction();
    } catch (e) { await refundSession.abortTransaction(); } finally { refundSession.endSession(); }
};





// const Order = require("../../models/Order");
// const Cart = require("../../models/Cart");
// const User = require("../../models/User");
// const Expense = require("../../models/Expense");
// const Transaction = require("../../models/Transaction");
// const Razorpay = require("razorpay");
// const crypto = require("crypto");
// const sendNotification = require("../../utils/sendNotification");
// const Notification = require("../../models/Notification");
// const NormalDeal = require("../../models/NormalDeal");
// const Deal24Hr = require("../../models/24HrDeal");
// const Drop = require("../../models/FruitDrop");
// const Inventory = require("../../models/Inventory");
// const Product = require("../../models/Product");
// const mongoose = require("mongoose");
 
// // Environment Variables Check
// const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
// const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
// const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET; 

// if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
//   console.error("RAZORPAY KEYS MISSING in .env file");
// }

// const razorpay = new Razorpay({
//   key_id: RAZORPAY_KEY_ID,
//   key_secret: RAZORPAY_KEY_SECRET
// });

 
// const finalizeSuccessfulOrder = async (orderId, paymentId, signature) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     // 1. Order ko lock aur update karo (Idempotency check included)
//     const order = await Order.findOneAndUpdate(
//       { _id: orderId, isPaymentFinalized: false },
//       { 
//         $set: { 
//           paymentStatus: "PAID", 
//           orderStatus: "Processing", 
//           razorpayPaymentId: paymentId, 
//           razorpaySignature: signature || "webhook_verified",
//           isPaymentFinalized: true 
//         } 
//       },
//       { session, new: true }
//     );

//     if (!order) {
//         await session.abortTransaction();
//         console.log(`Order ${orderId} already processed or not found.`);
//         return { alreadyProcessed: true };
//     }

//     // 2. Buyer Transaction Log (Debit Record)
//     await Transaction.create([{
//       user: order.user,
//       orderId: order._id,
//       amount: order.totalAmount,
//       type: "DEBIT",
//       description: `Order Payment #${order._id.toString().slice(-6)}`,
//       status: "SUCCESS",
//       paymentGateway: order.paymentMethod === 'WALLET' ? 'WALLET' : 'RAZORPAY',
//       gatewayTransactionId: paymentId
//     }], { session });

//     // 3. Items Processing Loop
//     for (const item of order.items) {
//       let actualProductId = null;
//       let sellerId = item.seller;

//       // 🔥 FIX: Deal ID se asli Product ID nikalna (Kyunki Inventory Product ID se link hai)
//       if (item.itemType === "NormalDeal") {
//         const deal = await NormalDeal.findById(item.itemId).session(session);
//         if (deal) actualProductId = deal.product;
//       } else if (item.itemType === "24HrDeal") {
//         const deal = await Deal24Hr.findById(item.itemId).session(session);
//         if (deal) actualProductId = deal.product;
//       } else if (item.itemType === "Drop") {
//         const drop = await Drop.findById(item.itemId).session(session);
//         if (drop) actualProductId = drop.product;
//       }

//       // Fallback agar kisi wajah se upar logic miss ho jaye
//       if (!actualProductId) actualProductId = item.itemId;

//       if (sellerId && actualProductId) {
//         // 🔥 PRODUCTION FIX: Actual Product ID use karke stock deduct karo
//         const inventory = await Inventory.findOneAndUpdate(
//           { product: actualProductId, seller: sellerId, remaining: { $gte: item.quantity } },
//           { $inc: { sold: item.quantity, remaining: -item.quantity } },
//           { new: true, session }
//         );

//         if (!inventory) {
//           console.error(`Inventory mismatch for Product: ${actualProductId}`);
//           throw new Error(`Out of Stock for item: ${item.title}`); 
//         }

//         // --- SELLER SETTLEMENT (90% to Seller, 10% to Admin) ---
//         const itemTotal = item.price * item.quantity;
//         const sellerEarnings = Math.round(itemTotal * 0.90); 
        
//         await User.findByIdAndUpdate(sellerId, { $inc: { pendingBalance: sellerEarnings } }, { session });

//         const releaseDate = new Date();
//         releaseDate.setDate(releaseDate.getDate() + 15); // 15 Days Hold

//         await Transaction.create([{
//           user: sellerId,
//           orderId: order._id,
//           amount: sellerEarnings,
//           type: "CREDIT",
//           description: `Sale: ${item.title} - Funds on Hold`,
//           status: "ON_HOLD",
//           releaseDate: releaseDate,
//           paymentGateway: "SYSTEM"
//         }], { session });

//         // --- EXPENSE TRACKING (User ki spending track karne ke liye) ---
//         await Expense.create([{
//           user: order.user,
//           title: `Order Item: ${item.title}`,
//           amount: itemTotal,
//           category: "Shopping",
//           paymentMethod: order.paymentMethod === 'COD' ? 'CASH' : 'ONLINE',
//           expenseDate: new Date()
//         }], { session });
//       }
//     }

//     // 4. REFERRAL & REWARDS
//     const dropsEarned = Math.floor(order.totalAmount / 10); // ₹10 = 1 Water Drop
//     const buyer = await User.findById(order.user).session(session);

//     if (buyer.referredBy && !buyer.isFirstOrderDone) {
//       // Referrer ko ₹50 reward
//       await User.findByIdAndUpdate(buyer.referredBy, { $inc: { walletBalance: 50 } }, { session });
//       await Transaction.create([{
//         user: buyer.referredBy,
//         amount: 50,
//         type: "CREDIT",
//         description: `Referral Bonus: ${buyer.name}'s first order`,
//         status: "SUCCESS"
//       }], { session });
//     }

//     // Buyer ko Game drops dena aur First Order mark karna
//     await User.findByIdAndUpdate(order.user, { 
//       $inc: { "game.waterDrops": dropsEarned }, 
//       $set: { isFirstOrderDone: true } 
//     }, { session });

//     // 5. Cart Clear & Commit
//     await Cart.findOneAndDelete({ user: order.user }).session(session);
    
//     await session.commitTransaction();
    
//     sendNotification(order.user, "Order Confirmed!", "Your items are being packed.", "ORDER");
//     return order;

//   } catch (err) {
//     if (session.inTransaction()) {
//       await session.abortTransaction();
//     }
//     console.error(`Finalize Error: ${err.message}`);
    
//     // 🔥 AUTO-REFUND Logic
//     if (err.message.includes("Out of Stock")) {
//         await handleAutoRefund(orderId, paymentId);
//     }
//     throw err;
//   } finally {
//     session.endSession();
//   }
// };
// // AUTO-REFUND FUNCTION
// const handleAutoRefund = async (orderId, paymentId) => {
//     const refundSession = await mongoose.startSession();
//     refundSession.startTransaction();
//     try {
//         const order = await Order.findById(orderId).session(refundSession);
//         order.orderStatus = "Cancelled";
//         await order.save({ session: refundSession });

//         await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: order.totalAmount } }, { session: refundSession });

//         await Transaction.create([{
//             user: order.user,
//             amount: order.totalAmount,
//             type: "CREDIT",
//             description: "Auto-Refund: Items went out of stock.",
//             status: "SUCCESS",
//             gatewayTransactionId: `REFUND_${paymentId}`
//         }], { session: refundSession });

//         await refundSession.commitTransaction();
//     } catch (e) { await refundSession.abortTransaction(); } finally { refundSession.endSession(); }
// };



// // =========================================================
// // API 1: CREATE ORDER (Unified)
// // =========================================================

// // 1 it will be called when user will place order
// exports.createOrder = async (req, res) => {
//   try {
//     const userId = req.user ? (req.user.id || req.user._id) : null;
//     if (!userId) return res.status(401).json({ success: false, message: "User ID missing" });

//     const { paymentMethod, shippingAddress } = req.body;

//     // 1. Validate Cart
//     // cart mai user ke items hai aur cart mai userid hai
//     const cart = await Cart.findOne({ user: userId });
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ success: false, message: "Cart is empty" });
//     }

//     const totalAmount = cart.totalAmount;

//     // 2. DB MEIN ORDER PEHLE CREATE KARO (Pending State)
//     // Isse agar payment ke baad user bhaag gaya, tab bhi humare paas record hoga
//     // order create karke bhaag gaya tab order status pending ho jayega
//     const order = new Order({
//       user: userId,
//       items: cart.items,
//       totalAmount: totalAmount,
//       shippingAddress: shippingAddress,
//       subtotal: cart.subtotal,
//       deliveryFee: cart.deliveryFee,
//       totalAmount: cart.totalAmount, 
//       paymentMethod: paymentMethod, // COD, WALLET, or ONLINE
//       paymentStatus: "PENDING",
//       orderStatus: "Pending"
//     });

//     await order.save();

//     // 3. Payment Method Logic

//     // CASE A: WALLET
//      if (paymentMethod === "WALLET") {
//       // 🔥 ATOMIC UPDATE: Sirf tabhi paise kato jab balance >= totalAmount ho
//       const user = await User.findOneAndUpdate(
//         { _id: userId, walletBalance: { $gte: totalAmount } }, 
//         { $inc: { walletBalance: -totalAmount } },
//         { new: true }
//       );

//       // Agar user null aaya iska matlab balance kam tha!
//       if (!user) {
//         order.orderStatus = "Payment_Failed";
//         await order.save();
//         return res.status(400).json({ success: false, message: "Insufficient Wallet Balance" });
//       }
      
//       // Finalize Order
//       const finalOrder = await finalizeSuccessfulOrder(
//         order._id,
//         `WALLET_${order._id}`,
//         null
//       );
//       return res.status(201).json({ success: true, message: "Order placed via Wallet", orderId: finalOrder._id });
//     }
//     // CASE B: COD
//     if (paymentMethod === "COD") {
//       // COD mein payment baad mein hoti hai, toh bas finalize logic partial chalega
//       // (Is case mein hum finalizeSuccessfulOrder use nahi kar rahe kyunki wo 'PAID' mark karta hai)
      
//       order.orderStatus = "Processing";
//       order.isPaymentFinalized = true; // Taaki online payment try na ho
//       await order.save();
      
//       // Clear Cart
//       await Cart.findOneAndDelete({ user: userId });
//       // Rewards (Optional: COD pe rewards dene hain ya nahi aap decide karo)
       
//       return res.status(201).json({ success: true, message: "Order placed via COD", orderId: order._id });
//     }

//     // CASE C: ONLINE (RAZORPAY)
//     if (paymentMethod === "ONLINE") {
//       const options = {
//         amount: Math.round(totalAmount * 100), // INR to Paise
//         currency: "INR",
//         receipt: order._id.toString() //  Receipt mein DB ka Order ID bhej rahe hain
//       };

//       const razorpayOrder = await razorpay.orders.create(options);

//       // Save Razorpay Order ID to DB
//       order.razorpayOrderId = razorpayOrder.id;
//       await order.save();

//       return res.status(200).json({
//         success: true,
//         message: "Payment Initiated",
//         orderId: order._id,           // DB Order ID
//         razorpayOrderId: razorpayOrder.id, // Razorpay Order ID
//         amount: razorpayOrder.amount,
//         key: RAZORPAY_KEY_ID
//       });
//     }

//   } catch (err) {
//     console.error("Create Order Error:", err);
//     res.status(500).json({ success: false, message: "Server error creating order", error: err.message });
//   }
// };


// // =========================================================
// //  API 2: VERIFY PAYMENT (Frontend se call hoga)
// // 2 it will be called when user will place order
// // =========================================================
// exports.verifyPayment = async (req, res) => {
//   try {
//     const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//     // 1. Signature Verification (Security Check)
//     const body = razorpay_order_id + "|" + razorpay_payment_id;
//     const expectedSignature = crypto
//       .createHmac("sha256", RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Invalid Signature! Payment verification failed." });
//     }

//     // 2. Fetch Order
//     // Hum razorpayOrderId bhi match kar rahe hain taaki sure ho sakein ye wahi order hai
//     const order = await Order.findOne({ _id: orderId, razorpayOrderId: razorpay_order_id });
 
//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }
    
//     // 3. Idempotency Check (Agar Webhook ne pehle hi kaam kar diya ho)
//     if (order.isPaymentFinalized) {
//       return res.status(200).json({ success: true, message: "Order already verified", orderId: order._id });
//     }

//     // 4. Finalize
//     await finalizeSuccessfulOrder(order._id, razorpay_payment_id, razorpay_signature);

//     res.status(200).json({ success: true, message: "Payment Successful!", orderId: order._id });

//   } catch (err) {
//     console.error("Verify Payment Error:", err);
//     res.status(500).json({ success: false, message: "Verification Error" });
//   }
// };


// // =========================================================
// //   API 3: WEBHOOK (Razorpay Server se call hoga)
// // =========================================================

// exports.handleWebhook = async (req, res) => {
//   const signature = req.headers['x-razorpay-signature'];

//   try {
//     // 1. Validate Secret
//     const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
//     shasum.update(JSON.stringify(req.body));
//     const digest = shasum.digest('hex');

//     if (digest !== signature) {
//       console.log("Webhook Signature Mismatch");
//       return res.status(400).json({ status: 'invalid_signature' });
//     }

//     const event = req.body.event;
//     const payload = req.body.payload;

//     console.log(`Webhook Received: ${event}`);

//     if (event === 'payment.captured') {
//       const rzpPayment = payload.payment.entity;
//       const rzpOrderId = rzpPayment.order_id;
//       const rzpPaymentId = rzpPayment.id;
//       const amountPaid = rzpPayment.amount / 100; // Paise to Rupees
      
//       // Receipt se pehchano ki ye kis cheez ki payment hai
//       // Receipt format: "wallet_USERID_TIME" or "mem_USERID_TIME" or "ORDER_ID"
//       const receipt = rzpPayment.receipt; 

//       // ===============================================
//       // CASE A: WALLET TOP-UP (Recovery)
//       // ===============================================
//       if (receipt && receipt.startsWith("wallet_")) {
//           const userId = receipt.split("_")[1]; // userId nikalo
          
//           // Transaction check karo (Duplicate rokne ke liye)
//           const existingTxn = await Transaction.findOne({ gatewayTransactionId: rzpPaymentId });
          
//           if (!existingTxn) {
//               await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amountPaid } });
              
//               await Transaction.create({
//                   user: userId,
//                   amount: amountPaid,
//                   type: "CREDIT",
//                   description: "Wallet Top-up (Webhook Recovered)",
//                   status: "SUCCESS",
//                   paymentGateway: "RAZORPAY",
//                   gatewayTransactionId: rzpPaymentId
//               });
//               console.log(`Webhook: Recovered Wallet Money for ${userId}`);
//           }
//           return res.status(200).json({ status: 'ok' });
//       }

//       // ===============================================
//       // CASE B: MEMBERSHIP (Recovery)
//       // ===============================================
//       if (receipt && receipt.startsWith("mem_")) {
//           const userId = receipt.split("_")[1];
//           const expiryDate = new Date();
//           expiryDate.setDate(expiryDate.getDate() + 30);

//           const existingTxn = await Transaction.findOne({ gatewayTransactionId: rzpPaymentId });

//           if (!existingTxn) {
//               await User.findByIdAndUpdate(userId, { 
//                   isMember: true,
//                   membershipExpiry: expiryDate
//               });

//               await Transaction.create({
//                   user: userId,
//                   amount: amountPaid,
//                   type: "DEBIT",
//                   description: "Membership Purchase (Webhook Recovered)",
//                   status: "SUCCESS",
//                   paymentGateway: "RAZORPAY",
//                   gatewayTransactionId: rzpPaymentId
//               });
//               console.log(`Webhook: Recovered Membership for ${userId}`);
//           }
//           return res.status(200).json({ status: 'ok' });
//       }

//       // ===============================================
//       // CASE C: PRODUCT ORDER (Recovery)
//       // ===============================================
//       const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
//       if (order && !order.isPaymentFinalized) {
//         await finalizeSuccessfulOrder(order._id, rzpPaymentId, "webhook_verified");
//         console.log(`Webhook: Recovered Product Order ${order._id}`);
//         return res.status(200).json({ status: 'ok' });
//       }

//       // ===============================================
//       // CASE D: SELLER SLOT (Recovery)
//       // ===============================================
//       const slot = await SlotBooking.findOne({ razorpayOrderId: rzpOrderId });
//       if (slot && slot.status === "PENDING") {
//         slot.status = "PAID";
//         slot.razorpayPaymentId = rzpPaymentId;
//         await slot.save();

//         const existingTxn = await Transaction.findOne({ gatewayTransactionId: rzpPaymentId });
//         if (!existingTxn) {
//           await Transaction.create({
//             user: slot.seller,
//             amount: slot.amountPaid,
//             type: "DEBIT",
//             description: `Slot Purchased (Webhook Recovered)`,
//             status: "SUCCESS",
//             paymentGateway: "RAZORPAY",
//             gatewayTransactionId: rzpPaymentId
//           });
//         }
//         console.log(`Webhook: Recovered Seller Slot ${slot._id}`);
//         return res.status(200).json({ status: 'ok' });
//       }
//     }

//     res.status(200).json({ status: 'ok' });

//   } catch (err) {
//     console.error("Webhook Error:", err);
//     res.status(500).send('Webhook Failed');
//   }
// };


// // =========================================================
// //  EXISTING GETTERS (No changes needed, just exporting)
// // =========================================================

// exports.getMyOrders = async (req, res) => {
//   try {
//     const userId = req.user ? (req.user.id || req.user._id) : null;
//     if(!userId) return res.status(401).json({success: false, message: "User ID missing"});
    
//     const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
//     res.status(200).json({ success: true, count: orders.length, orders });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching orders" });
//   }
// };

// exports.getOrderById = async (req, res) => {
//   try {
//     const userId = req.user ? (req.user.id || req.user._id) : null;
//     const order = await Order.findById(req.params.id);
    
//     if (!order) return res.status(404).json({ success: false, message: "Order not found" });
//     if (order.user.toString() !== userId.toString()) {
//       return res.status(403).json({ success: false, message: "Not authorized" });
//     }
    
//     res.status(200).json({ success: true, order });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching order" });
//   }
// };

// // ===== orderControllerApi.js (Add this at the bottom) =====

// // J1. RECONCILIATION LOGIC (Sync Pending Orders)
// // Isko Admin Panel se call kar sakte hain ya Cron Job se
// exports.syncPendingOrders = async (req, res) => {
//   try {
//     console.log("Starting Payment Reconciliation...");

//     // 1. Aise orders dhoondo jo 'ONLINE' hain aur abhi tak 'PENDING' hain
//     // Aur jo kam se kam 10 minute purane hain (taaki fresh orders disturb na ho)
//     const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
//     const pendingOrders = await Order.find({
//       paymentMethod: "ONLINE",
//       paymentStatus: "PENDING",
//       razorpayOrderId: { $exists: true }, // Jinka Rzp Order ID bana ho
//       createdAt: { $lte: tenMinutesAgo }
//     });

//     console.log(`Found ${pendingOrders.length} pending orders to sync.`);
    
//     let fixedCount = 0;

//     // 2. Loop through each order
//     for (const order of pendingOrders) {
//       try {
//         // Razorpay se pucho ki is Order ID par koi payment aayi hai kya?
//         const rzpOrders = await razorpay.orders.fetchPayments(order.razorpayOrderId);
        
//         // rzpOrders.items mein saari payments hoti hain (failed/captured)
//         // Humein check karna hai agar koi 'captured' payment hai
//         const successfulPayment = rzpOrders.items.find(pay => pay.status === 'captured');

//         if (successfulPayment) {
//           console.log(`Found missed payment for Order ${order._id}`);
          
//           // Wahi same helper function use karo jo pehle banaya tha
//           await finalizeSuccessfulOrder(
//             order._id, 
//             successfulPayment.id, 
//             "cron_reconciled" // Signature ki jagah mark daal diya
//           );
          
//           fixedCount++;
//         } 
//         // Optional: Agar order 2-3 din purana hai aur payment nahi aayi, toh FAILED mark kar sakte ho
        
//       } catch (innerErr) {
//         console.error(`Error syncing order ${order._id}:`, innerErr.message);
//         // Continue to next order, ek fail hone se loop mat roko
//       }
//     }

//     if (res) {
//       return res.status(200).json({ 
//         success: true, 
//         message: `Sync Complete. Fixed ${fixedCount} orders.`,
//         processed: pendingOrders.length
//       });
//     }

//   } catch (err) {
//     console.error("Reconciliation Error:", err);
//     if (res) res.status(500).json({ success: false, message: "Sync Failed" });
//   }
// };


// // controllers/Api/orderControllerApi.js

// // controllers/Api/orderControllerApi.js
// // controllers/Api/orderControllerApi.js

// exports.cancelOrder = async (req, res) => {
//   try {
//     console.log("Cancel Request Initiated by User:", req.user);
    
//     // 1. User ID aur Order ID nikalo
//     const userId = req.user ? (req.user._id || req.user.id) : null;
//     const { orderId } = req.body;

//     if (!userId) {
//         return res.status(401).json({ success: false, message: "Authentication Failed" });
//     }

//     // 2. Order ko dhundo
//     const order = await Order.findById(orderId);
//     if (!order) {
//         return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     // 3. Authorization Check (Sirf wahi user cancel kar sake jisne order kiya tha)
//     if (String(order.user) !== String(userId)) {
//       return res.status(403).json({ success: false, message: "Not authorized to cancel this order" });
//     }

//     // 4. Status Check (Shipped ya Delivered order cancel nahi ho sakte)
//     if (["Shipped", "Delivered", "Cancelled"].includes(order.orderStatus)) {
//        return res.status(400).json({ success: false, message: "Order is already shipped or delivered." });
//     }

//     // 🔥 5. NEW: 24-HOUR TIME CHECK LOGIC
//     const orderDate = new Date(order.createdAt);
//     const now = new Date();
//     const diffInHours = (now - orderDate) / (1000 * 60 * 60); // Milliseconds to Hours

//     if (diffInHours > 24) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Cancellation window (24 hours) has expired. You cannot cancel this order now." 
//       });
//     }

//     // =========================================================
//     // ACTION 1: INVENTORY RESTOCK (Tera Purana Logic)
//     // =========================================================
//     if (order.items && order.items.length > 0) {
//         for (const item of order.items) {
//           if(item.itemId) {
//               try {
//                 let productID = null;
//                 let sellerID = null;

//                 // Item type ke hisaab se Product aur Seller dhundo
//                 if(item.itemType === "NormalDeal") {
//                     const deal = await NormalDeal.findById(item.itemId);
//                     if(deal) { productID = deal.product; }
//                 } else if (item.itemType === "24HrDeal") {
//                     const deal = await Deal24Hr.findById(item.itemId);
//                     if(deal) { productID = deal.product; sellerID = deal.seller; }
//                 } else if (item.itemType === "Drop") {
//                     const drop = await Drop.findById(item.itemId);
//                     if(drop) { productID = drop.product; sellerID = drop.seller; }
//                 }

//                 // Fallback checks
//                 if(!productID) {
//                     const prod = await Product.findById(item.itemId);
//                     if(prod) { productID = prod._id; sellerID = prod.seller; }
//                 } else if (!sellerID && productID) {
//                      const prod = await Product.findById(productID);
//                      if(prod) sellerID = prod.seller;
//                 }

//                 // Stock wapas badhao
//                 if (productID && sellerID) {
//                     const inventory = await Inventory.findOne({ product: productID, seller: sellerID });
//                     if (inventory) {
//                         inventory.sold = Math.max(0, inventory.sold - item.quantity);
//                         inventory.remaining += item.quantity;
//                         await inventory.save();
//                         console.log(`Stock Restocked for Item: ${item.title}`);
//                     }
//                 }
//               } catch (innerErr) {
//                   console.error(`Skipping item restock error for ${item.itemId}:`, innerErr.message);
//               }
//           }
//         }
//     }

//     // =========================================================
//     // ACTION 2: SELLER REVERSAL (Seller ke account se paisa kato)
//     // =========================================================
//     try {
//          const sellerTxns = await Transaction.find({ orderId: order._id, type: "CREDIT", status: "ON_HOLD" });
    
//     for (const txn of sellerTxns) {
//         // 1. Pending balance kam karo
//         await User.findByIdAndUpdate(txn.user, { $inc: { pendingBalance: -txn.amount } });

//         // 2. Purane record ko 'CANCELLED' mark karo
//         txn.status = "CANCELLED";
//         await txn.save();

//         // 3. 🔥 NAYA REVERSAL RECORD (Audit ke liye best hai)
//         await Transaction.create({
//             user: txn.user,
//             orderId: order._id,
//             amount: txn.amount,
//             type: "DEBIT",
//             description: `Reversal: Order #${order._id.toString().slice(-6)} Cancelled`,
//             status: "SUCCESS",
//             paymentGateway: "SYSTEM"
//         });
//     }
//     } catch (txnErr) { 
//         console.error("Seller reversal error:", txnErr.message); 
//     }

//     // =========================================================
//     // ACTION 3: CUSTOMER REFUND (BharatMart Wallet mein refund)
//     // =========================================================
//     if (order.paymentStatus === "PAID" && order.paymentMethod !== "COD") {
//        // Wallet balance badhao
//        await User.findByIdAndUpdate(order.user, { 
//            $inc: { walletBalance: order.totalAmount } 
//        });

//        // Refund ki transaction history banao
//        await Transaction.create({
//            user: order.user,
//            orderId: order._id,
//            amount: order.totalAmount,
//            type: "CREDIT", 
//            description: `Refund for Cancelled Order #${order._id.toString().slice(-6)}`,
//            status: "SUCCESS",
//            paymentGateway: "WALLET"
//        });
//        console.log(`Refund credited to Customer Wallet: ${order.user}`);
//     }

//     // =========================================================
//     // ACTION 4: FINAL STATUS UPDATE & NOTIFICATION
//     // =========================================================
//     order.orderStatus = "Cancelled";
//     await order.save();

//     // Push/In-app Notification bhej do
//     await sendNotification(
//       order.user, 
//       "Order Cancelled", 
//       `Order #${order._id.toString().slice(-6)} has been cancelled. Refund initiated (if paid).`, 
//       "ORDER"
//     );

//     res.status(200).json({ 
//         success: true, 
//         message: "Order Cancelled Successfully. Stock restored and refund processed." 
//     });

//   } catch (err) {
//     console.error("Cancel Order Error:", err);
//     res.status(500).json({ success: false, message: "Server Error", error: err.message });
//   }
// };




// // =========================================================
// //  API: MARK PAYMENT FAILED (Agar user back kar de)
// // =========================================================
// exports.markPaymentFailed = async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const order = await Order.findById(orderId);

//     // Sirf tabhi fail mark karo agar wo abhi bhi pending hai
//     if (order && order.paymentStatus === "PENDING") {
//       order.paymentStatus = "FAILED";
//       order.orderStatus = "Payment_Failed";
//       await order.save();
//     }

//     res.status(200).json({ success: true, message: "Order marked as Payment Failed" });
//   } catch (err) {
//     console.error("Mark Payment Failed Error:", err);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// };