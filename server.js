const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const UserSchema = new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true },
  password: String,
  grade: String,
  subjects: [String],
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
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

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName: String,
  userAvatar: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const CommunityPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  image: String,
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [CommentSchema],
  createdAt: { type: Date, default: Date.now }
});
const CommunityPost = mongoose.model("CommunityPost", CommunityPostSchema);

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  description: String,
  image: { type: String, default: "https://via.placeholder.com/100" },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});
const Group = mongoose.model("Group", GroupSchema);

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  time: String,
  duration: Number,
  group: String,
  image: { type: String, default: "https://via.placeholder.com/100" },
  joinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model("Event", EventSchema);

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

// -------------------- USER AUTH --------------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { fullname, email, password, grade, subjects } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ fullname, email, password: hashed, grade, subjects: subjects || [] });
    await newUser.save();
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: newUser._id, fullname, email, grade, subjects } });
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/auth/update", authenticateToken, async (req, res) => {
  try {
    const { fullname, grade, subjects } = req.body;
    const updated = await User.findByIdAndUpdate(req.user.userId, { fullname, grade, subjects }, { new: true }).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// -------------------- COURSES --------------------
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: "Error fetching courses" });
  }
});

app.post("/api/courses/enroll", authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user.enrolledCourses) user.enrolledCourses = [];
    if (!user.enrolledCourses.includes(courseId)) {
      user.enrolledCourses.push(courseId);
      await user.save();
    }
    res.json({ message: "Enrolled successfully" });
  } catch (err) {
    res.status(500).json({ error: "Enrollment failed" });
  }
});

// -------------------- COMMUNITY POSTS --------------------
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

app.post("/api/posts/:postId/like", authenticateToken, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId);
    const userId = req.user.userId;
    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }
    await post.save();
    res.json({ liked: !post.likes.includes(userId), count: post.likes.length });
  } catch (err) {
    res.status(500).json({ error: "Like failed" });
  }
});

app.post("/api/posts/:postId/comment", authenticateToken, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId);
    const user = await User.findById(req.user.userId);
    const newComment = {
      userId: user._id,
      userName: user.fullname,
      userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=f97316&color=fff`,
      text: req.body.text
    };
    post.comments.push(newComment);
    await post.save();
    res.json(newComment);
  } catch (err) {
    res.status(500).json({ error: "Comment failed" });
  }
});

// -------------------- GROUPS --------------------
app.get("/api/groups", async (req, res) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: "Error fetching groups" });
  }
});

app.post("/api/groups", authenticateToken, async (req, res) => {
  try {
    const { name, subject, description, image } = req.body;
    const newGroup = new Group({
      name, subject, description,
      image: image || "https://via.placeholder.com/100",
      members: [req.user.userId],
      createdBy: req.user.userId
    });
    await newGroup.save();
    res.json(newGroup);
  } catch (err) {
    res.status(500).json({ error: "Group creation failed" });
  }
});

app.post("/api/groups/:groupId/join", authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group.members.includes(req.user.userId)) {
      group.members.push(req.user.userId);
      await group.save();
    }
    res.json({ message: "Joined group" });
  } catch (err) {
    res.status(500).json({ error: "Join failed" });
  }
});

// -------------------- EVENTS --------------------
app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.post("/api/events", authenticateToken, async (req, res) => {
  try {
    const { title, date, time, duration, group, image } = req.body;
    const newEvent = new Event({
      title, date: new Date(date), time, duration: duration || 60, group: group || "General",
      image: image || "https://via.placeholder.com/100"
    });
    await newEvent.save();
    res.json(newEvent);
  } catch (err) {
    res.status(500).json({ error: "Event creation failed" });
  }
});

app.post("/api/events/:eventId/join", authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event.joinedBy.includes(req.user.userId)) {
      event.joinedBy.push(req.user.userId);
      await event.save();
    }
    res.json({ message: "Joined event" });
  } catch (err) {
    res.status(500).json({ error: "Join failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));