/**
 * ImageUploader - Drag-drop image upload to Firebase Storage
 */

export default function ImageUploader({ onUpload }) {
  const handleDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      onUpload(files[0])
    }
  }

  const handleChange = (e) => {
    if (e.target.files.length > 0) {
      onUpload(e.target.files[0])
    }
  }

  return (
    <div
      className="image-uploader"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <p>Drag and drop image here or click to select</p>
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
        id="image-input"
      />
      <label htmlFor="image-input" className="upload-label">
        Choose Image
      </label>
    </div>
  )
}
