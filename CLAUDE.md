# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Boekhoud MVP ("Centjes - Boekhouding. Simpel.") is a Dutch accounting/bookkeeping SaaS for freelancers (ZZP'ers) and partnerships (VOF's). Built with Next.js 16, React 19, TypeScript, and Supabase.

## Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
npm start            # Start production server
npm run cap:sync     # Sync web build to iOS (Capacitor)
npm run cap:open     # Open iOS project in Xcode
npx vercel --prod    # Deploy to production (centjes.eu)
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 App Router, React 19, TypeScript, CSS Modules
- **Backend**: Next.js Server Actions, Supabase (PostgreSQL + Storage)
- **AI/OCR**: Google Gemini 2.0 Flash for receipt/invoice extraction and bank transaction categorization
- **Auth**: Google OAuth via Supabase Auth
- **Mobile**: Capacitor 8 for iOS native wrapper (app ID: `eu.centjes.app`, points to `centjes.eu`)
- **PDF**: @react-pdf/renderer for invoice generation
- **Charts**: Recharts for dashboard visualizations
- **Deployment**: Vercel (production at centjes.eu)

### Directory Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/webhooks/       # N8N webhook for incoming expenses
│   ├── auth/               # Auth callback + actions
│   ├── dashboard/          # Main authenticated area
│   │   ├── btw/            # VAT reporting
│   │   ├── belastingen/    # Tax compliance
│   │   ├── facturen/       # Invoice management
│   │   ├── ib/             # Income tax overview
│   │   ├── instellingen/   # Settings + Gmail integration
│   │   ├── transacties/    # Transaction list
│   │   └── uitgaven/       # Expense management
│   └── login/, register/   # Auth pages
├── components/             # Reusable React components
├── contexts/               # YearContext for global fiscal year
├── lib/
│   ├── ocr/                # Gemini-based document extraction
│   ├── bank-csv/           # Bank statement parsers (ING, Rabobank, ABN AMRO, Bunq)
│   ├── gemini.ts           # Gemini AI client initialization
│   └── vat.ts              # Dutch VAT calculation utilities
└── utils/supabase/         # Supabase client factories
supabase/
└── migrations/             # Database schema (16 migrations)
```

### Key Patterns

**Server Actions**: Each dashboard feature has an `actions.ts` file with `'use server'` functions that handle database operations. Server actions use `createClient()` for user-scoped operations.

**Path Alias**: Use `@/*` to import from `./src/*` (e.g., `@/components/Sidebar`).

**Supabase Clients**:
- `createClient()` - User-authenticated client with cookie-based sessions
- `createServiceRoleClient()` - Bypasses RLS, use only for webhook/admin operations

**CSS Modules**: Each component has a corresponding `.module.css` file.

**YearContext**: Global fiscal year state (`contexts/YearContext.tsx`). All dashboard pages filter data by `activeYear`. Persisted in localStorage. Access via `useYear()` hook.

### Core Data Models

**transacties**: Financial transactions with:
- `type_transactie`: 'INKOMSTEN' | 'UITGAVEN'
- `categorie`: 'Inkoop' | 'Sales' | 'Reiskosten' | 'Kantoor' | 'Overig'
- `vat_treatment`: 'domestic' | 'foreign_service_reverse_charge'
- `btw_tarief`: VAT rate (0, 9, or 21%)

**pending_expenses**: Incoming invoices awaiting review with OCR data, currency conversion, and EU location tracking.

### Bank Statement Import

CSV upload flow in `BankImportModal` component:
1. User uploads CSV → `parseBankStatement()` auto-detects bank format (ING/Rabobank/ABN AMRO/Bunq)
2. `categorizeBankTransactions()` uses Gemini AI for categorization + duplicate detection
3. `importBankTransactions()` bulk inserts into `transacties` table
4. Cache revalidated for dashboard and transacties pages

Bank parsers are in `src/lib/bank-csv/` with per-bank format handlers.

### Expense Processing Flow

1. Email → N8N webhook (`/api/webhooks/incoming-expense`) → PDF stored in Supabase
2. User opens expense → Auto-runs Gemini OCR (`lib/ocr/expense-ocr.ts`)
3. User reviews/edits → Approve creates transaction, Reject deletes

### Dutch VAT Logic

VAT treatment is critical for Dutch tax compliance:
- **domestic**: Dutch supplier with NL VAT number
- **foreign_service_reverse_charge**: Foreign supplier (customer accounts for VAT)
- **eu_location**: 'EU' | 'NON_EU' | 'UNKNOWN' for VAT reporting

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
N8N_WEBHOOK_SECRET=
```

### Database

Supabase with Row Level Security (RLS) on all tables. Migrations in `supabase/migrations/`. Key tables: `transacties`, `pending_expenses`, `documents`, `invoices`, `company_settings`, `tax_deadlines`, `user_gmail_connections`.

Storage bucket `expense-pdfs` stores incoming expense PDFs.

## Middleware

`src/middleware.ts` protects `/dashboard/*` routes, redirects unauthenticated users to `/login`, and authenticated users away from auth pages.

## iOS / Capacitor

The iOS app is a Capacitor shell pointing to the production web app (`centjes.eu`). Native features: camera for receipt scanning, status bar, splash screen, keyboard handling. The `ios/` directory contains the Xcode project. Use `npm run cap:sync` after web changes and `npm run cap:open` to open in Xcode.
