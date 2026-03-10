const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/authController");
const User = require("../../models/User");
// routes/adminAuth.js
 

// Admin Login
router.get("/login", adminController.showLogin);
router.post("/login", adminController.login);

// Admin Logout
router.get("/logout", adminController.logout);

// Admin Dashboard (protected)
router.get("/dashboard", adminController.protect, adminController.dashboard);

// Admin Registration
router.get("/register", adminController.showRegister);
router.post("/register", adminController.register);

router.get("/sellers", adminController.getSellers);

// Delete seller
router.get("/delete-seller/:id", adminController.deleteSeller);
module.exports = router;
