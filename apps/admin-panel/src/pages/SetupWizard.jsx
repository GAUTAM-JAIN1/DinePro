import { useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import api from '../lib/api'

const starterItems = [
  { name: 'Paneer Tikka', price: 220, category: 'Starters', description: 'Smoky tandoori paneer bites' },
  { name: 'Dal Tadka', price: 180, category: 'Mains', description: 'Yellow dal with desi tadka' },
  { name: 'Butter Naan', price: 45, category: 'Breads', description: 'Soft tandoor naan with butter' },
]

function SetupWizard({ restaurant, setRestaurant }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: restaurant.name || '',
    address: restaurant.address || '',
    phone: restaurant.phone || '',
    themeColor: restaurant.themeColor || '#B88746',
  })
  const [menuItems, setMenuItems] = useState(starterItems)
  const [tableCount, setTableCount] = useState(3)

  const canContinue = useMemo(() => {
    if (step === 0) return profile.name.trim().length > 1
    if (step === 1) return menuItems.some((item) => item.name.trim() && Number(item.price) > 0)
    return tableCount > 0
  }, [menuItems, profile.name, step, tableCount])

  const updateMenuItem = (index, field, value) => {
    setMenuItems((prev) =>
      prev.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    )
  }

  const addMenuRow = () => {
    setMenuItems((prev) => [
      ...prev,
      { name: '', price: '', category: 'Mains', description: '' },
    ])
  }

  const finishSetup = async () => {
    setSaving(true)
    try {
      await api.put(`/api/restaurants/${restaurant.id}`, {
        ...profile,
      })

      const validMenuItems = menuItems.filter((item) => item.name.trim() && Number(item.price) > 0)
      await Promise.all(
        validMenuItems.map((item) =>
          api.post(`/api/menu/${restaurant.id}`, {
            ...item,
            name: item.name.trim(),
            price: Number(item.price),
          })
        )
      )

      await Promise.all(
        Array.from({ length: Number(tableCount) }, (_, index) =>
          api.post(`/api/tables/${restaurant.id}`, { tableNumber: String(index + 1) })
            .catch((error) => {
              if (error.response?.status === 400) return null
              throw error
            })
        )
      )

      const completedRestaurant = await api.put(`/api/restaurants/${restaurant.id}`, {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      })

      setRestaurant(completedRestaurant.data.restaurant)
      toast.success('Setup complete. You are ready for live orders.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Setup could not be completed')
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Profile', 'Menu', 'Tables']

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Setup Wizard</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-800">Launch your restaurant</h1>
          <p className="mt-1 text-gray-500">
            Add the basics now. You can edit everything later from the admin panel.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                step === index ? 'bg-orange-500 text-white' : 'bg-white text-gray-500'
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Restaurant Name *</span>
                <input
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Phone</span>
                <input
                  value={profile.phone}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-gray-700">Address</span>
                <input
                  value={profile.address}
                  onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Brand Color</span>
                <input
                  type="color"
                  value={profile.themeColor}
                  onChange={(event) => setProfile({ ...profile, themeColor: event.target.value })}
                  className="h-12 w-20 rounded-xl border border-gray-200"
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {menuItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 md:grid-cols-4">
                  <input
                    value={item.name}
                    onChange={(event) => updateMenuItem(index, 'name', event.target.value)}
                    placeholder="Item name"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={(event) => updateMenuItem(index, 'price', event.target.value)}
                    placeholder="Price"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <input
                    value={item.category}
                    onChange={(event) => updateMenuItem(index, 'category', event.target.value)}
                    placeholder="Category"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <input
                    value={item.description}
                    onChange={(event) => updateMenuItem(index, 'description', event.target.value)}
                    placeholder="Description"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>
              ))}
              <button onClick={addMenuRow} className="rounded-xl border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-600">
                + Add another item
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-md">
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">How many tables?</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tableCount}
                  onChange={(event) => setTableCount(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
                />
              </label>
              <p className="mt-3 text-sm text-gray-500">
                QR links will be generated in Tables & QR after setup.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            disabled={step === 0 || saving}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-600 disabled:opacity-40"
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => prev + 1)}
              disabled={!canContinue || saving}
              className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={finishSetup}
              disabled={!canContinue || saving}
              className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Finishing...' : 'Finish Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetupWizard
