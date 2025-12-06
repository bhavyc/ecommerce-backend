const GroupBuy = require("../models/GroupBuy");
const Deal = require("../models/24HrDeal");
const Order = require("../models/Order");
const User = require("../models/User");

// 🟢 1. Start a New Group
exports.startGroup = async (req, res) => {
  try {
    const { dealId, addressData, paymentMethod } = req.body; // Assume address comes from form
    const userId = req.user._id;

    // 1. Fetch Deal
    const deal = await Deal.findById(dealId);
    if (!deal || !deal.isGroupBuyAvailable) return res.send("Group buy not available");

    // 2. Create the "Pending" Order for the Leader
    const newOrder = new Order({
      user: userId,
      items: [{
        itemId: deal._id,
        itemType: "24HrDeal",
        title: deal.title,
        price: deal.groupPrice, // 🔥 Uses Lower Group Price
        quantity: 1,
        image: deal.image
      }],
      totalAmount: deal.groupPrice,
      shippingAddress: addressData, // Pass full address object from frontend
      paymentMethod: paymentMethod,
      orderStatus: "Group_Pending", // ⏳ Custom status: Waiting for group to fill
      paymentStatus: "PENDING"
    });
    await newOrder.save();

    // 3. Create the Group Lobby
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours from now

    const newGroup = new GroupBuy({
      deal: deal._id,
      members: [{ user: userId, orderId: newOrder._id }],
      requiredSize: deal.groupSize,
      expiresAt: expiresAt
    });
    await newGroup.save();

    // Redirect to a "Share this Link" page
    res.redirect(`/group/lobby/${newGroup._id}`);

  } catch (err) {
    console.error(err);
    res.send("Error starting group: " + err.message);
  }
};

// 🟢 2. Join an Existing Group
exports.joinGroup = async (req, res) => {
  try {
    const { groupId, addressData, paymentMethod } = req.body;
    const userId = req.user._id;

    const group = await GroupBuy.findById(groupId).populate("deal");
    if (!group) return res.send("Group not found");
    if (group.status !== "OPEN") return res.send("Group is closed or expired");
    if (new Date() > group.expiresAt) return res.send("Group expired");

    // Check if already joined
    const alreadyJoined = group.members.some(m => m.user.toString() === userId.toString());
    if (alreadyJoined) return res.send("You are already in this group");

    // 1. Create Order for this new Member
    const newOrder = new Order({
      user: userId,
      items: [{
        itemId: group.deal._id,
        itemType: "24HrDeal",
        title: group.deal.title,
        price: group.deal.groupPrice,
        quantity: 1,
        image: group.deal.image
      }],
      totalAmount: group.deal.groupPrice,
      shippingAddress: addressData,
      paymentMethod: paymentMethod,
      orderStatus: "Group_Pending",
      paymentStatus: "PENDING"
    });
    await newOrder.save();

    // 2. Add to Group
    group.members.push({ user: userId, orderId: newOrder._id });
    await group.save();

    // 3. 🏁 CHECK IF GROUP IS FULL (Winning Logic)
    if (group.members.length >= group.requiredSize) {
      group.status = "COMPLETED";
      await group.save();

      // Update ALL orders in this group to "Processing"
      const orderIds = group.members.map(m => m.orderId);
      await Order.updateMany(
        { _id: { $in: orderIds } },
        { orderStatus: "Processing", paymentStatus: "PAID" } // Assuming COD/Wallet deduction here
      );
      
      return res.render("group/success", { group });
    }

    res.redirect(`/group/lobby/${group._id}`);

  } catch (err) {
    console.error(err);
    res.send("Error joining group: " + err.message);
  }
};

// 🟢 3. View Lobby (The "Waiting Room")
exports.viewLobby = async (req, res) => {
  try {
    const group = await GroupBuy.findById(req.params.groupId)
      .populate("deal")
      .populate("members.user", "name"); // Show names of people who joined

    if (!group) return res.send("Lobby not found");

    const slotsLeft = group.requiredSize - group.members.length;
    
    // Generate Shareable Link
    const shareLink = `${req.protocol}://${req.get('host')}/group/lobby/${group._id}`;

    res.render("group/lobby", { 
      group, 
      slotsLeft, 
      user: req.user,
      shareLink 
    });
  } catch (err) {
    res.send("Error loading lobby");
  }
};