import mongoose from "mongoose";

const inputRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
      maxlength: 40,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: true },
);

const InputRecord = mongoose.model("InputRecord", inputRecordSchema);

export default InputRecord;
