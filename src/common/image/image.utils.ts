/**
 * Utility functions for image URL proxying
 */

/**
 * Convert external image URL to proxied URL
 * @param imageUrl Original external image URL
 * @param baseUrl Base URL of the API server (optional)
 * @returns Proxied image URL
 */
export function proxyImageUrl(imageUrl: string, baseUrl?: string): string {
  if (!imageUrl) {
    return '';
  }

  // Skip if already proxied
  if (imageUrl.includes('/image?')) {
    return imageUrl;
  }

  // Skip data URLs
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  // Skip relative URLs (they shouldn't cause CORS issues)
  if (imageUrl.startsWith('/') || imageUrl.startsWith('./') || imageUrl.startsWith('../')) {
    return imageUrl;
  }

  try {
    // Validate URL
    new URL(imageUrl);
    
    // Encode the image URL
    const encodedImageUrl = encodeURIComponent(imageUrl);
    
    // Build proxy URL
    const proxyUrl = baseUrl 
      ? `${baseUrl}/image?image=${encodedImageUrl}`
      : `/image?image=${encodedImageUrl}`;
    
    return proxyUrl;
  } catch (error) {
    // If URL is invalid, return original
    return imageUrl;
  }
}

/**
 * Convert array of image URLs to proxied URLs
 * @param imageUrls Array of original external image URLs
 * @param baseUrl Base URL of the API server (optional)
 * @returns Array of proxied image URLs
 */
export function proxyImageUrls(imageUrls: string[], baseUrl?: string): string[] {
  return imageUrls.map(url => proxyImageUrl(url, baseUrl));
}

/**
 * Check if URL is external and might need proxying
 * @param url Image URL to check
 * @returns True if URL is external and might cause CORS issues
 */
export function needsProxy(url: string): boolean {
  if (!url) return false;
  
  // Skip data URLs
  if (url.startsWith('data:')) return false;
  
  // Skip relative URLs
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return false;
  
  // Skip already proxied URLs
  if (url.includes('/image?')) return false;
  
  try {
    const urlObj = new URL(url);
    // External URLs need proxying
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}