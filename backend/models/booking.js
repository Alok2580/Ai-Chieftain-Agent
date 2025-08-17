const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  details: { type: String, required: true },
  status: { type: String, required: true, default: "Pending" },
  socketId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Booking", bookingSchema);
