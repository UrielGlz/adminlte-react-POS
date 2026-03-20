import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import salesService from './sales.service.js'
import { query } from '../../config/database.js'
import { getReportSettings } from '../reports/reports.service.js'

// Reusar el dibujado del ticket (YA exportado por ti)
import { drawTicketPage, hydrateTicketsForPrint } from '../reports/customerStatement/customerStatement.service.js'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- util ---
const formatCurrency = (val) => {
  const n = Number(val) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const toInt0 = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

const getLogoPath = (logoFilename) => {
  if (!logoFilename) return null

  // OJO: este path está “alineado” a tu estructura actual (assets/images)
  const candidate = path.join(__dirname, '../../assets/images', logoFilename)
  if (fs.existsSync(candidate)) return candidate

  const fallback = path.join(__dirname, '../../assets/images/default-logo.png')
  if (fs.existsSync(fallback)) return fallback

  return null
}

async function getAxlesByMatchKey(matchKey) {
  if (!matchKey) return { eje1: 0, eje2: 0, eje3: 0, peso_total: 0 }

  const rows = await query(
    `
    SELECT eje1, eje2, eje3, peso_total
    FROM scale_session_axles
    WHERE uuid_weight = ?
    LIMIT 1
  `,
    [matchKey]
  )

  const r = rows?.[0]
  return {
    eje1: toInt0(r?.eje1),
    eje2: toInt0(r?.eje2),
    eje3: toInt0(r?.eje3),
    peso_total: toInt0(r?.peso_total)
  }
}

function pickTicketNumber(sale) {
  // prioridad: ticket real si existe, luego receipt_number, luego sale_id
  const t0 = sale?.tickets?.[0]
  return t0?.ticket_number || sale?.receipt_number || sale?.sale_id
}

function pickPrintedAt(sale) {
  const t0 = sale?.tickets?.[0]
  return t0?.printed_at || sale?.occurred_at || sale?.created_at || new Date().toISOString()
}

function pickDriverProduct(sale) {
  // 1) driver_info.product_description si existe (en tu statement está como driver_product)
  const fromDriver = sale?.driver_info?.product_description
  if (fromDriver) return fromDriver

  // 2) primer producto de líneas (p.name viene como product_name)
  const firstLine = sale?.lines?.[0]
  if (firstLine?.product_name) return firstLine.product_name

  return '-'
}

async function buildTicketObjectFromSale(sale) {
  const ticket_number = pickTicketNumber(sale)
  const printed_at = pickPrintedAt(sale)

  const driver = sale?.driver_info || {}

  // Axles (si existe match_key)
  const ax = await getAxlesByMatchKey(driver.match_key)

  // QR payload (simple y útil)
  const qrPayload = JSON.stringify({
    sale_uid: sale.sale_uid,
    sale_id: sale.sale_id,
    receipt_number: sale.receipt_number,
    ticket_number
  })

  const qrPng = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 4
  })
  // --- Asegurar ticket_uid (necesario para firma) ---
  let ticket_uid = sale?.tickets?.[0]?.ticket_uid || null

  if (!ticket_uid && sale?.sale_uid) {
    const rows = await query(
      `SELECT ticket_uid, ticket_number, printed_at
       FROM tickets
       WHERE sale_uid = ?
       ORDER BY ticket_id DESC
       LIMIT 1`,
      [sale.sale_uid]
    )
    const r = rows?.[0]
    console.log(r);
    if (r?.ticket_uid) {
      ticket_uid = r.ticket_uid
      // opcional: si no había ticket_number/printed_at “reales”, toma los del ticket
      // (esto ayuda a que sea consistente con lo impreso)
      // if (!sale?.tickets?.length) { ... }
    }
  }
  // Mapeo al objeto "t" que espera tu drawTicket...
  return {
    // header
    ticket_number,
    printed_at,
    qrPng,

    // driver info
    account_name: driver.account_name || null,
    driver_first_name: driver.driver_first_name || null,
    driver_last_name: driver.driver_last_name || null,
    vehicle_plates: driver.vehicle_plates || null,
    license_state: driver.license_state || null,
    tractor_number: driver.tractor_number || null,
    trailer_number: driver.trailer_number || null,
    driver_product: pickDriverProduct(sale),

    // operador
    operator_name: sale.operator_name || null,

    // scales
    eje1: ax.eje1,
    eje2: ax.eje2,
    eje3: ax.eje3,
    peso_total: ax.peso_total,

    // fee
    weigh_fee_text: formatCurrency(sale.total || 0),
    sale_uid: sale.sale_uid,
    ticket_uid,

    // reweigh info — is_reweigh se deriva de reweigh_of_sale_id (columna física, siempre en s.*)
    is_reweigh: sale.reweigh_of_sale_id ? 1 : 0,
    reweigh_of_sale_id: sale.reweigh_of_sale_id || null,
  }
}

/**
 * Construye PDFKit doc pipeable para UN saleId
 * Retorna { doc, filename }
 */
export const buildTicketPdfForSale = async (saleId) => {
  const sale = await salesService.getById(saleId)

  // settings (logo)
  let logoPath = null
  try {
    const settings = await getReportSettings()
    logoPath = getLogoPath(settings?.companyLogo)
  } catch (e) {
    // si falla settings, no truena el PDF
    logoPath = null
  }

  let t = await buildTicketObjectFromSale(sale)

  // Hidratar firma (NO depende de includeTickets, porque esto es ticket.pdf)
  const [tHydrated] = await hydrateTicketsForPrint([t], {
    withSignature: true,
    withQr: false,       // tú ya generas qrPng aquí, no lo regenere
    formatCurrency
  })

  t = tHydrated || t
  // debug temporal
  // console.log('[ticket.pdf]', { sale_uid: t.sale_uid, ticket_uid: t.ticket_uid, sig: t.signaturePng?.length || 0 })


  // IMPORTANTE:
  // drawTicketPage() hace doc.addPage(...) con el tamaño correcto (TICKET_W/TICKET_H).
  // Entonces creamos doc SIN primera página automática para evitar hoja en blanco.
  const doc = new PDFDocument({
    autoFirstPage: false
  })

  drawTicketPage(doc, t, logoPath)

  const niceNo = sale.receipt_number || t.ticket_number || saleId
  return { doc, filename: `ticket-${niceNo}.pdf` }
}

export default { buildTicketPdfForSale }
