-- Check existing reverse-charge transactions
SELECT 
  COUNT(*) as count, 
  vat_treatment, 
  eu_location 
FROM transacties 
WHERE vat_treatment = 'foreign_service_reverse_charge' 
GROUP BY vat_treatment, eu_location;
