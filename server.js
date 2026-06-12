const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const multer = require("multer");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://vishalkumar2257r_db_user:oPKxmiOQQF09554e@cluster0.pmyxiym.mongodb.net/myDatabase")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ==================== MODELS ====================
const UserSchema = new mongoose.Schema({
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
const User = mongoose.model("User", UserSchema);

const CourseSchema = new mongoose.Schema({
  title: String,
  description: String,
  image: String,
  duration: String,
  level: String,
  price: Number,
  type: { type: String, enum: ["free", "premium", "upcoming"] },
  createdAt: { type: Date, default: Date.now }
});
const Course = mongoose.model("Course", CourseSchema);

const CommunityPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: String,
  image: String,
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    createdAt: Date
  }],
  createdAt: { type: Date, default: Date.now }
});
const CommunityPost = mongoose.model("CommunityPost", CommunityPostSchema);

const GroupSchema = new mongoose.Schema({
  name: String,
  subject: String,
  description: String,
  image: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});
const Group = mongoose.model("Group", GroupSchema);

const EventSchema = new mongoose.Schema({
  title: String,
  date: Date,
  time: String,
  duration: Number,
  group: String,
  image: String,
  joinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model("Event", EventSchema);

// ==================== HELPERS ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access denied" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

// ==================== AUTH ROUTES ====================
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { fullname, email, password, grade, subjects } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullname,
      email,
      password: hashedPassword,
      grade: grade || "",
      subjects: subjects || [],
      avatarUrl: "",
      about: "",
      school: "",
      years: "",
      gpa: "",
      social: {},
      badges: ["New Member"]
    });
    await newUser.save();
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: newUser._id, fullname, email, grade, subjects } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, fullname: user.fullname, email, grade: user.grade, subjects: user.subjects } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/auth/update", authenticateToken, upload.single("avatarUrl"), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      updateData.avatarUrl = `data:${mimeType};base64,${base64}`;
    }
    delete updateData._id;
    delete updateData.password;
    delete updateData.resetPasswordToken;
    delete updateData.resetPasswordExpires;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: error.message || "Update failed" });
  }
});

// ========== FORGOT PASSWORD – FIXED FOR RENDER ==========
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "No account with that email" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `https://vk698.github.io/vk-education/reset-password.html?token=${token}`;

    // ✅ Using port 465 with SSL – more reliable on Render
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000
    });

    await transporter.sendMail({
      from: `"StudyHub" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "StudyHub - Password Reset",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>
             <p>If the button doesn't work, copy this link: ${resetUrl}</p>`
    });

    res.json({ message: "Reset email sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: error.message || "Failed to send reset email" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = "";
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ message: "Password updated. You can now login." });
  } catch (error) {
    res.status(500).json({ error: "Reset failed" });
  }
});

// ==================== OTHER API ROUTES ====================
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: "Error fetching courses" });
  }
});

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await CommunityPost.find().sort({ createdAt: -1 }).populate("userId", "fullname");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Error fetching posts" });
  }
});

app.post("/api/posts", authenticateToken, async (req, res) => {
  try {
    const { content, image } = req.body;
    const newPost = new CommunityPost({ userId: req.user.userId, content, image });
    await newPost.save();
    await newPost.populate("userId", "fullname");
    res.json(newPost);
  } catch (err) {
    res.status(500).json({ error: "Post creation failed" });
  }
});

app.get("/api/groups", async (req, res) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: "Error fetching groups" });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));