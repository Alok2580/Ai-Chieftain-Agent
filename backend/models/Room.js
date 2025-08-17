const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true },
  capacity: { type: Number, required: true },
  inventoryCount: { type: Number, required: true },
  baseRate: { type: Number, required: true },
  media: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

roomSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Room", roomSchema);
