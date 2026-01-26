# API Response Structure Update

## Updated Chapter Images Format

The `/api/v1/manga/{web}/{mangaKey}/{chapterId}` endpoint has been updated to provide enhanced image data structure.

### Previous Structure (string[])
```json
{
  "images": [
    "https://proxy.example.com/image/page-1.jpg",
    "https://proxy.example.com/image/page-2.jpg"
  ]
}
```

### New Structure (ChapterImageDto[])
```json
{
  "images": [
    {
      "url": "https://proxy.example.com/image/page-1.jpg",
      "type": "image"
    },
    {
      "url": "https://proxy.example.com/image/encrypted-page-2.jpg", 
      "type": "canvas",
      "html": "<canvas id=\"manga-page-1\" class=\"manga-page-canvas\"></canvas>",
      "script": "<script>/* Canvas rendering script */</script>"
    }
  ]
}
```

## Image Types

### 1. **image** Type
- Regular images that can be displayed directly
- Only requires the `url` field
- No additional rendering needed

```json
{
  "url": "https://proxy.example.com/image/page-1.jpg",
  "type": "image"
}
```

### 2. **canvas** Type  
- Images that require special handling (encrypted, scrambled, or protected content)
- Includes HTML canvas element and JavaScript for rendering
- Useful for websites that protect their content through encryption or scrambling

```json
{
  "url": "https://proxy.example.com/image/encrypted-page.jpg",
  "type": "canvas", 
  "html": "<canvas id=\"page-1\" class=\"manga-page-canvas\"></canvas>",
  "script": "<script>/* Decryption/rendering logic */</script>"
}
```

## Usage Examples

### Frontend Implementation

#### React Example
```jsx
function MangaPage({ image }) {
  useEffect(() => {
    if (image.type === 'canvas' && image.script) {
      // Execute the canvas script
      const script = document.createElement('script');
      script.textContent = image.script.replace(/<\/?script>/g, '');
      document.body.appendChild(script);
    }
  }, [image]);

  if (image.type === 'image') {
    return <img src={image.url} alt="Manga page" />;
  }

  if (image.type === 'canvas') {
    return (
      <div 
        dangerouslySetInnerHTML={{ __html: image.html }}
      />
    );
  }
}
```

#### Vanilla JavaScript Example
```javascript
function renderMangaImages(images) {
  const container = document.getElementById('manga-container');
  
  images.forEach((image, index) => {
    if (image.type === 'image') {
      const img = document.createElement('img');
      img.src = image.url;
      img.alt = `Page ${index + 1}`;
      container.appendChild(img);
    } 
    else if (image.type === 'canvas') {
      // Add canvas HTML
      const div = document.createElement('div');
      div.innerHTML = image.html;
      container.appendChild(div);
      
      // Execute the script
      const script = document.createElement('script');
      script.textContent = image.script.replace(/<\/?script>/g, '');
      document.body.appendChild(script);
    }
  });
}
```

## Canvas Script Examples

### Simple Decryption
```javascript
const canvas = document.getElementById('page-1');
const ctx = canvas.getContext('2d');
const img = new Image();
img.crossOrigin = 'anonymous';

img.onload = function() {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  // Apply XOR decryption
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const key = 128;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] ^ key;     // Red
    data[i + 1] = data[i + 1] ^ key; // Green  
    data[i + 2] = data[i + 2] ^ key; // Blue
  }
  
  ctx.putImageData(imageData, 0, 0);
};

img.src = 'encrypted-image.jpg';
```

### Image Descrambling
```javascript
// Vertical split reassembly
const halfHeight = img.height / 2;
ctx.drawImage(img, 0, halfHeight, img.width, halfHeight, 0, 0, img.width, halfHeight);
ctx.drawImage(img, 0, 0, img.width, halfHeight, 0, halfHeight, img.width, halfHeight);

// Tile reordering
const tileSize = 64;
for (let y = 0; y < img.height; y += tileSize) {
  for (let x = 0; x < img.width; x += tileSize) {
    const newX = (x + tileSize) % img.width;
    const newY = (y + tileSize) % img.height;
    ctx.drawImage(img, x, y, tileSize, tileSize, newX, newY, tileSize, tileSize);
  }
}
```

## Backward Compatibility

The system maintains backward compatibility by:

1. **Automatic Detection**: Legacy adapters still return `string[]` and are automatically converted
2. **Enhanced Adapters**: New adapters can return `ChapterImageDto[]` directly  
3. **Flexible Processing**: The system handles both formats transparently

## Adapter Development

### Creating Enhanced Adapters

```typescript
async extractChapterImages(page: Page, chapterUrl: string): Promise<ChapterImageDto[]> {
  return await page.evaluate(() => {
    const images: ChapterImageDto[] = [];
    
    // Regular images
    document.querySelectorAll('.manga-page img:not(.encrypted)').forEach(img => {
      images.push({
        url: img.src,
        type: 'image'
      });
    });
    
    // Encrypted images
    document.querySelectorAll('.encrypted-image').forEach((img, index) => {
      images.push({
        url: img.src,
        type: 'canvas',
        html: `<canvas id="encrypted-${index}"></canvas>`,
        script: `<script>/* Decryption logic */</script>`
      });
    });
    
    return images;
  });
}
```

## Benefits

1. **Enhanced Content Support**: Handle encrypted and scrambled images
2. **Better User Experience**: Proper rendering of protected content
3. **Future-Proof**: Extensible for new image protection methods
4. **Backward Compatible**: Existing clients continue to work
5. **Rich Metadata**: Additional information for proper rendering

## Testing

Use the example response file (`example-response.json`) to test your frontend implementation with both image types before connecting to live data.