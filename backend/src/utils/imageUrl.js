// Bug #61: menu and logo images may only be https links to hosts we control.
// Uploads go through /api/images to Cloudinary, so res.cloudinary.com is the
// default. Extra hosts can be added with ALLOWED_IMAGE_HOSTS (comma separated).
const DEFAULT_IMAGE_HOSTS = ['res.cloudinary.com']

function allowedImageHosts() {
  const extra = (process.env.ALLOWED_IMAGE_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set([...DEFAULT_IMAGE_HOSTS, ...extra])]
}

/** Empty string means "no image" and is allowed. */
function isAllowedImageUrl(value) {
  if (value === '' || value === undefined || value === null) return true
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    if (url.username || url.password) return false
    return allowedImageHosts().includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

module.exports = { isAllowedImageUrl, allowedImageHosts }
