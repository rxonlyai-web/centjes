'use client'

import styles from './TransactionList.module.css'

interface Transaction {
  id: string
  datum: string
  omschrijving: string
  bedrag: number
  type_transactie: 'INKOMSTEN' | 'UITGAVEN'
  categorie: string
  btw_tarief: number
  vat_treatment?: 'domestic' | 'foreign_service_reverse_charge'
  bon_url?: string
}

interface TransactionListProps {
  transactions: Transaction[]
  onTransactionClick?: (transaction: Transaction) => void
}

export default function TransactionList({ transactions, onTransactionClick }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Nog geen transacties gevonden</p>
        <small>Klik op &quot;Nieuwe Transactie&quot; om te beginnen</small>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  }

  const formatAmount = (amount: number, type: string) => {
    const formatted = new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount))
    
    return type === 'INKOMSTEN' ? `+${formatted}` : `-${formatted}`
  }

  return (
    <div className={styles.listContainer}>
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className={styles.transactionItem}
          onClick={() => onTransactionClick?.(transaction)}
        >
          <div className={styles.transactionInfo}>
            <div className={styles.transactionDescription}>
              {transaction.omschrijving}
            </div>
            <div className={styles.transactionMeta}>
              <span>{formatDate(transaction.datum)}</span>
              <span>•</span>
              <span>{transaction.categorie}</span>
              {transaction.bon_url && (
                <>
                  <span>•</span>
                  <span>📎 Bon</span>
                </>
              )}
              {transaction.vat_treatment === 'foreign_service_reverse_charge' && (
                <>
                  <span>•</span>
                  <span style={{ 
                    backgroundColor: 'rgba(255, 149, 0, 0.15)', 
                    color: '#ff9f0a', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    Btw verlegd
                  </span>
                </>
              )}
            </div>
          </div>
          <div
            className={`${styles.transactionAmount} ${
              transaction.type_transactie === 'INKOMSTEN' ? styles.income : styles.expense
            }`}
          >
            {formatAmount(transaction.bedrag, transaction.type_transactie)}
          </div>
        </div>
      ))}
    </div>
  )
}
