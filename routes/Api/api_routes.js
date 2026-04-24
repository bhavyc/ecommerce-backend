const express = require("express");
const router = express.Router();

//   Middleware Import
const { protect } = require("../../middleware/authMiddleware");

//  Controllers Import
const authController = require("../../controllers/Api/authControllerApi");
const cartController = require("../../controllers/Api/cartControllerApi");
const dealController = require("../../controllers/Api/dealControllerApi");
const normalDealController = require("../../controllers/Api/normalDealControllerApi");
const dropController = require("../../controllers/Api/dropControllerApi");
const groupController = require("../../controllers/Api/groupBuyControllerApi");
const membershipController = require("../../controllers/Api/membershipControllerApi");
const orderController = require("../../controllers/Api/orderControllerApi");

const walletController = require("../../controllers/Api/walletControllerApi");
const qaController = require("../../controllers/Api/qaControllerApi");
const compareController = require("../../controllers/Api/compareNormalDealControllerApi");

const gameController = require("../../controllers/Api/gameControllerApi");
const searchController = require("../../controllers/Api/searchControllerApi");
const payoutController = require("../../controllers/Api/payoutControllerApi");
const { protectSellerApi } = require("../../middleware/seller/authMiddleware");
const categoryController = require("../../controllers/Api/categoryControllerApi");
const analyticsController = require("../../controllers/Api/analyticsControllerApi");


const notifController = require("../../controllers/Api/notificationControllerApi");

router.get("/notifications", protect, notifController.getNotifications);
router.put("/notifications/read", protect, notifController.markAsRead);
router.get("/analytics/:timeframe", protect, (req, res) => {
    const { timeframe } = req.params;
    if (timeframe === 'daily') return analyticsController.dailyAnalytics(req, res);
    if (timeframe === 'weekly') return analyticsController.weeklyAnalytics(req, res);
    if (timeframe === 'monthly') return analyticsController.monthlyAnalytics(req, res);
    if (timeframe === 'yearly') return analyticsController.yearlyAnalytics(req, res);
    res.status(400).json({ success: false, message: "Invalid timeframe" });
});
// ==================================================
//  AUTH ROUTES
// ==================================================
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/logout", authController.logout);
router.get("/auth/profile", protect, authController.getProfile);

// ==================================================
//  CART ROUTES (Protected)
// ==================================================
router.get("/cart", protect, cartController.getCart);
router.post("/cart/add", protect, cartController.addToCart);
router.delete("/cart/remove", protect, cartController.removeItem);
router.delete("/cart/clear", protect, cartController.clearCart);

// ==================================================
//  24HR DEALS ROUTES
// ==================================================
router.get("/deals", dealController.listActiveDeals);
router.get("/deals/:id", dealController.getDealById);
router.post("/deals/claim/:id", protect, dealController.claimDeal);

// ==================================================
//   NORMAL DEALS ROUTES
// ==================================================
router.get("/normal-deals", normalDealController.getAllDeals);
router.get("/normal-deals/featured", normalDealController.getFeaturedDeals);
router.get("/normal-deals/:id", normalDealController.getDealById);

// ==================================================
// FRUIT DROPS ROUTES
// ==================================================
router.get("/drops", protect, dropController.listDrops);
router.get("/drops/:id", protect, dropController.getDrop);
router.post("/drops", protect, dropController.addDrop);
router.get("/daily-drop", protect, dropController.getDailyDrop);
router.post("/unlock-drop", protect, dropController.unlockDrop);
// ==================================================
// GROUP BUY ROUTES (Protected)
// ==================================================
router.post("/group/start", protect, groupController.startGroup);
router.post("/group/join", protect, groupController.joinGroup);
router.get("/group/lobby/:groupId", protect, groupController.viewLobby);

// ==================================================
// MEMBERSHIP ROUTES (Protected)
// ==================================================
router.get("/status", protect, membershipController.checkStatus);
router.post("/buy", protect, membershipController.createMembershipOrder);
router.post("/verify", protect, membershipController.verifyMembership);

// ==================================================
// ORDER ROUTES (UPDATED)
// ==================================================
// 1. Create Order (COD, Wallet, ya Razorpay Init sab isi se hoga)
router.post("/orders/create", protect, orderController.createOrder);

// 2. Verify Payment (Frontend success hone par call karega)
router.post("/orders/verify-payment", protect, orderController.verifyPayment);

// 3. Webhook (Razorpay Server call karega - NO PROTECT HERE)
router.post("/orders/webhook", orderController.handleWebhook);
router.post("/order/cancel", protect, orderController.cancelOrder);
// 4. View Orders
router.get("/orders", protect, orderController.getMyOrders);
router.get("/orders/:id", protect, orderController.getOrderById);

// ==================================================
// WALLET ROUTES (Protected)
// ==================================================

router.get("/wallet", protect, walletController.getWallet);

// 2. Step 1: Razorpay Order create karne ke liye (Frontend isse call karega)
router.post("/wallet/order", protect, walletController.createWalletOrder); 

// 3. Step 2: Payment Verify hone par paise add karne ke liye
router.post("/wallet/verify", protect, walletController.verifyWalletAdd);


// ==================================================
//Q&A ROUTES
// ==================================================
router.get("/qa/:productId", qaController.getQA);
router.post("/qa/:productId", protect, qaController.askQuestion);
router.post("/qa/answer/:questionId", protect, qaController.answerQuestion);

// ==================================================
// COMPARE ROUTES (Protected)
// ==================================================
router.get("/compare", protect, compareController.getCompareList);
router.post("/compare/add", protect, compareController.addToCompare);
router.delete("/compare/remove/:id", protect, compareController.removeFromCompare);
router.delete("/compare/clear", protect, compareController.clearCompareList);

// ==================================================
// GAME ROUTES
// ==================================================
router.get("/game/status", protect, gameController.getGameState);
router.post("/game/water", protect, gameController.waterTree);


router.post("/request", payoutController.requestPayout);
router.get("/history", payoutController.getPayoutHistory);


// Search Route
// Call example: /api/search?q=apple
router.get("/search", searchController.searchItems);



// ================= CATEGORY ROUTES =================

// 1. Get List of All Categories (e.g. for Navbar)
// GET /api/categories
router.get("/categories", categoryController.getCategories);

// 2. Get Products inside a Category
// GET /api/categories/Electronics
router.get("/categories/:categoryName", categoryController.getItemsByCategory);

router.post("/auth/forgot-password", authController.forgotPassword);
router.post("/auth/reset-password", authController.resetPassword);

// routes/Api/api_routes.js mein ye line add karo:
router.put("/auth/profile/update", protect, authController.updateProfile);

// routes/Api/api_routes.js
router.delete("/auth/delete-account", protect, authController.deleteAccount);

router.post("/auth/fcm-token", protect, authController.updateFcmToken);


router.post("/orders/payment-failed", protect, orderController.markPaymentFailed);



// User app se return mangne ke liye
router.post("/order/request-return", protect, orderController.requestReturn);

  
router.post("/order/verify-delivery", orderController.verifyDeliveryOTP);


router.post("/order/request-return", protect, orderController.requestReturn);

// Public Link: Verify Return Pickup OTP (Delivery Boy hits this)
router.post("/order/verify-pickup", orderController.verifyReturnOTP);
 
router.post("/order/confirm-receipt", protect, orderController.confirmReceiptByCustomer);


// Is line ko check karo, authMiddleware ke saath honi chahiye
router.post("/order/return-handover", protect, orderController.confirmReturnHandover);
module.exports = router;