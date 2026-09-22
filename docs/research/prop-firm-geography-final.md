# Cierre geográfico

Fecha de revisión: 2026-09-21. No se ejecutó SQL remoto.

## Modelo público

- `restricted`: existe una restricción oficial aplicable.
- `available`: se deriva únicamente cuando una fuente oficial marcada como lista completa no contiene el país seleccionado.
- `unknown`: no existe evidencia suficiente. Nunca se transforma en disponible.

La señal mínima `restriction_list_complete` vive en la regla respaldada por la fuente y conserva el alcance de `market`. No se crean filas `available` por país.

## Cobertura preparada

- Batch 01: 15 firmas, 93 restricciones ya cargadas. Las 15 fuentes se presentan como listas completas; E8, FundedNext, Lucid, Alpha Futures y Top One Futures conservan alcance por market.
- Batch 02: 10 firmas adicionales con listas oficiales representables. Atmos Funded se guarda con restricciones explícitas, pero sin inferencia porque su documento dice “include, but is not limited to”.
- Restantes: 35 firmas permanecen `Sin verificar` hasta localizar una fuente oficial suficientemente clara. No se infirieron restricciones desde agregadores ni desde el nombre de la firma.

## Fuentes oficiales del Batch 02

1. Alpha Trader Firm — https://faq.alphafunded.com/en/articles/9568285-restricted-countries
2. Atmos Funded — https://atmosfunded.com/wp-content/uploads/2025/06/ATMOS-Customer-Agreement-and-Risk-Management-Policy-v7.pdf
3. Blue Guardian CFD — https://help.blueguardian.com/en/articles/15618204-general-information-rules
4. Blueberry Funded — https://help.blueberryfunded.com/en/articles/9550574-are-any-countries-restricted-from-purchasing-an-evaluation
5. Fintokei — https://support.fintokei.com/en/articles/6538820-who-can-join-fintokei
6. For Traders — https://help.fortraders.com/en/articles/9259446-list-of-restricted-countries
7. Funded Trading Plus — https://help.fundedtradingplus.com/prohibited-countries/
8. Funding Traders — https://fundingtraders.com/help/en/articles/10505376-are-there-any-restricted-countries-for-fundingtraders-services
9. Futures Elite — https://faq.futureselite.com/en/articles/12302907-countries-we-do-not-provide-services-for
10. Goat Funded Futures — https://help.goatfundedfutures.com/en/articles/14094470-which-countries-are-restricted

Los territorios y regiones que no son estados soberanos del catálogo se omitieron del seed; no se sustituyeron por países completos.
