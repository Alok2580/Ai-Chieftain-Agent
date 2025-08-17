const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const router = express.Router();
const Document = require("../models/Document");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (_) {}
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});

const upload = multer({ storage });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!req.file) return res.status(400).json({ message: "File missing" });
    // If text file or json, capture its text for LLM grounding
    let contentText = "";
    try {
      if (req.file.mimetype.startsWith("text/")) {
        contentText = fs.readFileSync(req.file.path, "utf8");
      } else if (req.file.mimetype === "application/pdf") {
        try {
          const pdfParse = require("pdf-parse");
          const data = await pdfParse(fs.readFileSync(req.file.path));
          contentText = data.text || "";
        } catch (e) {
          /* ignore */
        }
      } else if (req.file.mimetype === "application/json") {
        contentText = fs.readFileSync(req.file.path, "utf8");
      }
    } catch (_) {
      /* ignore */
    }
    // Optional Cloudinary upload if credentials are present
    let filePath = `/uploads/${req.file.filename}`;
    if (process.env.CLOUDINARY_URL) {
      try {
        const uploadRes = await cloudinary.uploader.upload(req.file.path, {
          folder: "chieftain-docs",
        });
        filePath = uploadRes.secure_url;
      } catch (e) {
        /* fallback to local */
      }
    }

    const doc = new Document({
      title,
      category,
      filePath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      contentText,
    });
    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error("Upload failed", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const docs = await Document.find().sort({ uploadedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    const relative = doc.filePath.replace(/^\/+/, "");
    const absolute = path.join(__dirname, "..", relative);
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete document" });
  }
});

module.exports = router;
