const normalDeal = require("../../models/NormalDeal");
const Product = require("../../models/Product");
// List all normal deals
exports.listNormalDeals = async (req, res) => {
  try {
    const normalDeals = await normalDeal.find();
    res.render("admin/normalDeals/list", { normalDeals, user: req.user });
  } catch (err) {
    console.error(err);
    res.send("Error fetching normal deals");
  }
};

// 👇 2. Is function ko update karein taaki yeh products bheje
exports.showCreateNormalDeal = async (req, res) => {
  try {
    const products = await Product.find({}, 'title _id'); // Database se saare products nikalein
    res.render("admin/normalDeals/create", { 
      error: null, 
      user: req.user,
      products: products // products ki list ko form mein bhejein
    });
  } catch(err) {
    res.render("admin/normalDeals/create", { error: "Could not load product list.", user: req.user, products: [] });
  }
};

// 👇 3. Is function ko update karein taaki yeh productId save kare
exports.createNormalDeal = async (req, res) => {
  try {
    // Form se 'productId' ko bhi nikalein
    const { title, description, image, price, featured, productId } = req.body;

    const newDeal = new normalDeal({
      title,
      description,
      image,
      price,
      featured: featured === 'on',
      product: productId // 👈 Product ID ko yahan save karein
    });

    await newDeal.save();
    res.redirect("/admin/normal-deals"); 

  } catch (err) {
    console.error("Error creating deal:", err); // Asli error terminal mein dekhne ke liye
    // Agar error ho to products dobara bhejne honge taaki dropdown kaam kare
    const products = await Product.find({}, 'title _id');
    res.render("admin/normalDeals/create", { 
      error: "Failed to create deal. Please make sure you selected a product.", 
      user: req.user,
      products: products
    });
  }
};