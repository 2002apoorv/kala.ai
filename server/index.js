require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const app = express();

// Enable CORS for mobile app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json({ limit: '15mb' }));
const PORT = process.env.PORT || 4000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://apoorv2002singh:NhkqYjQqG10kn13E@cluster0.mmtos.mongodb.net/kala-ai?retryWrites=true&w=majority';

// MongoDB connection
let mongoClient = null;
let db = null;
let gridFSBucket = null;

async function connectMongoDB() {
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      db = mongoClient.db('kala-ai');
      gridFSBucket = new GridFSBucket(db, { bucketName: 'images' });
      console.log('✅ Connected to MongoDB');
    }
    return { db, gridFSBucket };
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
}

// Initialize MongoDB connection on server start
connectMongoDB().catch(console.error);

async function removeBackground(imageBase64) {
  try {
    if (REMOVE_BG_KEY) {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      
      // Clean base64 string (remove data URL prefix if present)
      let cleanBase64 = imageBase64;
      if (imageBase64.includes(',')) {
        cleanBase64 = imageBase64.split(',')[1];
      }
      
      // Detect image format from base64
      let contentType = 'image/jpeg';
      let filename = 'image.jpg';
      if (cleanBase64.startsWith('/9j/') || cleanBase64.startsWith('iVBORw0KG')) {
        // JPEG or PNG detected
        if (cleanBase64.startsWith('iVBORw0KG')) {
          contentType = 'image/png';
          filename = 'image.png';
        }
      }
      
      // Convert base64 to Buffer
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      
      // Create FormData with image file
      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('image_file', imageBuffer, {
        filename: filename,
        contentType: contentType,
      });
      
      const resp = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_KEY,
          ...formData.getHeaders(),
        },
        body: formData,
      });
      
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        return buf;
      } else {
        const errorText = await resp.text();
        console.error('remove.bg API error:', resp.status, errorText);
      }
    }
  } catch (e) {
    console.error('remove.bg failed', e.message);
  }
  // Fallback: return original image if removal fails
  let cleanBase64 = imageBase64;
  if (imageBase64.includes(',')) {
    cleanBase64 = imageBase64.split(',')[1];
  }
  return Buffer.from(cleanBase64, 'base64');
}

async function enhanceImagePng(buffer) {
  const sharp = require('sharp');
  const png = await sharp(buffer)
    .resize({ width: 1024, height: 1024, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .sharpen()
    .png()
    .toBuffer();
  return png;
}


// Endpoint 1: Enhance image (remove background, resize, sharpen)
app.post('/api/enhance-image', upload.none(), async (req, res) => {
  try {
    const { croppedImageBase64 } = req.body || {};
    
    if (!croppedImageBase64) {
      return res.status(400).json({ ok: false, error: 'No cropped image provided. Please crop the image first.' });
    }

    let enhancedImageUrl = null;
    
    try {
      // Enhance image (remove background, resize, sharpen)
      const noBg = await removeBackground(croppedImageBase64);
      const enhanced = await enhanceImagePng(noBg);
      enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
    } catch (enhanceErr) {
      console.error('Image enhancement failed:', enhanceErr.message);
      // Fallback: return cropped image as data URL
      let cleanBase64 = croppedImageBase64;
      if (croppedImageBase64.includes(',')) {
        cleanBase64 = croppedImageBase64.split(',')[1];
      }
      // Detect MIME type
      let mimeType = 'image/jpeg';
      if (cleanBase64.startsWith('iVBORw0KG')) {
        mimeType = 'image/png';
      }
      enhancedImageUrl = `data:${mimeType};base64,${cleanBase64}`;
    }

    res.json({ ok: true, enhancedImageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Keep the old combined endpoint for backward compatibility
app.post('/api/crop-and-enhance', upload.none(), async (req, res) => {
  try {
    const { imageBase64, croppedImageBase64 } = req.body || {};
    // Use cropped image if available, otherwise use original
    const imageToUse = croppedImageBase64 || imageBase64;
    
    if (!imageToUse) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    let enhancedImageUrl = null;
    
    try {
      // Enhance image (remove background, resize, sharpen)
      const noBg = await removeBackground(imageToUse);
      const enhanced = await enhanceImagePng(noBg);
      enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
    } catch (enhanceErr) {
      console.error('Image enhancement failed:', enhanceErr.message);
      // Fallback: return cropped image as data URL
      let cleanBase64 = imageToUse;
      if (imageToUse.includes(',')) {
        cleanBase64 = imageToUse.split(',')[1];
      }
      // Detect MIME type
      let mimeType = 'image/jpeg';
      if (cleanBase64.startsWith('iVBORw0KG')) {
        mimeType = 'image/png';
      }
      enhancedImageUrl = `data:${mimeType};base64,${cleanBase64}`;
    }

    res.json({ ok: true, enhancedImageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper function to call Gemini API with retry logic
async function callGeminiWithRetry(genAI, modelName, prompt, imageData, mimeType, maxRetries = 3) {
  const models = [modelName, 'gemini-1.5-flash', 'gemini-pro-vision'];
  let lastError = null;

  for (const modelToTry of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelToTry });
        const result = await model.generateContent([
          {
            inlineData: {
              data: imageData,
              mimeType: mimeType,
            }
          },
          { text: prompt }
        ]);
        return result.response.text();
      } catch (err) {
        lastError = err;
        // If it's a 503 (overloaded) or 429 (rate limit), retry with delay
        if ((err.message.includes('503') || err.message.includes('429') || err.message.includes('overloaded')) && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Gemini API ${modelToTry} overloaded, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // If it's not a retryable error or we've exhausted retries, try next model
        if (attempt === maxRetries - 1) {
          console.log(`Gemini API ${modelToTry} failed, trying next model...`);
          break;
        }
      }
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

// Endpoint 2: Generate title, description, and price using cropped/enhanced image
app.post('/api/generate-product-info', upload.none(), async (req, res) => {
  try {
    const { croppedImageBase64, language } = req.body || {};
    
    if (!croppedImageBase64) {
      return res.status(400).json({ ok: false, error: 'No cropped image provided. Please crop and enhance the image first.' });
    }

    let title = 'Generated Title';
    let description = 'Generated description';
    let estimatedPrice = '0';

    if (GEMINI_KEY) {
      try {
        // Clean base64 string - use cropped image for price prediction
        let cleanBase64 = croppedImageBase64;
        let mimeType = 'image/jpeg';
        
        if (croppedImageBase64.includes(',')) {
          const parts = croppedImageBase64.split(',');
          cleanBase64 = parts[1];
          // Extract MIME type from data URL if present
          if (parts[0].includes('image/png')) mimeType = 'image/png';
          else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
        } else {
          // Detect from base64 signature
          if (cleanBase64.startsWith('iVBORw0KG')) mimeType = 'image/png';
          else if (cleanBase64.startsWith('/9j/')) mimeType = 'image/jpeg';
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        
        // Create prompt for Vision API
        const prompt = `Analyze this image of a handmade artisan product and provide the following information:
1. A concise, SEO-friendly product title (max 60 characters)
2. A detailed product description (80-120 words) highlighting its features, craftsmanship, materials, and cultural significance
3. An estimated market price in Indian Rupees (₹) based on similar handmade artisan products available online

Consider:
- The type of product (pottery, textile, woodwork, metalwork, jewelry, etc.)
- Quality and craftsmanship visible
- Materials used
- Cultural/artisan heritage
- Current market prices for similar handmade products

Output ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "title": "Product title here",
  "description": "Detailed description here",
  "estimatedPrice": "price in rupees as number (e.g., 499, 1299, 2500)"
}`;

        // Use Vision API with retry logic
        const text = await callGeminiWithRetry(genAI, 'gemini-2.5-flash', prompt, cleanBase64, mimeType);
        
        // Try to extract JSON from response (remove markdown code blocks if present)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '');
        }
        
        try {
          const parsed = JSON.parse(jsonText);
          title = parsed.title || title;
          description = parsed.description || description;
          estimatedPrice = String(parsed.estimatedPrice || parsed.price || '0');
        } catch (parseErr) {
          console.error('Failed to parse Gemini JSON response:', jsonText);
          // Fallback: try to extract info from text
          const titleMatch = jsonText.match(/"title"\s*:\s*"([^"]+)"/);
          const descMatch = jsonText.match(/"description"\s*:\s*"([^"]+)"/);
          const priceMatch = jsonText.match(/"estimatedPrice"\s*:\s*"?(\d+)"?/);
          if (titleMatch) title = titleMatch[1];
          if (descMatch) description = descMatch[1];
          if (priceMatch) estimatedPrice = priceMatch[1];
        }
      } catch (err) {
        console.error('Gemini Vision API call failed after retries:', err.message);
        // Return default values instead of failing completely
      }
    } else {
      return res.status(500).json({ ok: false, error: 'Gemini API key not configured' });
    }

    res.json({ ok: true, title, description, estimatedPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Keep the old endpoint for backward compatibility (optional - can be removed)
app.post('/api/enhance-and-generate', upload.none(), async (req, res) => {
  try {
    const { imageBase64, croppedImageBase64, language } = req.body || {};
    // Use cropped image if available, otherwise fall back to original
    const imageToUse = croppedImageBase64 || imageBase64;
    let title = 'Generated Title';
    let description = 'Generated description';
    let estimatedPrice = '0';
    let enhancedImageUrl = null;

    if (imageToUse && GEMINI_KEY) {
      try {
        // Clean base64 string - use cropped image for price prediction
        let cleanBase64 = imageToUse;
        let mimeType = 'image/jpeg';
        
        if (imageToUse.includes(',')) {
          const parts = imageToUse.split(',');
          cleanBase64 = parts[1];
          // Extract MIME type from data URL if present
          if (parts[0].includes('image/png')) mimeType = 'image/png';
          else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
        } else {
          // Detect from base64 signature
          if (cleanBase64.startsWith('iVBORw0KG')) mimeType = 'image/png';
          else if (cleanBase64.startsWith('/9j/')) mimeType = 'image/jpeg';
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        
        // Create prompt for Vision API
        const prompt = `Analyze this image of a handmade artisan product and provide the following information:
1. A concise, SEO-friendly product title (max 60 characters)
2. A detailed product description (80-120 words) highlighting its features, craftsmanship, materials, and cultural significance
3. An estimated market price in Indian Rupees (₹) based on similar handmade artisan products available online

Consider:
- The type of product (pottery, textile, woodwork, metalwork, jewelry, etc.)
- Quality and craftsmanship visible
- Materials used
- Cultural/artisan heritage
- Current market prices for similar handmade products

Output ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "title": "Product title here",
  "description": "Detailed description here",
  "estimatedPrice": "price in rupees as number (e.g., 499, 1299, 2500)"
}`;

        // Use Vision API with retry logic
        const text = await callGeminiWithRetry(genAI, 'gemini-2.5-flash', prompt, cleanBase64, mimeType);
        
        // Try to extract JSON from response (remove markdown code blocks if present)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '');
        }
        
        try {
          const parsed = JSON.parse(jsonText);
          title = parsed.title || title;
          description = parsed.description || description;
          estimatedPrice = String(parsed.estimatedPrice || parsed.price || '0');
        } catch (parseErr) {
          console.error('Failed to parse Gemini JSON response:', jsonText);
          // Fallback: try to extract info from text
          const titleMatch = jsonText.match(/"title"\s*:\s*"([^"]+)"/);
          const descMatch = jsonText.match(/"description"\s*:\s*"([^"]+)"/);
          const priceMatch = jsonText.match(/"estimatedPrice"\s*:\s*"?(\d+)"?/);
          if (titleMatch) title = titleMatch[1];
          if (descMatch) description = descMatch[1];
          if (priceMatch) estimatedPrice = priceMatch[1];
        }
      } catch (err) {
        console.error('Gemini Vision API call failed after retries:', err.message);
        // Return default values instead of failing completely
      }
    }

    // Enhance image (remove background, resize, sharpen) - use cropped image
    if (imageToUse) {
      try {
        const noBg = await removeBackground(imageToUse);
        const enhanced = await enhanceImagePng(noBg);
        enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
      } catch (enhanceErr) {
        console.error('Image enhancement failed:', enhanceErr.message);
        // Fallback: return cropped image as data URL
        let cleanBase64 = imageToUse;
        if (imageToUse.includes(',')) {
          cleanBase64 = imageToUse.split(',')[1];
        }
        // Detect MIME type
        let mimeType = 'image/jpeg';
        if (cleanBase64.startsWith('iVBORw0KG')) {
          mimeType = 'image/png';
        }
        enhancedImageUrl = `data:${mimeType};base64,${cleanBase64}`;
      }
    }

    res.json({ ok: true, title, description, estimatedPrice, enhancedImageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint: Upload image to MongoDB GridFS
app.post('/api/upload-image', upload.none(), async (req, res) => {
  try {
    const { imageBase64, userId } = req.body || {};
    
    if (!imageBase64) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    // Ensure MongoDB is connected
    await connectMongoDB();

    // Extract base64 data from data URL if present
    let cleanBase64 = imageBase64;
    let mimeType = 'image/jpeg';
    
    if (imageBase64.includes(',')) {
      const parts = imageBase64.split(',');
      cleanBase64 = parts[1];
      // Extract MIME type from data URL
      if (parts[0].includes('image/png')) mimeType = 'image/png';
      else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
    } else {
      // Detect from base64 signature
      if (cleanBase64.startsWith('iVBORw0KG')) mimeType = 'image/png';
      else if (cleanBase64.startsWith('/9j/')) mimeType = 'image/jpeg';
    }

    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Generate unique filename
    const filename = `product_${userId || 'anonymous'}_${Date.now()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
    
    // Upload to GridFS
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType: mimeType,
      metadata: {
        userId: userId || null,
        uploadedAt: new Date(),
      }
    });

    uploadStream.end(imageBuffer);

    uploadStream.on('finish', () => {
      // Return the image ID which can be used to retrieve the image
      const imageId = uploadStream.id.toString();
      const imageUrl = `${req.protocol}://${req.get('host')}/api/image/${imageId}`;
      res.json({ 
        ok: true, 
        imageId,
        imageUrl,
        message: 'Image uploaded successfully' 
      });
    });

    uploadStream.on('error', (err) => {
      console.error('GridFS upload error:', err);
      res.status(500).json({ ok: false, error: 'Failed to upload image: ' + err.message });
    });

  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint: Retrieve image from MongoDB GridFS
app.get('/api/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    if (!imageId) {
      return res.status(400).json({ ok: false, error: 'Image ID required' });
    }

    // Ensure MongoDB is connected
    await connectMongoDB();

    // Check if file exists and convert imageId to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(imageId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: 'Invalid image ID format' });
    }

    const files = await gridFSBucket.find({ _id: objectId }).toArray();
    
    if (files.length === 0) {
      return res.status(404).json({ ok: false, error: 'Image not found' });
    }

    const file = files[0];
    
    // Set appropriate headers
    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file
    const downloadStream = gridFSBucket.openDownloadStream(objectId);
    downloadStream.pipe(res);

    downloadStream.on('error', (err) => {
      console.error('GridFS download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Failed to retrieve image' });
      }
    });

  } catch (err) {
    console.error('Get image error:', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
});

app.post('/api/publish', async (req, res) => {
  try {
    const { marketplaces, title } = req.body || {};
    // Here you would integrate specific marketplace APIs
    res.json({ ok: true, submitted: Object.keys(marketplaces || {}).filter(k => marketplaces[k]), title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

// Listen on all network interfaces (0.0.0.0) so phone can access it
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://<your-ip>:${PORT}`);
});