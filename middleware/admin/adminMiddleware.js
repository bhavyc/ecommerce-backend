const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "token";

exports.protect = (req, res, next) => {
  const token = req.cookies.adminToken;
console.log("hello");
  if (!token) return res.redirect("/api/admin/login");
console.log("Cookie found:", token);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.redirect("/api/admin/login");
 
    req.user = decoded;  //req mai admin add karenge isse 
    next();
  } catch (err) {
    console.error("JWT Error:", err);
    return res.redirect("/api/admin/login");
  }
};


exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).send("Access denied");
};
