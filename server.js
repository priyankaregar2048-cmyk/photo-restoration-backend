const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Photo Restoration Pro Asset Puller"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/retrieve", async (req, res) => {
  try {
    const { targetUrl } = req.body;

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({
        error: "Invalid URL",
        message: "Please provide a valid public HTTPS URL."
      });
    }

    const pageResponse = await axios.get(targetUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
      },
      responseType: "text",
      validateStatus: status => status >= 200 && status < 400
    });

    const $ = cheerio.load(pageResponse.data);

    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (!imageUrl) {
      return res.status(404).json({
        error: "Media unavailable",
        message:
          "No publicly accessible image was found in the page metadata."
      });
    }

    const imageResponse = await axios.get(imageUrl, {
      timeout: 20000,
      maxRedirects: 5,
      responseType: "arraybuffer",
      validateStatus: status => status >= 200 && status < 400
    });

    const buffer = Buffer.from(imageResponse.data);

    if (!buffer.length) {
      return res.status(404).json({
        error: "Media unavailable",
        message: "The image could not be retrieved."
      });
    }

    const mimeType =
      imageResponse.headers["content-type"] || "image/jpeg";

    if (!mimeType.startsWith("image/")) {
      return res.status(415).json({
        error: "Unsupported media",
        message: "The retrieved resource is not an image."
      });
    }

    const base64 = buffer.toString("base64");

    res.json({
      base64,
      mimeType,
      width: 0,
      height: 0,
      sizeBytes: buffer.length
    });
  } catch (error) {
    console.error(error.message);

    res.status(502).json({
      error: "Retrieval failed",
      message:
        "The public media could not be retrieved. The website may block automated requests or the content may not be publicly accessible."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Asset Puller backend running on port ${PORT}`);
});
