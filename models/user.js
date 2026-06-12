const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  grade: String,
  subjects: [String],
  avatarUrl: String,
  about: String,
  school: String,
  years: String,
  gpa: String,
  social: { github: String, linkedin: String, twitter: String },
  badges: [String],
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  postsCount: { type: Number, default: 0 },
  notesCount: { type: Number, default: 0 },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);