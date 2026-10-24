import { useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import api from '@/lib/api'

const starterItems = [
  { name: 'Paneer Tikka', price: 220, category: 'Starters', description: 'Smoky tandoori paneer bites' },
  { name: 'Dal Tadka', price: 180, category: 'Mains', description: 'Yellow dal with desi tadka' },
  { name: 'Butter Naan', price: 45, category: 'Breads', description: 'Soft tandoor naan with butter' },
]

const blankDish = () => ({ name: '', price: '', category: 'Mains', description: '' })

function SetupWizard({ restaurant, setRestaurant }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState({
    name: restaurant.name || '',
    address: restaurant.address || '',
    phone: restaurant.phone || '',
    brandColor: restaurant.brandColor || restaurant.themeColor || '#B88746',
  })

  // NEW: Billing defaults step
  const [billing, setBilling] = useState({
    defaultGstPercent: restaurant.defaultGstPercent ?? 0,
    defaultServiceCharge: restaurant.defaultServiceCharge ?? 0,
  })

  const [menuItems, setMenuItems] = useState([blankDish()])
  const [tableCount, setTableCount] = useState(3)

  const steps = ['Profile', 'Billing', 'Menu', 'Tables']

  const canContinue = useMemo(() => {
    if (step === 0) return profile.name.trim().length > 1
    if (step === 1) return true // billing is optional, always allow continue
    if (step === 2) return menuItems.some((item) => item.name.trim() && Number(item.price) > 0)
    return tableCount > 0
  }, [profile.name, step, menuItems, tableCount])

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

  // Bug #70: sample dishes are offered, never saved on their own. Only dishes the owner keeps are sent.
  const addSampleDishes = () => {
    setMenuItems((prev) => {
      const have = new Set(prev.map((item) => item.name.trim().toLowerCase()).filter(Boolean))
      const extra = starterItems.filter((item) => !have.has(item.name.toLowerCase()))
      return [...prev.filter((item) => item.name.trim()), ...extra]
    })
  }

  const finishSetup = async () => {
    setSaving(true)
    try {
      await api.put(`/api/restaurants/${restaurant.id}`, {
        name: profile.name.trim(),
        address: profile.address,
        phone: profile.phone,
        brandColor: profile.brandColor,
        defaultGstPercent: Number(billing.defaultGstPercent),
        defaultServiceCharge: Number(billing.defaultServiceCharge),
      })

      const dishes = menuItems.map((item) => ({
        name: item.name.trim(),
        price: Number(item.price),
        category: item.category.trim() || 'Mains',
        description: item.description.trim(),
      }))
      const sendable = dishes.filter((dish) => dish.name && dish.price > 0)
      // Bug #56: rows with only half filled in are reported, not dropped silently.
      const incomplete = dishes.filter((dish) => (dish.name || dish.price) && !(dish.name && dish.price > 0))

      // Bug #55: both bulk calls are idempotent. Pressing Finish again after a failure picks up where it stopped.
      const menuRes = sendable.length
        ? await api.post(`/api/menu/${restaurant.id}/bulk`, { items: sendable })
        : { data: { created: [], skipped: [], errors: [] } }
      const tablesRes = await api.post(`/api/tables/${restaurant.id}/bulk`, { count: Number(tableCount) })

      const completedRestaurant = await api.put(`/api/restaurants/${restaurant.id}`, {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      })

      const menuResult = menuRes.data
      const notes = [
        `${menuResult.created.length} dish(es) added`,
        menuResult.skipped.length ? `${menuResult.skipped.length} already on the menu` : null,
        incomplete.length
          ? `${incomplete.length} row(s) not saved, add a name and a price: ${incomplete.map((d) => d.name || 'unnamed').join(', ')}`
          : null,
        ...menuResult.errors.map((e) => `${e.name || 'Dish'}: ${e.reason}`),
        `${tablesRes.data.created.length} table(s) added`,
      ].filter(Boolean)

      setRestaurant(completedRestaurant.data.restaurant)
      toast.success(`Setup complete. ${notes.join(' · ')}`, { duration: 9000 })
    } catch (error) {
      toast.error(error.response?.data?.error || 'Setup was not completed. Press Finish again to resume. Nothing is lost.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400'

  return (
    <div className="min-h-dvh bg-gray-50 p-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Setup Wizard</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-800">Launch your restaurant</h1>
          <p className="mt-1 text-gray-500">
            Add the basics now. You can edit everything later from the admin panel.
          </p>
        </div>

        {/* Step Tabs — now 4 */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => index < step && setStep(index)} // only allow going back
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                step === index
                  ? 'bg-orange-500 text-white'
                  : index < step
                  ? 'bg-orange-100 text-orange-600 cursor-pointer'
                  : 'bg-white text-gray-400 cursor-default'
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">

          {/* STEP 0: Profile */}
          {step === 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Restaurant Name *</span>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={inputStyle}
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Phone</span>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={inputStyle}
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-gray-700">Address</span>
                <input
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className={inputStyle}
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Brand Color</span>
                <input
                  type="color"
                  value={profile.brandColor}
                  onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
                  className="h-12 w-20 rounded-xl border border-gray-200"
                />
              </label>
            </div>
          )}

          {/* STEP 1: Billing Defaults — NEW */}
          {step === 1 && (
            <div className="max-w-md space-y-5">
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  These will be pre-filled in the receptionist's settlement form. You can change them anytime from Settings.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Default GST (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="28"
                  value={billing.defaultGstPercent}
                  onChange={(e) => setBilling({ ...billing, defaultGstPercent: e.target.value })}
                  placeholder="e.g. 5"
                  className={inputStyle}
                />
                <p className="mt-1 text-xs text-gray-400">Common rates: 5% (restaurants), 12% or 18% (AC/bar). Set 0 if not applicable.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Default Service Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={billing.defaultServiceCharge}
                  onChange={(e) => setBilling({ ...billing, defaultServiceCharge: e.target.value })}
                  placeholder="e.g. 20"
                  className={inputStyle}
                />
                <p className="mt-1 text-xs text-gray-400">Fixed amount per bill. Set 0 if not applicable.</p>
              </div>

              {/* Live Preview */}
              {(Number(billing.defaultGstPercent) > 0 || Number(billing.defaultServiceCharge) > 0) && (
                <div className="rounded-xl bg-orange-50 p-4 text-sm">
                  <p className="font-semibold text-orange-700 mb-2">Preview on a ₹500 bill:</p>
                  <div className="space-y-1 text-gray-600">
                    <div className="flex justify-between"><span>Subtotal</span><span>₹500</span></div>
                    {Number(billing.defaultServiceCharge) > 0 && (
                      <div className="flex justify-between"><span>Service Charge</span><span>+₹{billing.defaultServiceCharge}</span></div>
                    )}
                    {Number(billing.defaultGstPercent) > 0 && (
                      <div className="flex justify-between">
                        <span>GST ({billing.defaultGstPercent}%)</span>
                        <span>+₹{((500 * Number(billing.defaultGstPercent)) / 100).toFixed(0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-800 border-t pt-1 mt-1">
                      <span>Total</span>
                      <span>₹{(500 + Number(billing.defaultServiceCharge) + (500 * Number(billing.defaultGstPercent)) / 100).toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Menu */}
          {step === 2 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={addSampleDishes}
                className="rounded-xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700"
              >
                Add sample dishes
              </button>
              {menuItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 md:grid-cols-4">
                  <input
                    value={item.name}
                    onChange={(e) => updateMenuItem(index, 'name', e.target.value)}
                    placeholder="Item name"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateMenuItem(index, 'price', e.target.value)}
                    placeholder="Price"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <input
                    value={item.category}
                    onChange={(e) => updateMenuItem(index, 'category', e.target.value)}
                    placeholder="Category"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <input
                    value={item.description}
                    onChange={(e) => updateMenuItem(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>
              ))}
              <button
                onClick={addMenuRow}
                className="rounded-xl border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-600"
              >
                + Add another item
              </button>
            </div>
          )}

          {/* STEP 3: Tables */}
          {step === 3 && (
            <div className="max-w-md">
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">How many tables?</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tableCount}
                  onChange={(e) => setTableCount(e.target.value)}
                  className={inputStyle}
                />
              </label>
              <p className="mt-3 text-sm text-gray-500">
                QR links will be generated in Tables & QR after setup.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
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
              className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-orange-600 transition"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={finishSetup}
              disabled={!canContinue || saving}
              className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-orange-600 transition"
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