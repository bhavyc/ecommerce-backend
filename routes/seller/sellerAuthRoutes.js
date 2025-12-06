const express = require("express");
const router = express.Router();
const sellerAuthController = require("../../controllers/seller/sellerAuthController");

// ===== GET ROUTES =====
// Render registration form
router.get("/register", (req, res) => {
  res.render("seller/register"); // views/seller/register.ejs
});

    



router.get("/under-review", sellerAuthController.underReview);
// Render login form
router.get("/login", (req, res) => {
  res.render("seller/login"); // views/seller/login.ejs
});
                                                                   


// ===== POST ROUTES =====
// Seller registration
router.post("/register", sellerAuthController.register);

// Seller login
router.post("/login", sellerAuthController.login);

// Seller logout
router.get("/logout", sellerAuthController.logout);

router.get("/dashboard", sellerAuthController.getDashboard);
module.exports = router;
