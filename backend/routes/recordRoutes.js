import express from "express";
import mongoose from "mongoose";
import InputRecord from "../models/InputRecord.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const records = await InputRecord.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch records" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, category, content } = req.body;

    if (!title || !content) {
      res.status(400).json({ message: "Title and content are required" });
      return;
    }

    const record = await InputRecord.create({
      user: req.userId,
      title: title.trim(),
      category: (category || "General").trim(),
      content: content.trim(),
    });

    res.status(201).json({ record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to save record" });
  }
});

router.delete("/:recordId", async (req, res) => {
  try {
    const { recordId } = req.params;

    if (!mongoose.isValidObjectId(recordId)) {
      res.status(400).json({ message: "Invalid record id" });
      return;
    }

    const deletedRecord = await InputRecord.findOneAndDelete({
      _id: recordId,
      user: req.userId,
    });

    if (!deletedRecord) {
      res.status(404).json({ message: "Record not found" });
      return;
    }

    res.json({ message: "Record removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to remove record" });
  }
});

export default router;
