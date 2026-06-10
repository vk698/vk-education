const mongoose = require("mongoose");
const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  image: String,
  duration: String,
  level: String,
  price: Number,
  type: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("Course", courseSchema);