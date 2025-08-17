const express = require("express");
const router = express.Router();
const MenuItem = require("../models/MenuItem");

router.get("/", async (_req, res) => {
  try {
    const items = await MenuItem.find().sort({ category: 1, name: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch menu" });
  }
});

// New route to fetch items by category
router.get("/:category", async (req, res) => {
  try {
    const { category } = req.params;
    // Using a case-insensitive regex for robust matching
    const items = await MenuItem.find({
      category: { $regex: new RegExp(`^${category}$`, "i") },
    }).sort({ name: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch menu for category" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { category, name, price, available } = req.body;
    const item = new MenuItem({ category, name, price, available });
    await item.save();
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to create" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete" });
  }
});

module.exports = router;
