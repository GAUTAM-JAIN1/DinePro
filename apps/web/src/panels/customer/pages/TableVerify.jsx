import { useNavigate, useParams } from 'react-router-dom'
import { storeVerifiedTable, useTable } from '../hooks/useTable'

function TableVerify() {
  const { restaurantId, tableId } = useParams()
  const navigate = useNavigate()
  const { restaurant, table, loading, error, serviceUnavailable } = useTable(restaurantId, tableId)

  const confirmTable = () => {
    storeVerifiedTable(restaurantId, tableId, table)
    navigate(`/r/${restaurantId}/table/${table.id}/menu`)
  }

  if (!restaurantId || !tableId) {
    return <CenteredState title="Invalid QR" message="Restaurant or table is missing from this link." />
  }

  if (loading) {
    return <CenteredState title="Checking Table" message="Verifying your QR code..." />
  }

  if (serviceUnavailable) {
    return (
      <CenteredState
        title="Service Unavailable"
        message={`${restaurant?.name || 'This restaurant'} is not accepting digital menu orders right now.`}
      />
    )
  }

  if (error || !table) {
    return <CenteredState title="Invalid Table" message={error || 'This QR code does not match an active table.'} />
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--card)',
        border: '1px solid rgba(184,135,70,0.16)',
        borderRadius: '18px',
        padding: '24px',
        textAlign: 'center'
      }}>
        {restaurant?.logoUrl ? (
          <img
            src={restaurant.logoUrl}
            alt={restaurant.name}
            style={{
              width: '72px',
              height: '72px',
              objectFit: 'cover',
              borderRadius: '50%',
              margin: '0 auto 14px',
              border: '1px solid rgba(184,135,70,0.22)'
            }}
          />
        ) : (
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            border: '1px solid rgba(184,135,70,0.35)',
            color: 'var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '30px'
          }}>
            Menu
          </div>
        )}

        <div style={{
          color: 'var(--text2)',
          fontSize: '11px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '6px'
        }}>
          Confirm your table
        </div>

        <h1 style={{
          color: 'var(--text)',
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '28px',
          fontWeight: '600',
          margin: 0
        }}>
          {restaurant?.name || 'Restaurant'}
        </h1>

        <div style={{
          margin: '20px 0',
          background: 'rgba(184,135,70,0.10)',
          border: '1px solid rgba(184,135,70,0.22)',
          borderRadius: '14px',
          padding: '18px'
        }}>
          <div style={{ color: 'var(--text2)', fontSize: '12px', marginBottom: '4px' }}>You are at</div>
          <div style={{
            color: 'var(--gold-l)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '34px',
            fontWeight: '700',
            lineHeight: 1
          }}>
            Table {table.tableNumber}
          </div>
          {table.label && table.label !== `Table ${table.tableNumber}` && (
            <div style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '8px' }}>
              {table.label}
            </div>
          )}
        </div>

        <button type="button" onClick={confirmTable} style={{
          width: '100%',
          background: 'var(--btn)',
          border: '1px solid rgba(184,135,70,0.3)',
          borderRadius: '12px',
          color: '#FFFDF9',
          cursor: 'pointer',
          fontFamily: "'Jost', sans-serif",
          fontSize: '15px',
          fontWeight: '600',
          padding: '15px 18px'
        }}>
          Yes, this is my table
        </button>
      </div>
    </div>
  )
}

function CenteredState({ title, message }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: '360px' }}>
        <h1 style={{
          color: 'var(--text)',
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '28px',
          marginBottom: '8px'
        }}>
          {title}
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>
      </div>
    </div>
  )
}

export default TableVerify
