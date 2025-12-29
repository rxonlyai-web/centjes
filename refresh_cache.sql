-- Force schema cache refresh by updating column comment
COMMENT ON COLUMN transacties.eu_location IS 'Supplier location for reverse-charge VAT: EU (rubric 4b), NON_EU (rubric 4a), or UNKNOWN (requires manual review)';

-- Also notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
