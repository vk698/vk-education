const mongoose = require('mongoose');
const eventSchema = new mongoose.Schema({
  title: String,
  date: Date,
  time: String,
  duration: Number,
  group: String,
  image: String,
  joinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
module.exports = mongoose.model('Event', eventSchema);