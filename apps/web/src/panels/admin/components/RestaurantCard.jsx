/**
 * RestaurantCard - (Super admin) each restaurant tile
 */

export default function RestaurantCard({ restaurant, onEdit, onDelete }) {
  return (
    <div className="restaurant-card">
      <img src={restaurant.logo} alt={restaurant.name} className="restaurant-logo" />
      <h3>{restaurant.name}</h3>
      <p className="address">{restaurant.address}</p>
      <div className="card-stats">
        <span>{restaurant.tables} tables</span>
        <span>{restaurant.menuItems} items</span>
      </div>
      <div className="card-actions">
        <button onClick={() => onEdit(restaurant.id)} className="edit-btn">
          Edit
        </button>
        <button onClick={() => onDelete(restaurant.id)} className="delete-btn">
          Delete
        </button>
      </div>
    </div>
  )
}
