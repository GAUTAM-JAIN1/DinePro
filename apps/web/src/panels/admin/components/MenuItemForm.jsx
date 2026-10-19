/**
 * MenuItemForm - Form: name, price, category, image upload
 */

export default function MenuItemForm({ onSubmit, initialData }) {
  return (
    <form className="menu-item-form" onSubmit={onSubmit}>
      <div className="form-group">
        <label>Item Name</label>
        <input type="text" placeholder="e.g., Butter Chicken" required />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea placeholder="Brief description of the item" />
      </div>
      <div className="form-group">
        <label>Price (₹)</label>
        <input type="number" placeholder="0.00" step="0.01" required />
      </div>
      <div className="form-group">
        <label>Category</label>
        <select required>
          <option value="">Select category</option>
          <option value="starters">Starters</option>
          <option value="mains">Mains</option>
          <option value="desserts">Desserts</option>
          <option value="drinks">Drinks</option>
        </select>
      </div>
      <div className="form-group">
        <label>Image</label>
        <input type="file" accept="image/*" required />
      </div>
      <button type="submit">Save Item</button>
    </form>
  )
}
