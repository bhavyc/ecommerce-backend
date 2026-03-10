// routes/googleAuthRoutes.js
const express = require("express");
const router = express.Router();
const passport = require("passport");

// Trigger Google login
router.get("/", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google OAuth callback
router.get("/callback",
  passport.authenticate("google", { failureRedirect: "/auth/login" }),
  (req, res) => {
    // Successful login
    res.redirect("/drops"); // Redirect to your drops page
  }
);

// Logout route
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/"); // Redirect to homepage after logout
  });
});

module.exports = router;
