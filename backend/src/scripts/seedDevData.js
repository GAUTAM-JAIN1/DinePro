require('dotenv').config()

const { db } = require('../services/firebaseAdmin')

const RESTAURANT_ID = 'rest_001'

const restaurant = {
  name: 'Tadka Junction',
  address: '123 Main Street, Delhi',
  logoUrl: '',
  themeColor: '#B88746',
  subscriptionStatus: 'active',
}

const menuItems = [
  {
    name: 'Paneer Butter Masala',
    price: 280,
    category: 'Mains',
    description: 'Creamy tomato based paneer curry',
    imageUrl: 'https://via.placeholder.com/300x200?text=Paneer+Butter+Masala',
    isAvailable: true,
  },
  {
    name: 'Veg Spring Rolls',
    price: 150,
    category: 'Starters',
    description: 'Crispy fried rolls with mixed vegetables',
    imageUrl: 'https://via.placeholder.com/300x200?text=Spring+Rolls',
    isAvailable: true,
  },
  {
    name: 'Mango Lassi',
    price: 80,
    category: 'Drinks',
    description: 'Fresh mango blended with yogurt',
    imageUrl: 'https://via.placeholder.com/300x200?text=Mango+Lassi',
    isAvailable: true,
  },
  {
    name: 'Gulab Jamun',
    price: 90,
    category: 'Desserts',
    description: 'Soft milk solid balls soaked in sugar syrup',
    imageUrl: 'https://via.placeholder.com/300x200?text=Gulab+Jamun',
    isAvailable: true,
  },
]

async function seed() {
  const now = new Date().toISOString()
  const restaurantRef = db.collection('restaurants').doc(RESTAURANT_ID)

  await restaurantRef.set(
    {
      ...restaurant,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  )

  const menuRef = restaurantRef.collection('menu')
  const existingMenu = await menuRef.limit(1).get()

  if (existingMenu.empty) {
    const batch = db.batch()

    menuItems.forEach((item) => {
      const itemRef = menuRef.doc()
      batch.set(itemRef, {
        ...item,
        createdAt: now,
        updatedAt: now,
      })
    })

    await batch.commit()
  }

  console.log(`Seed complete for ${RESTAURANT_ID}`)
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
