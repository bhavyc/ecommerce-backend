const Drop = require("../../models/FruitDrop");
const User = require("../../models/User"); // Required to update 'seenDrops'
// const WelcomeDrop = require("../models/WelcomeDrop"); // Keeping import as requested

// ---------------- LIST DROPS (Main Logic) ----------------
exports.listDrops = async (req, res) => {
  try {
    const now = new Date();
    // Fetch full user document because we need to modify 'seenDrops' and call .save()
    const user = await User.findById(req.user.id || req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check Membership
    const isMember = user.isMember && user.membershipExpiry > now;

    // --- NON-MEMBER LOGIC ---
    if (!isMember) {
      const teaserDrops = await Drop.find({ featured: true });
      
      // Mask sensitive details if needed, or send as is
      return res.status(200).json({
        success: true,
        isMember: false,
        message: "Membership required for full access",
        drops: teaserDrops
      });
    }

    // --- MEMBER LOGIC ---
    const featuredDrops = await Drop.find({ featured: true });

    // Create a map for quick lookup: { "dropId": "seenAtDate" }
    const seenDropsMap = new Map(user.seenDrops.map(d => [d.dropId.toString(), d.seenAt]));
    let needsUserUpdate = false;

    const processedDrops = await Promise.all(featuredDrops.map(async (drop) => {
      const dropIdString = drop._id.toString();
      let expiryTime = null;
      let isOfferActive = false;

      // Check if user has seen this drop before
      if (seenDropsMap.has(dropIdString)) {
        // Retrieve previous seen time
        const seenAt = seenDropsMap.get(dropIdString);
        expiryTime = new Date(seenAt.getTime() + 15 * 60 * 1000); // 15 mins later
        
        // Check if still within 15 mins
        if (now < expiryTime) {
          isOfferActive = true;
        }
      } else {
        // First time viewing
        isOfferActive = true;
        expiryTime = new Date(now.getTime() + 15 * 60 * 1000);
        
        // Push to user's history
        user.seenDrops.push({ dropId: drop._id, seenAt: now });
        needsUserUpdate = true;
      }

      // Calculate Price
      const finalPrice = drop.discount > 0
        ? drop.price - (drop.price * drop.discount / 100)
        : drop.price;

      return {
        ...drop.toObject(),
        isOfferActive,
        expiryTime,
        finalPrice: parseFloat(finalPrice.toFixed(2)),
      };
    }));

    // Save user if we added new seen drops
    if (needsUserUpdate) {
      await user.save();
    }

    res.status(200).json({
      success: true,
      isMember: true,
      drops: processedDrops
    });

  } catch (err) {
    console.error("Error in listDrops:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- GET SINGLE DROP ----------------
exports.getDrop = async (req, res) => {
  try {
    const drop = await Drop.findById(req.params.id);
    if (!drop) {
      return res.status(404).json({ success: false, message: "Drop not found" });
    }

    // Fetch user for membership check
    const user = await User.findById(req.user.id || req.user._id);
    const isMember = user && user.isMember && user.membershipExpiry > new Date();

    const finalPrice = isMember 
      ? drop.price * (1 - (drop.discount / 100)) 
      : drop.price;

    res.status(200).json({
      success: true,
      data: {
        ...drop.toObject(),
        isMember,
        finalPrice: parseFloat(finalPrice.toFixed(2))
      }
    });

  } catch (err) {
    console.error("Error in getDrop:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- ADD DROP (Admin) ----------------
exports.addDrop = async (req, res) => {
  const { title, description, image, startTime, endTime, price, featured, discount } = req.body;
  
  try {
    const newDrop = new Drop({
      title,
      description,
      image,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      price: price || 0,
      discount: discount || 0,
      featured: featured === true || featured === "true" || featured === "on", 
    });

    await newDrop.save();

    res.status(201).json({
      success: true,
      message: "Drop created successfully",
      drop: newDrop
    });

  } catch (err) {
    console.error("Add Drop error:", err);
    res.status(500).json({ success: false, message: "Error creating drop", error: err.message });
  }
};