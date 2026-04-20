import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "Name, email, and password are required" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ email: normalizedEmail });

    if (exists) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const user = await User.create({ name: name.trim(), email: normalizedEmail, password });

    const token = signToken(user._id.toString());
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const validPassword = await user.comparePassword(password);

    if (!validPassword) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = signToken(user._id.toString());
    res.json({ token, user: user.toSafeObject() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: user.toSafeObject() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load user" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (name === undefined && email === undefined) {
      res.status(400).json({ message: "At least one field (name or email) is required" });
      return;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (name !== undefined) {
      if (typeof name !== "string") {
        res.status(400).json({ message: "Name must be a string" });
        return;
      }

      user.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string") {
        res.status(400).json({ message: "Email must be a string" });
        return;
      }

      const normalizedEmail = normalizeEmail(email);
      const existing = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.userId },
      });

      if (existing) {
        res.status(409).json({ message: "Email already registered" });
        return;
      }

      user.email = normalizedEmail;
    }

    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (error) {
    if (error?.name === "ValidationError") {
      const firstMessage = Object.values(error.errors || {})[0]?.message;
      res.status(400).json({ message: firstMessage || "Invalid profile data" });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Unable to update profile" });
  }
});

export default router;
