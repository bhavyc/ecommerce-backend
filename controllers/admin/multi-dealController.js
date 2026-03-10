const NewDeal = require("../../models/NormalDeal");
const Drop = require("../../models/FruitDrop");
const Deal = require("../../models/24HrDeal");

// GET: Render form
exports.renderAddForm = (req, res) => {
  res.render("admin/multi-deal/addDeal");
};

// POST: Save data to selected models
exports.addMultiDeal = async (req, res) => {
  try {
    const { title, description, image, price, discount, startTime, endTime, collections } = req.body;

    if (!collections) return res.status(400).send("Please select at least one model.");
    if (!image) return res.status(400).send("Image URL is required.");

    const data = {
      title,
      description,
      image,
      price,
      discount: discount || 0,
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
    };

    const selected = Array.isArray(collections) ? collections : [collections];
    const tasks = [];

    if (selected.includes("newdeal")) {
      tasks.push(NewDeal.create({
        title,
        description,
        image,
        price,
        featured: false,
      }));
    }

    if (selected.includes("drop")) {
      tasks.push(Drop.create(data));
    }

    if (selected.includes("deal")) {
      tasks.push(Deal.create(data));
    }

    await Promise.all(tasks);
    
    res.send(` Data saved successfully in: ${selected.join(", ")}`);
  } catch (err) {
    console.error("Error saving deal:", err);
    res.status(500).send("Internal Server Error");
  }
};
