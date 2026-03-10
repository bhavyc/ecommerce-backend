 
const Drop = require("../../models/FruitDrop");
const NormalDeal = require("../../models/NormalDeal");
// List all drops
// List all drops with pagination
exports.listDrops = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;   // current page
    const limit = 10;                             // drops per page
    const skip = (page - 1) * limit;

    const totalDrops = await Drop.countDocuments();

    const drops = await Drop.find()
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalDrops / limit);

    res.render("admin/drops/list", {
      drops,
      user: req.user,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.send("Error fetching drops");
  }
};


// Show create drop form
// exports.showCreateDrop = (req, res) => {
//   res.render("admin/drops/create", { error: null, user: req.user });
// };
 
exports.showCreateDrop = async (req, res) => {
  try {
    const normalDeals = await NormalDeal.find().sort({ createdAt: -1 });
    res.render("admin/drops/create", { error: null, user: req.user, normalDeals });
  } catch (err) {
    res.render("admin/drops/create", { error: "Error fetching normal deals", user: req.user, normalDeals: [] });
  }
};
// ... (listDrops, showCreateDrop waise hi rahenge) ...

// Handle create drop form
exports.createDrop = async (req, res) => {
  // startTime aur endTime ko req.body se nikaal diya hai
  const { title, description, image, price, featured, discount } = req.body;

  try {
    const drop = new Drop({
      title,
      description,
      image,
      // startTime aur endTime yahan se bhi hata diye gaye hain
      price,
      discount: discount || 0,
      featured: featured === "on" ? true : false,
    });

    await drop.save();
    res.redirect("/api/admin/drops");
  } catch (err) {
    console.error(err);
    res.render("admin/drops/create", { error: err.message, user: req.user });
  }
};
