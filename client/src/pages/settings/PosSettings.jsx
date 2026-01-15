import { useState, useEffect } from 'react'
import api from '../../services/api'
import Swal from 'sweetalert2'

function PosSettings() {
  const [modules, setModules] = useState([])
  const [selectedModule, setSelectedModule] = useState('')
  const [settings, setSettings] = useState([])
  const [originalSettings, setOriginalSettings] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Cargar módulos al inicio
  useEffect(() => {
    loadModules()
  }, [])

  // Cargar settings cuando cambia el módulo
  useEffect(() => {
    if (selectedModule) {
      loadSettings(selectedModule)
    }
  }, [selectedModule])

  // Detectar cambios
  useEffect(() => {
    const changed = settings.some((s, i) => s.value !== originalSettings[i]?.value)
    setHasChanges(changed)
  }, [settings, originalSettings])

  const loadModules = async () => {
    try {
      const response = await api.get('/settings/pos/modules')
      setModules(response.data.data)
      
      // Seleccionar primer módulo por defecto
      if (response.data.data.length > 0) {
        setSelectedModule(response.data.data[0].value)
      }
    } catch (error) {
      console.error('Error loading modules:', error)
      Swal.fire('Error', 'Could not load settings modules', 'error')
    }
  }

  const loadSettings = async (module) => {
    try {
      setLoading(true)
      const response = await api.get(`/settings/pos/module/${module}`)
      setSettings(response.data.data)
      setOriginalSettings(JSON.parse(JSON.stringify(response.data.data)))
    } catch (error) {
      console.error('Error loading settings:', error)
      Swal.fire('Error', 'Could not load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleModuleChange = (e) => {
    if (hasChanges) {
      Swal.fire({
        title: 'Unsaved Changes',
        text: 'You have unsaved changes. Do you want to discard them?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Discard',
        cancelButtonText: 'Stay'
      }).then((result) => {
        if (result.isConfirmed) {
          setSelectedModule(e.target.value)
        }
      })
    } else {
      setSelectedModule(e.target.value)
    }
  }

  const handleSettingChange = (index, newValue) => {
    setSettings(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], value: newValue }
      return updated
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Solo enviar los que cambiaron
      const changedSettings = settings
        .filter((s, i) => s.value !== originalSettings[i]?.value)
        .map(s => ({
          setting_id: s.setting_id,
          key: s.key,
          value: s.value
        }))

      if (changedSettings.length === 0) {
        Swal.fire('Info', 'No changes to save', 'info')
        return
      }

      await api.put('/settings/pos', { settings: changedSettings })

      Swal.fire({
        icon: 'success',
        title: 'Settings Saved!',
        text: `${changedSettings.length} setting(s) updated`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      })

      // Actualizar originales
      setOriginalSettings(JSON.parse(JSON.stringify(settings)))
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving settings:', error)
      Swal.fire('Error', 'Could not save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    Swal.fire({
      title: 'Reset Changes?',
      text: 'This will discard all unsaved changes',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reset',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        setSettings(JSON.parse(JSON.stringify(originalSettings)))
      }
    })
  }

  // Render input según tipo
  const renderInput = (setting, index) => {
    const { input_type, value, unit, description } = setting
    const inputId = `setting-${setting.setting_id}`

    // Switch (boolean)
    if (input_type === 'switch') {
      const isChecked = value === '1' || value === 'true' || value === true
      return (
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id={inputId}
            checked={isChecked}
            onChange={(e) => handleSettingChange(index, e.target.checked ? '1' : '0')}
          />
          <label className="form-check-label" htmlFor={inputId}>
            {isChecked ? 'Enabled' : 'Disabled'}
          </label>
        </div>
      )
    }

    // Select
    if (input_type.startsWith('select:')) {
      const options = input_type.replace('select:', '').split(',')
      return (
        <select
          className="form-select"
          id={inputId}
          value={value || ''}
          onChange={(e) => handleSettingChange(index, e.target.value)}
        >
          <option value="">-- Select --</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    // Number
    if (input_type === 'number') {
      return (
        <div className="input-group">
          <input
            type="number"
            className="form-control"
            id={inputId}
            value={value || ''}
            onChange={(e) => handleSettingChange(index, e.target.value)}
            min="0"
            step="1"
          />
          {unit && <span className="input-group-text">{unit}</span>}
        </div>
      )
    }

    // Decimal
    if (input_type === 'decimal') {
      return (
        <div className="input-group">
          <input
            type="number"
            className="form-control"
            id={inputId}
            value={value || ''}
            onChange={(e) => handleSettingChange(index, e.target.value)}
            min="0"
            step="0.01"
          />
          {unit && <span className="input-group-text">{unit}</span>}
        </div>
      )
    }

    // JSON (textarea)
    if (input_type === 'json') {
      return (
        <textarea
          className="form-control font-monospace"
          id={inputId}
          value={value || ''}
          onChange={(e) => handleSettingChange(index, e.target.value)}
          rows={4}
        />
      )
    }

    // Default: Text
    return (
      <input
        type="text"
        className="form-control"
        id={inputId}
        value={value || ''}
        onChange={(e) => handleSettingChange(index, e.target.value)}
        placeholder={description || ''}
      />
    )
  }

  // Agrupar settings por categoría (basado en segundo nivel del key si existe)
  const groupedSettings = settings.reduce((acc, setting) => {
    // Usar display_name como grupo simple
    if (!acc['Settings']) acc['Settings'] = []
    acc['Settings'].push(setting)
    return acc
  }, {})

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-sliders me-2"></i>
            POS Settings
          </h3>
          <p className="text-muted mb-0">Configure terminal, scale, and ticket settings</p>
        </div>
        <div className="d-flex gap-2">
          {hasChanges && (
            <button className="btn btn-outline-secondary" onClick={handleReset}>
              <i className="bi bi-arrow-counterclockwise me-2"></i>Reset
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2"></i>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Module Selector */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-auto">
              <label className="form-label mb-0 fw-semibold">Module:</label>
            </div>
            <div className="col-md-4">
              <select 
                className="form-select" 
                value={selectedModule} 
                onChange={handleModuleChange}
              >
                {modules.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label} ({m.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              {hasChanges && (
                <span className="badge bg-warning text-dark">
                  <i className="bi bi-exclamation-circle me-1"></i>
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary mb-3"></div>
            <p className="text-muted">Loading settings...</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      {!loading && settings.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-header bg-light">
            <h6 className="mb-0">
              <i className="bi bi-gear me-2"></i>
              {modules.find(m => m.value === selectedModule)?.label || selectedModule}
              <span className="badge bg-secondary ms-2">{settings.length} settings</span>
            </h6>
          </div>
          <div className="card-body">
            <div className="row g-4">
              {settings.map((setting, index) => {
                const isChanged = setting.value !== originalSettings[index]?.value
                
                return (
                  <div key={setting.setting_id} className="col-md-6">
                    <div className={`p-3 rounded border ${isChanged ? 'border-warning bg-warning bg-opacity-10' : 'bg-light'}`}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <label 
                          htmlFor={`setting-${setting.setting_id}`}
                          className="form-label fw-semibold mb-0"
                        >
                          {setting.display_name}
                          {isChanged && <span className="text-warning ms-2">*</span>}
                        </label>
                        <code className="small text-muted">{setting.key}</code>
                      </div>
                      
                      {setting.description && (
                        <p className="text-muted small mb-2">{setting.description}</p>
                      )}

                      {renderInput(setting, index)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && settings.length === 0 && selectedModule && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-3"></i>
            <h5>No settings found</h5>
            <p>No settings configured for module "{selectedModule}"</p>
          </div>
        </div>
      )}

      {/* Quick Reference */}
      <div className="card shadow-sm mt-4">
        <div className="card-header bg-light">
          <h6 className="mb-0">
            <i className="bi bi-info-circle me-2"></i>
            Quick Reference
          </h6>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <h6 className="text-primary"><i className="bi bi-speedometer me-2"></i>Scale</h6>
              <ul className="small text-muted">
                <li><strong>stable_threshold_seconds</strong>: Time weight must stay stable</li>
                <li><strong>weight_tolerance_lb</strong>: ± pounds for stability</li>
                <li><strong>auto_capture</strong>: Auto-capture when stable</li>
              </ul>
            </div>
            <div className="col-md-4">
              <h6 className="text-success"><i className="bi bi-arrow-repeat me-2"></i>Reweigh</h6>
              <ul className="small text-muted">
                <li><strong>window_minutes</strong>: Time allowed for reweigh</li>
                <li><strong>match_by</strong>: Field to match (plates, license)</li>
                <li><strong>discount_percent</strong>: Reweigh discount %</li>
              </ul>
            </div>
            <div className="col-md-4">
              <h6 className="text-info"><i className="bi bi-ticket me-2"></i>Tickets</h6>
              <ul className="small text-muted">
                <li><strong>prefix</strong>: Ticket number prefix</li>
                <li><strong>enable_qr</strong>: Show QR code on ticket</li>
                <li><strong>auto_print</strong>: Print automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PosSettings