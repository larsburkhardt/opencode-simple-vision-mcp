import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, extname, join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { config } from "dotenv";
import sharp from "sharp";

config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  process.stderr.write("ERROR: GEMINI_API_KEY nicht gesetzt. Prüfe ~/mcp-vision/.env\n");
  process.exit(1);
}

// Analyse: alter Client (funktioniert, bewährt)
const genAI = new GoogleGenerativeAI(apiKey);
const analysisModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
});

// Generierung: neues unified SDK (nötig für Image Generation)
const genAINew = new GoogleGenAI({ apiKey });

const server = new McpServer({ name: "vision", version: "2.0.0" });

// ─── Tool 1: Bild analysieren ────────────────────────────────────────
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
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".webp": "image/webp", ".gif": "image/gif",
      ".heic": "image/heic", ".heif": "image/heif",
    };
    const ext = extname(absPath).toLowerCase();
    let mimeType = mimeMap[ext] ?? "image/jpeg";
    let imageBuffer = readFileSync(absPath);

    if (ext === ".svg") {
      imageBuffer = await sharp(imageBuffer).resize(2048).png().toBuffer();
      mimeType = "image/png";
    }

    const result = await analysisModel.generateContent([
      prompt ?? "Describe this image in detail.",
      { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
    ]);
    return { content: [{ type: "text", text: result.response.text() }] };
  }
);

// ─── Tool 2: Bild generieren ─────────────────────────────────────────
server.tool(
  "generate_image",
  "Generate an image from a text prompt using Gemini and save it to disk",
  {
    prompt: z.string().describe("Text prompt describing the image to generate"),
    outputPath: z.string().optional().describe("Absolute path to save the PNG (default: ~/Desktop/generated_<timestamp>.png)"),
  },
  async ({ prompt, outputPath }) => {
    function getDefaultOutputDir() {
      const candidates = [
        join(homedir(), "Desktop"),
        join(homedir(), "Documents"),
        homedir()
      ];
      return candidates.find(existsSync) ?? homedir();
    }

    const savePath = outputPath
      ? resolve(outputPath)
      : join(getDefaultOutputDir(), `generated_${Date.now()}.png`);

    mkdirSync(dirname(savePath), { recursive: true });

    const response = await genAINew.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
      config: { responseModalities: ["Text", "Image"] },
    });

    let savedPath = null;
    let textResponse = "";

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        writeFileSync(savePath, Buffer.from(part.inlineData.data, "base64"));
        savedPath = savePath;
      } else if (part.text) {
        textResponse = part.text;
      }
    }

    if (savedPath) {
      return {
        content: [{
          type: "text",
          text: `Image saved to: ${savedPath}${textResponse ? `\n\n${textResponse}` : ""}`,
        }],
      };
    }
    return { content: [{ type: "text", text: "No image was generated. Try a different prompt." }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
