## Purpose

Seeds the Hellenomap directory with Greek-owned businesses from greekamericandirectory.com. Listings are normalized into Hellenomap's own data model and category taxonomy, and each keeps attribution to its source.

## ADDED Requirements

### Requirement: Discover all source listings
The import SHALL discover every business listing published by the source site, using the site's public listing sitemap as the authoritative list of listing URLs.

#### Scenario: Sitemap enumerates listings
- **WHEN** the import runs and the source sitemap lists N listing URLs
- **THEN** the import attempts to fetch and parse all N listings and reports how many succeeded, failed and were skipped

#### Scenario: Source unreachable
- **WHEN** the source sitemap cannot be fetched
- **THEN** the import aborts without modifying any existing directory data and exits with a non-zero status and an error message

### Requirement: Extract listing fields
For each listing, the import SHALL extract the business name, source categories, street address, latitude/longitude, phone number, website (when present), description (when present) and the listing URL.

#### Scenario: Complete listing
- **WHEN** a listing page contains a name, address, coordinates and phone
- **THEN** a directory record is produced with all of those fields populated and the source URL recorded

#### Scenario: Listing without coordinates
- **WHEN** a listing page has an address but no coordinates
- **THEN** the import geocodes the address to obtain coordinates, and if geocoding fails the record is skipped and reported, never stored without a location

### Requirement: Map source categories to directory taxonomy
The import SHALL map every source category to exactly one category in the Hellenomap taxonomy, which is a two-level hierarchy of top-level groups (e.g. "Food & Dining") and categories (e.g. "Restaurant", "Deli", "Lawyer"). A business MAY belong to multiple categories.

#### Scenario: Known category
- **WHEN** a listing is tagged with source category "Deli"
- **THEN** the stored business is assigned the "Deli" category under the "Food & Dining" group

#### Scenario: Unmapped category
- **WHEN** a listing is tagged with a source category that has no mapping
- **THEN** the business is still imported, the category is assigned to "Other", and the unmapped source category name appears in the import report

### Requirement: Imported records are published with attribution
Imported businesses SHALL be stored as approved (visible on the map), SHALL be marked as originating from the import, and SHALL retain their source URL for attribution.

#### Scenario: Imported business visible
- **WHEN** an import completes successfully
- **THEN** each imported business appears on the public map and its detail view credits the source directory with a link

### Requirement: Idempotent re-runs
Re-running the import SHALL update existing imported records matched by source URL instead of creating duplicates. It SHALL NOT overwrite fields the owner has manually edited, nor republish listings the owner has unpublished.

#### Scenario: Second run
- **WHEN** the import runs twice with unchanged source data
- **THEN** the number of businesses in the directory is the same after both runs

#### Scenario: Owner unpublished an imported listing
- **WHEN** the owner has unpublished an imported business and the import runs again
- **THEN** that business remains unpublished

### Requirement: Polite crawling
The import SHALL identify itself with a descriptive user agent, SHALL respect the source's robots.txt, and SHALL limit itself to at most one request per second to the source.

#### Scenario: Rate limit
- **WHEN** the import fetches 126 listing pages
- **THEN** no two requests to the source host are issued less than one second apart
