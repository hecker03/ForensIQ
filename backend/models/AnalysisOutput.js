import mongoose from "mongoose";

const analysisOutputSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    created_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    file_size: {
      type: Number,
      required: true,
      min: 0,
    },
    file_hash: {
      type: String,
      required: false,
      trim: true,
      default: null,
      maxlength: 128,
    },
    result_payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    chart_datasets: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "error"],
      required: true,
    },
    error_message: {
      type: String,
      required: false,
      default: null,
      maxlength: 2000,
    },
    duration_ms: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
  },
  {
    versionKey: false,
  },
);

analysisOutputSchema.index({ user: 1, created_at: -1 });

const AnalysisOutput = mongoose.model("AnalysisOutput", analysisOutputSchema);

export default AnalysisOutput;
