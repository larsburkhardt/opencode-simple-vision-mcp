import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import { config } from "dotenv";
import sharp from "sharp";

// .env laden — Pfad relativ zur server.mjs-Datei
config({ path: new URL(".env", import.meta.url).pathname });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  process.stderr.write("ERROR: GEMINI_API_KEY nicht gesetzt. Prüfe ~/mcp-vision/.env\n");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
});

const server = new McpServer({ name: "vision", version: "1.0.0" });

server.tool(
  "analyze_image",
  "Analyze a local image file (PNG, JPG, WebP, GIF, HEIC, SVG) and return a description",
  {
    imagePath: z.string().describe("Absolute path to the image file"),
    prompt: z.string().optional().describe("What to look for (default: describe the image)"),
  },
  async ({ imagePath, prompt }) => {
    const absPath = resolve(imagePath);

    if (!existsSync(absPath)) {
      return { content: [{ type: "text", text: `File not found: ${absPath}` }] };
    }

    const mimeMap = {
      ".jpg":  "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png":  "image/png",
      ".webp": "image/webp",
      ".gif":  "image/gif",
      ".heic": "image/heic",
      ".heif": "image/heif",
    };

    const ext = extname(absPath).toLowerCase();
    let mimeType = mimeMap[ext] ?? "image/jpeg";
    let imageBuffer = readFileSync(absPath);

    // SVG → PNG konvertieren, da Gemini SVG (image/svg+xml) nicht unterstützt.
    // sharp rastert das SVG mit der in viewBox definierten Auflösung;
    // resize(2048) stellt eine ausreichende Qualität auch bei kleinen viewBox-Werten sicher.
    if (ext === ".svg") {
      imageBuffer = await sharp(imageBuffer).resize(2048).png().toBuffer();
      mimeType = "image/png";
    }

    const imageData = imageBuffer.toString("base64");

    const result = await model.generateContent([
      prompt ?? "Describe this image in detail.",
      { inlineData: { data: imageData, mimeType } },
    ]);

    return { content: [{ type: "text", text: result.response.text() }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);