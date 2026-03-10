const Order = require("../models/Order");
const Cart = require("../models/Cart");
const User = require("../models/User");


const Razorpay = require("razorpay");
const crypto = require("crypto"); // Signature verify karne ke liye

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: "YOUR_RAZORPAY_KEY_ID",      // .env file se lena chahiye
  key_secret: "YOUR_RAZORPAY_KEY_SECRET"
});
// 🧺 Place order from cart
exports.placeOrder = async (req, res) => {
  try {
    const { userId, paymentMethod, shippingAddress } = req.body;

    // 1. Cart nikalo
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) return res.send("Cart is empty");

    let finalPaymentStatus = "PENDING"; // Default COD ke liye

    // ----------------------------------------------------
    // CASE 1: WALLET PAYMENT
    // ----------------------------------------------------
    if (paymentMethod === "WALLET") {
      const user = await User.findById(userId);

      // Balance Check
      if (user.walletBalance < cart.totalAmount) {
        return res.send("Insufficient Balance in Wallet.");
      }

      // Paise Kaato
      user.walletBalance -= cart.totalAmount;
      await user.save();

      // Transaction History Banao
      await Transaction.create({
        user: userId,
        amount: cart.totalAmount,
        type: "DEBIT",
        description: "Order Payment via Wallet",
        status: "SUCCESS"
      });

      finalPaymentStatus = "PAID"; // Wallet se paisa kat gaya, order PAID hai
    }

    // ----------------------------------------------------
    // CASE 2: COD (Cash on Delivery)
    // ----------------------------------------------------
    // COD ke liye kuch extra nahi karna, bas status PENDING rahega.


    // ----------------------------------------------------
    // COMMON STEP: Order Database mein Save karo
    // ----------------------------------------------------
    const order = new Order({
      user: userId,
      items: cart.items, // Cart items copy
      totalAmount: cart.totalAmount,
      shippingAddress,
      paymentMethod,
      paymentStatus: finalPaymentStatus, // PENDING (COD) ya PAID (Wallet)
      orderStatus: "Pending" // Order confirm ho gaya, par ship nahi hua
    });

    await order.save();

    // Cart khali karo
    await Cart.findOneAndUpdate({ user: userId }, { items: [], totalAmount: 0 });

    // Success Page par bhejo
    res.render("orders/order-success", { order });

  } catch (err) {
    console.error(err);
    res.send("Error: " + err.message);
  }
};
// 📦 Show all user orders
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.render("orders/orders", { orders });
  } catch (err) {
    res.send("Error loading orders");
  }
};

// 🧾 Show checkout page

exports.checkoutPage = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.params.userId });
    if (!cart || cart.items.length === 0) return res.send("Cart is empty");

    const user = await User.findById(req.params.userId);

    res.render("cart/checkout", { user, totalAmount: cart.totalAmount });
  } catch (err) {
    res.send("Error loading checkout");
  }
};



// 🟢 1. RAZORPAY ORDER CREATE KARNA (Frontend se call hoga)
exports.createOnlineOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    
    // Razorpay amount paise mein leta hai (1 Rupee = 100 Paise)
    const options = {
      amount: amount * 100, 
      currency: "INR",
      receipt: "order_rcptid_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.json(order); // Order ID frontend ko bhejo

  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating razorpay order");
  }
};

// 🟢 2. PAYMENT VERIFY AUR ORDER SAVE KARNA
exports.verifyAndPlaceOrder = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      // Baki order details jo form se aayengi
      userId, fullName, addressLine1, city, state, postalCode, country, phone 
    } = req.body;

    // A. Signature Verification (Security Check)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", "YOUR_RAZORPAY_KEY_SECRET") // Wahi secret key use karein
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).send("Invalid Payment Signature! (Chori pakdi gayi)");
    }

    // B. Agar signature sahi hai, toh ab Database mein Order Save karo
    // (Ye wahi logic hai jo humne pehle likha tha)
    
    const cart = await Cart.findOne({ user: userId });
    
    const order = new Order({
      user: userId,
      items: cart.items.map((item) => ({
        ...item.toObject(),
        subtotal: (item.price - (item.price * (item.discount / 100))) * item.quantity,
      })),
      totalAmount: cart.totalAmount,
      shippingAddress: { fullName, addressLine1, city, state, postalCode, country, phone },
      paymentMethod: "ONLINE", // UPI/Card
      paymentStatus: "PAID",   // ✅ Confirm Paid hai
      orderStatus: "Pending",
      // Razorpay IDs save kar lo future reference ke liye
      transactionId: razorpay_payment_id 
    });

    await order.save();
    await Cart.findOneAndUpdate({ user: userId }, { items: [], totalAmount: 0 });

    res.json({ status: "success", orderId: order._id });

  } catch (err) {
    console.log(err);
    res.status(500).send("Payment Verification Failed");
  }
};