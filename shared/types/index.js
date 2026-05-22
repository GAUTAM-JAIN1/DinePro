/**
 * JSDoc type definitions for the application
 * @typedef {Object} Order
 * @property {string} id - Order ID
 * @property {string} restaurantId - Restaurant ID
 * @property {string} tableId - Table ID
 * @property {Array<MenuItem>} items - Array of ordered items
 * @property {string} status - Order status (NEW, PREPARING, READY, SERVED, CLOSED)
 * @property {number} total - Total order amount
 * @property {string} [specialInstructions] - Special instructions
 * @property {Date} createdAt - Order creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} MenuItem
 * @property {string} id - Item ID
 * @property {string} name - Item name
 * @property {string} [description] - Item description
 * @property {number} price - Item price
 * @property {string} category - Item category (Starters, Mains, etc.)
 * @property {string} [image] - Image URL
 * @property {boolean} [available] - Is item available
 * @property {Date} [createdAt] - Creation timestamp
 */

/**
 * @typedef {Object} Restaurant
 * @property {string} id - Restaurant ID
 * @property {string} name - Restaurant name
 * @property {string} [address] - Restaurant address
 * @property {string} [logo] - Logo image URL
 * @property {string} [themeColor] - Brand color (hex code)
 * @property {Array<string>} tableIds - Array of table IDs
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

export default {}
