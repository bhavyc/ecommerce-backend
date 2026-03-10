const jwt = require("jsonwebtoken");
const User = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET || "token";


exports.protect = (req, res, next) => {
  let token;

  // 1.Check Authorization Header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } 
  // 2. Check Cookies (Optional backup)
  else if (req.cookies && req.cookies.userToken) {
    token = req.cookies.userToken;
  }

  // GALAT (Old EJS Style): Yeh hatana hai
  // if (!token) return res.redirect('/login'); 

  // SAHI (API Style): JSON Error bhejo
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized to access this route" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    //GALAT: res.redirect('/login');
    //SAHI:
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
 

exports.requireMembership = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!user.isMember) {
      return res.status(403).send("Membership required to access this feature.");
    }

    // Expiry check
    if (user.membershipExpiry && user.membershipExpiry < new Date()) {
      user.isMember = false;
      await user.save();
      return res.status(403).send("Your membership has expired. Please renew.");
    }

    // Attach fresh user to request
    req.user = user;
    next();
  } catch (err) {
    console.error("Membership middleware error:", err);
    res.status(500).send("Something went wrong. Try again.");
  }
};


