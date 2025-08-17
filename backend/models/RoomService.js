const mongoose = require("mongoose");

const roomServiceSchema = new mongoose.Schema({
  details: { type: String, required: true },
  status: { type: String, required: true, default: "Pending" },
  socketId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("RoomService", roomServiceSchema);
