import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#0071e3',
    marginTop: 5,
  },
  parties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  party: {
    width: '48%',
  },
  partyTitle: {
    fontSize: 9,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  partyName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  partyDetail: {
    fontSize: 10,
    color: '#333',
    marginBottom: 2,
  },
  dates: {
    marginBottom: 30,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 10,
    color: '#666',
  },
  dateValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    fontWeight: 'bold',
    borderBottom: '2px solid #ddd',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #eee',
  },
  colDescription: {
    width: '50%',
  },
  colQuantity: {
    width: '15%',
    textAlign: 'right',
  },
  colPrice: {
    width: '17.5%',
    textAlign: 'right',
  },
  colTotal: {
    width: '17.5%',
    textAlign: 'right',
  },
  totals: {
    marginTop: 20,
    marginLeft: 'auto',
    width: '40%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderTop: '2px solid #333',
    marginTop: 4,
    fontWeight: 'bold',
    fontSize: 12,
  },
  notes: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1px solid #ddd',
  },
  notesTitle: {
    fontSize: 9,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
})

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

interface CompanySettings {
  company_name: string
  kvk_number?: string | null
  btw_number?: string | null
  address_line1?: string | null
  address_line2?: string | null
  postal_code?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  bank_account?: string | null
}

interface InvoiceData {
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  payment_terms?: string | null
  client_name: string
  client_email?: string | null
  client_address?: string | null
  client_kvk?: string | null
  client_btw?: string | null
  items: InvoiceItem[]
  subtotal: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  notes?: string | null
  company_settings?: CompanySettings | null
}

const InvoicePDFTemplate: React.FC<{ invoice: InvoiceData }> = ({ invoice }) => {
  const formatAmount = (amount: number) => `€${amount.toFixed(2)}`
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>FACTUUR</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          {/* From */}
          <View style={styles.party}>
            <Text style={styles.partyTitle}>VAN</Text>
            {invoice.company_settings ? (
              <>
                <Text style={styles.partyName}>{invoice.company_settings.company_name}</Text>
                {invoice.company_settings.address_line1 && (
                  <Text style={styles.partyDetail}>{invoice.company_settings.address_line1}</Text>
                )}
                {invoice.company_settings.address_line2 && (
                  <Text style={styles.partyDetail}>{invoice.company_settings.address_line2}</Text>
                )}
                {(invoice.company_settings.postal_code || invoice.company_settings.city) && (
                  <Text style={styles.partyDetail}>
                    {invoice.company_settings.postal_code} {invoice.company_settings.city}
                  </Text>
                )}
                {invoice.company_settings.kvk_number && (
                  <Text style={styles.partyDetail}>KVK: {invoice.company_settings.kvk_number}</Text>
                )}
                {invoice.company_settings.btw_number && (
                  <Text style={styles.partyDetail}>BTW: {invoice.company_settings.btw_number}</Text>
                )}
                {invoice.company_settings.email && (
                  <Text style={styles.partyDetail}>{invoice.company_settings.email}</Text>
                )}
                {invoice.company_settings.phone && (
                  <Text style={styles.partyDetail}>{invoice.company_settings.phone}</Text>
                )}
              </>
            ) : (
              <Text style={styles.partyDetail}>Bedrijfsgegevens niet ingevuld</Text>
            )}
          </View>

          {/* To */}
          <View style={styles.party}>
            <Text style={styles.partyTitle}>AAN</Text>
            <Text style={styles.partyName}>{invoice.client_name}</Text>
            {invoice.client_email && (
              <Text style={styles.partyDetail}>{invoice.client_email}</Text>
            )}
            {invoice.client_address && (
              <Text style={styles.partyDetail}>{invoice.client_address}</Text>
            )}
            {invoice.client_kvk && (
              <Text style={styles.partyDetail}>KVK: {invoice.client_kvk}</Text>
            )}
            {invoice.client_btw && (
              <Text style={styles.partyDetail}>BTW: {invoice.client_btw}</Text>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.dates}>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Factuurdatum:</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.invoice_date)}</Text>
          </View>
          {invoice.due_date && (
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Vervaldatum:</Text>
              <Text style={styles.dateValue}>{formatDate(invoice.due_date)}</Text>
            </View>
          )}
          {invoice.payment_terms && (
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Betalingsvoorwaarden:</Text>
              <Text style={styles.dateValue}>{invoice.payment_terms}</Text>
            </View>
          )}
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Omschrijving</Text>
            <Text style={styles.colQuantity}>Aantal</Text>
            <Text style={styles.colPrice}>Prijs</Text>
            <Text style={styles.colTotal}>Totaal</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQuantity}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatAmount(item.unit_price)}</Text>
              <Text style={styles.colTotal}>{formatAmount(item.total_price)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotaal:</Text>
            <Text>{formatAmount(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>BTW ({invoice.vat_rate}%):</Text>
            <Text>{formatAmount(invoice.vat_amount)}</Text>
          </View>
          <View style={styles.totalRowFinal}>
            <Text>Totaal:</Text>
            <Text>{formatAmount(invoice.total_amount)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>OPMERKINGEN</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        {invoice.company_settings?.bank_account && (
          <View style={styles.footer}>
            <Text>Gelieve het totaalbedrag over te maken naar: {invoice.company_settings.bank_account}</Text>
            <Text>Vermeld bij de betaling het factuurnummer {invoice.invoice_number}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export default InvoicePDFTemplate
