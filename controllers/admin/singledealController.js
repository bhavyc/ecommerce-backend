const NewDeal = require("../../models/NormalDeal");
const Deal = require("../../models/24HrDeal");
const Drop = require("../../models/FruitDrop");

// Show all NewDeals
exports.listNewDeals = async (req, res) => {
    const newDeals = await NewDeal.find();
    res.render("admin/newdeals", { newDeals });
};

// Show form to create Deal or Drop from NewDeal
exports.showCreateForm = async (req, res) => {
    const { id } = req.params;
    const { type } = req.query; // 'deal' or 'drop'
    const newDeal = await NewDeal.findById(id);
    res.render("admin/createFromNewDeal", { newDeal, type });
};

// Handle form submission
exports.createFromNewDeal = async (req, res) => {
  try {
    const { newDealId, type, discount } = req.body;

    const newDeal = await NewDeal.findById(newDealId);
    if (!newDeal) return res.status(404).send("NewDeal not found");

    if (type === "deal") {
      // ✅ Create a 24-hour auto-expiring deal
      const deal = new Deal({
        title: newDeal.title,
        description: newDeal.description,
        image: newDeal.image,
        price: newDeal.price,
        discount: discount || 0,
        featured: newDeal.featured || false,
      });
      await deal.save();
      return res.redirect("/api/admin/deals");

    } else if (type === "drop") {
      // ✅ Create a Drop (non-expiring)
      const drop = new Drop({
        title: newDeal.title,
        description: newDeal.description,
        image: newDeal.image,
        price: newDeal.price,
        discount: discount || 0,
        featured: newDeal.featured || false,
      });
      await drop.save();
      return res.redirect("/api/admin/drops");
    }

    res.send("Invalid type selected");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating from NewDeal: " + err.message);
  }
};
// Show dynamic form
exports.showDynamicCreateForm = async (req, res) => {
  const newDeals = await NewDeal.find();
  res.render("admin/single-deal/createform", { newDeals });
};

// Handle form submission
exports.createFromNewDealDynamic = async (req, res) => {
    const { newDealId, type, discount } = req.body;

    try {
        const newDeal = await NewDeal.findById(newDealId);
        if (!newDeal) return res.status(404).send("NewDeal not found");

        if (type === "deal") {
            // ✅ Create 24hr auto-expiring deal
            await Deal.create({
                title: newDeal.title,
                description: newDeal.description,
                image: newDeal.image,
                price: newDeal.price,
                featured: newDeal.featured || false,
                discount: discount || 0
            });
        }
        else if (type === "drop") {
            // ✅ Create Drop (non-expiring)
            await Drop.create({
                title: newDeal.title,
                description: newDeal.description,
                image: newDeal.image,
                price: newDeal.price,
                featured: newDeal.featured || false,
                discount: discount || 0
            });
        }

        res.redirect("/api/admin/single-deals");
    } catch (err) {
        console.error("Error creating from NewDeal:", err);
        res.status(500).send("Error creating from NewDeal: " + err.message);
    }
};
