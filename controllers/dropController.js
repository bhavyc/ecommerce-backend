const Drop = require("../models/FruitDrop");
const Claim = require("../models/Claim");
const Deal = require("../models/24HrDeal");
const dis=20;
const WelcomeDrop = require("../models/WelcomeDrop"); // 👈 1. WelcomeDrop model import karein
 
 
// controllers/dropController.js
 
// exports.listDrops = async (req, res) => {
//   try {
//     const now = new Date();
//     const user = req.user;

//     const isMember = user?.isMember && user.membershipExpiry > now;
//     if (!isMember) {
//       // Agar member nahi hai, to use saare featured drops teaser ke roop mein dikha do
//       const teaserDrops = await Drop.find({ featured: true });
//       return res.render("drop/drops", {
//         drops: teaserDrops,
//         isMember: false,
//         user: user
//       });
//     }

//     // === LOGIC FOR MEMBERS ===

//     // 1. Saare featured drops fetch karo
//     const featuredDrops = await Drop.find({ featured: true });

//     // 2. User ke 'seenDrops' ko aasaani se access karne ke liye ek map banao
//     const seenDropsMap = new Map(user.seenDrops.map(d => [d.dropId.toString(), d.seenAt]));
//     let needsUserUpdate = false; // Flag to check if we need to save the user document

//     // 3. Har drop ko process karo
//     const processedDrops = await Promise.all(featuredDrops.map(async (drop) => {
//       const dropIdString = drop._id.toString();
//       let expiryTime = null;
//       let isOfferActive = false;

//       const alreadyClaimed = await Claim.findOne({ user: user._id, drop: drop._id });
//       if (alreadyClaimed) {
//         return { ...drop.toObject(), alreadyClaimed: true };
//       }

//       // 4. Check karo ki user ne yeh drop pehle dekha hai ya nahi
//       if (seenDropsMap.has(dropIdString)) {
//         // Agar haan, to purana time use karke expiry calculate karo
//         const seenAt = seenDropsMap.get(dropIdString);
//         expiryTime = new Date(seenAt.getTime() + 15 * 60 * 1000);
//         if (now < expiryTime) {
//           isOfferActive = true;
//         }
//       } else {
//         // 5. Agar nahi (FIRST TIME VIEW), to abhi timer shuru karo
//         isOfferActive = true;
//         expiryTime = new Date(now.getTime() + 15 * 60 * 1000);

//         // User ke document mein is drop ko add karne ke liye mark karo
//         user.seenDrops.push({ dropId: drop._id, seenAt: now });
//         needsUserUpdate = true;
//       }

//       const finalPrice = drop.discount > 0
//         ? drop.price - (drop.price * drop.discount / 100)
//         : drop.price;

//       return {
//         ...drop.toObject(),
//         isOfferActive: isOfferActive,
//         expiryTime: expiryTime,
//         finalPrice: finalPrice,
//         alreadyClaimed: false
//       };
//     }));

//     // 6. Agar user document mein koi naye 'seenDrops' add hue hain, to use save karo
//     if (needsUserUpdate) {
//       await user.save();
//     }

//     res.render("drop/drops", {
//       drops: processedDrops,
//       user: user,
//       isMember: true
//     });

//   } catch (err) {
//     console.error("Error in listDrops:", err);
//     res.send("Error: " + err.message);
//   }
// };





// Claim logic ko bhi update karna hoga
// exports.claimDrop = async (req, res) => {
//   try {
//     const user = req.user;
//     const dropId = req.params.id;

//     if (!user.isMember || user.membershipExpiry < new Date()) {
//       return res.status(403).send("Membership required.");
//     }

//     // Drop ke liye user ka personal timer dhoondho
//     const seenInfo = user.seenDrops.find(d => d.dropId.toString() === dropId);
//     if (!seenInfo) {
//       // Aisa hona nahi chahiye, par safety ke liye
//       return res.status(400).send("Offer not started for you yet. Please refresh.");
//     }

//     const offerExpiry = new Date(seenInfo.seenAt.getTime() + 15 * 60 * 1000);
//     if (new Date() > offerExpiry) {
//       return res.status(403).send("Your 15-minute offer for this specific drop has expired.");
//     }

//     // ... (baaki ka claim logic waisa hi rahega)
//     const existingClaim = await Claim.findOne({ user: user._id, drop: dropId });
//     if (existingClaim) return res.send("You have already claimed this drop.");

//     await Claim.create({ user: user._id, drop: dropId });
//     res.redirect("/api/auth/profile");

//   } catch (err) {
//     console.error("Claim error:", err);
//     res.send("Error claiming drop: " + err.message);
//   }
// };
// Show single drop details
// Show single drop details
// exports.showDrop = async (req, res) => {
//   try {
//     const drop = await Drop.findById(req.params.id);
//     if (!drop) return res.send("Drop not found");

//     const totalClaims = await Claim.countDocuments({ drop: drop._id });
//     const alreadyClaimed = await Claim.findOne({ user: req.user._id, drop: drop._id });

//     const isMember = req.user.isMember && req.user.membershipExpiry > new Date();

//     // Use drop-specific discount
//     const finalPrice = isMember 
//       ? drop.price * (1 - (drop.discount / 100)) 
//       : drop.price;

//     res.render("drop/dropDetail", {
//       drop,
//       user: req.user,
//       alreadyClaimed: !!alreadyClaimed,
//       isMember,
//       totalClaims,
//       finalPrice // pass this to EJS
//     });
//   } catch (err) {
//     console.error("Error in showDrop:", err);
//     res.send("Error: " + err.message);
//   }
// };
  




exports.listDrops = async (req, res) => {
  try {
    const now = new Date();
    const user = req.user;

    const isMember = user?.isMember && user.membershipExpiry > now;
    if (!isMember) {
      const teaserDrops = await Drop.find({ featured: true });
      return res.render("drop/drops", {
        drops: teaserDrops,
        isMember: false,
        user: user
      });
    }

    const featuredDrops = await Drop.find({ featured: true });
    const seenDropsMap = new Map(user.seenDrops.map(d => [d.dropId.toString(), d.seenAt]));
    let needsUserUpdate = false;

    const processedDrops = await Promise.all(featuredDrops.map(async (drop) => {
      const dropIdString = drop._id.toString();
      let expiryTime = null;
      let isOfferActive = false;

      // Claim check is removed from here

      if (seenDropsMap.has(dropIdString)) {
        const seenAt = seenDropsMap.get(dropIdString);
        expiryTime = new Date(seenAt.getTime() + 15 * 60 * 1000);
        if (now < expiryTime) {
          isOfferActive = true;
        }
      } else {
        isOfferActive = true;
        expiryTime = new Date(now.getTime() + 15 * 60 * 1000);
        user.seenDrops.push({ dropId: drop._id, seenAt: now });
        needsUserUpdate = true;
      }

      const finalPrice = drop.discount > 0
        ? drop.price - (drop.price * drop.discount / 100)
        : drop.price;

      return {
        ...drop.toObject(),
        isOfferActive,
        expiryTime,
        finalPrice,
      };
    }));

    if (needsUserUpdate) {
      await user.save();
    }

    res.render("drop/drops", {
      drops: processedDrops,
      user: user,
      isMember: true
    });

  } catch (err) {
    console.error("Error in listDrops:", err);
    res.send("Error: " + err.message);
  }
};

// ❌ The claimDrop function has been removed entirely.

// ... (showAddDrop, addDrop, showDrop functions can remain, but showDrop claim logic needs update)

exports.showDrop = async (req, res) => {
  try {
    const drop = await Drop.findById(req.params.id);
    if (!drop) return res.send("Drop not found");

    const isMember = req.user.isMember && req.user.membershipExpiry > new Date();
    const finalPrice = isMember 
      ? drop.price * (1 - (drop.discount / 100)) 
      : drop.price;

    res.render("drop/dropDetail", {
      drop,
      user: req.user,
      isMember,
      finalPrice,
      // No 'alreadyClaimed' or 'totalClaims' needed
    });
  } catch (err) {
    console.error("Error in showDrop:", err);
    res.send("Error: " + err.message);
  }
};
exports.showAddDrop = (req, res) => {
  res.render("drop/addDrop", { error: null, user: req.user });
};

// Handle add drop (admin)
exports.addDrop = async (req, res) => {
  const { title, description, image, startTime, endTime, price, featured } = req.body;
  try {
    const newDrop = new Drop({
      title,
      description,
      image,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      price: price || 0,
      featured: featured === "on" ? true : false,
    });
    await newDrop.save();
    res.redirect("/drops");
  } catch (err) {
    console.error("Add Drop error:", err);
    res.render("drop/addDrop", {error: err.message, user: req.user });
  }
};


 
 
