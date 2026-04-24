const Notification = require("../../models/Notification");

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: user id missing" });
    }

    const list = await Notification.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      notifications: list,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;


    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: user id missing" });
    }

    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};