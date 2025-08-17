const express = require("express");
const router = express.Router();
const GuestProfile = require("../models/GuestProfile");

router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    // Remove empty strings from preferences to avoid cast errors
    if (payload.preferences && typeof payload.preferences === "object") {
      Object.keys(payload.preferences).forEach((key) => {
        if (payload.preferences[key] === "") {
          delete payload.preferences[key];
        }
      });
    }
    if (
      payload?.preferences &&
      typeof payload.preferences.roomTemperatureCelsius === "string"
    ) {
      const n = parseFloat(payload.preferences.roomTemperatureCelsius);
      if (!Number.isNaN(n)) {
        payload.preferences.roomTemperatureCelsius = n;
      } else {
        delete payload.preferences.roomTemperatureCelsius;
      }
    }

    const query = payload.socketId
      ? { socketId: payload.socketId }
      : payload.email
      ? { email: payload.email }
      : {};

    let saved;
    if (Object.keys(query).length > 0) {
      saved = await GuestProfile.findOneAndUpdate(
        query,
        {
          $set: { ...payload, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      const profile = new GuestProfile(payload);
      saved = await profile.save();
    }

    const io = req.app.get("socketio");
    io.emit("profile_updated", saved);
    res.json(saved);
  } catch (err) {
    console.error("Failed to create profile", err);
    res
      .status(500)
      .json({ message: err?.message || "Failed to create profile" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const profiles = await GuestProfile.find().sort({ updatedAt: -1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profiles" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    const updated = await GuestProfile.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Profile not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

module.exports = router;
