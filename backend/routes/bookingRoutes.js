const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Booking = require("../models/booking");

function dateRange(start, end) {
  const out = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function dynamicPrice(base, demandFactor) {
  const surge = 1 + Math.min(0.8, Math.max(0, demandFactor));
  return Math.round(base * surge * 100) / 100;
}

router.get("/availability", async (req, res) => {
  try {
    const { checkin, checkout, guests = 2 } = req.query;
    if (!checkin || !checkout)
      return res.status(400).json({ message: "Missing dates" });
    const rooms = await Room.find().lean();
    const range = dateRange(checkin, checkout);
    const availability = [];
    for (const room of rooms) {
      // naive demand: count existing bookings that mention this room type in details
      const demand = await Booking.countDocuments({
        details: new RegExp(room.type, "i"),
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      });
      const demandFactor = Math.min(0.5 + demand / 50, 0.8);
      const price = dynamicPrice(room.baseRate, demandFactor);
      const canFit = guests <= room.capacity;
      availability.push({
        type: room.type,
        capacity: room.capacity,
        pricePerNight: price,
        totalNights: range.length - 1,
        total: price * (range.length - 1),
        media: room.media || [],
        available: canFit && room.inventoryCount > 0,
        upsells: ["Airport transfer", "Breakfast package", "Late checkout"],
      });
    }
    res.json(availability);
  } catch (e) {
    res.status(500).json({ message: "Failed to compute availability" });
  }
});

router.post("/confirm", async (req, res) => {
  try {
    const { type, checkin, checkout, guests, total, socketId } = req.body;
    if (!type || !checkin || !checkout || !total)
      return res.status(400).json({ message: "Missing fields" });
    const details = `Booking request: ${type}, ${
      guests || 2
    } guests, ${checkin} to ${checkout}, total $${Number(total).toFixed(2)}`;
    const booking = await Booking.create({
      details,
      socketId: socketId || "anonymous",
    });
    const io = req.app.get("socketio");
    io.emit("new_booking", booking);
    res.json(booking);
  } catch (e) {
    res.status(500).json({ message: "Failed to confirm booking" });
  }
});

module.exports = router;
