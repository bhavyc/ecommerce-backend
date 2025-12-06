const express = require("express");
const router = express.Router();

// 🛡️ Middleware Import
const { protect } = require("../../middleware/authMiddleware");

// 🎮 Controllers Import (Saare Controllers yahan import kar le)
 const authController=require("../../controllers/Api/authControllerApi");
 const cartController=require("../../controllers/Api/cartControllerApi");
 const dealController=require("../../controllers/Api/dealControllerApi");
 const normalDealController=require("../../controllers/Api/normalDealControllerApi");
 const dropController=require("../../controllers/Api/dropControllerApi");
  const groupController=require("../../controllers/Api/groupBuyControllerApi");
  const membershipController=require("../../controllers/Api/membershipControllerApi");
  const orderController=require("../../controllers/Api/orderControllerApi");
  const walletController=require("../../controllers/Api/walletControllerApi");
  const qaController=require("../../controllers/Api/qaControllerApi");
  const compareController=require("../../controllers/Api/compareNormalDealControllerApi");

// ==================================================
// 🔐 AUTH ROUTES
// ==================================================
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/logout", authController.logout);
router.get("/auth/profile", protect, authController.getProfile);

// ==================================================
// 🛒 CART ROUTES (Protected)
// ==================================================
router.get("/cart", protect, cartController.getCart);
router.post("/cart/add", protect, cartController.addToCart);
router.delete("/cart/remove", protect, cartController.removeItem);
router.delete("/cart/clear", protect, cartController.clearCart);

// ==================================================
// ⚡ 24HR DEALS ROUTES
// ==================================================
router.get("/deals", dealController.listActiveDeals); // Public
router.get("/deals/:id", dealController.getDealById); // Public
router.post("/deals/claim/:id", protect, dealController.claimDeal); // Protected

// ==================================================
// 🛍️ NORMAL DEALS ROUTES
// ==================================================
router.get("/normal-deals", normalDealController.getAllDeals);
router.get("/normal-deals/featured", normalDealController.getFeaturedDeals);
router.get("/normal-deals/:id", normalDealController.getDealById);
// router.post("/normal-deals/create", protect, normalDealController.createDealFromInventory); // Admin only ideally

// ==================================================
// 🍓 FRUIT DROPS ROUTES
// ==================================================
router.get("/drops", protect, dropController.listDrops); // Contains "Seen" logic
router.get("/drops/:id", protect, dropController.getDrop);
router.post("/drops", protect, dropController.addDrop); // Admin only ideally

// ==================================================
// 👥 GROUP BUY ROUTES (Protected)
// ==================================================
router.post("/group/start", protect, groupController.startGroup);
router.post("/group/join", protect, groupController.joinGroup);
router.get("/group/lobby/:groupId", protect, groupController.viewLobby);

// ==================================================
// 👑 MEMBERSHIP ROUTES (Protected)
// ==================================================
router.post("/membership/buy", protect, membershipController.buyMembership);
router.get("/membership/status", protect, membershipController.getMembershipStatus);

// ==================================================
// 📦 ORDER ROUTES (Protected)
// ==================================================
router.get("/orders", protect, orderController.getMyOrders);
router.get("/orders/:id", protect, orderController.getOrderById);
router.post("/orders/place", protect, orderController.placeOrder); // COD / Wallet
// Razorpay
router.post("/orders/razorpay/create", protect, orderController.createRazorpayOrder);
router.post("/orders/razorpay/verify", protect, orderController.verifyRazorpayPayment);

// ==================================================
// 💰 WALLET ROUTES (Protected)
// ==================================================
router.get("/wallet", protect, walletController.getWallet);
router.post("/wallet/add", protect, walletController.addMoney);

// ==================================================
// ❓ Q&A ROUTES
// ==================================================
router.get("/qa/:productId", qaController.getQA); // Public
router.post("/qa/:productId", protect, qaController.askQuestion); // Protected
router.post("/qa/answer/:questionId", protect, qaController.answerQuestion); // Protected

// ==================================================
// ⚖️ COMPARE ROUTES (Protected)
// ==================================================
router.get("/compare", protect, compareController.getCompareList);
router.post("/compare/add", protect, compareController.addToCompare);
router.delete("/compare/remove/:id", protect, compareController.removeFromCompare);
router.delete("/compare/clear", protect, compareController.clearCompareList);

 
const gameController = require("../../controllers/Api/gameControllerApi");

router.get("/game/status", protect, gameController.getGameState);
router.post("/game/water", protect, gameController.waterTree);

 
module.exports = router;