import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import AnalysisOutput from "../models/AnalysisOutput.js";

dotenv.config();

async function runMigration() {
  await connectDB();
  try {
    await AnalysisOutput.createCollection();
  } catch (error) {
    if (error?.codeName !== "NamespaceExists") {
      throw error;
    }
  }
  await AnalysisOutput.syncIndexes();

  console.log("AnalysisOutput collection and indexes are ready");
}

runMigration()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Migration failed", error);
    await mongoose.connection.close();
    process.exit(1);
  });
