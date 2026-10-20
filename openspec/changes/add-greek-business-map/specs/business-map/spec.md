## Purpose

Lets visitors find approved Greek-owned businesses near them, or near a location they choose, on an interactive map. Results can be narrowed by category, with a linked list ordered by distance.

## ADDED Requirements

### Requirement: Interactive map
The home page SHALL display a full-viewport interactive map. Users can pan and zoom it, and it shows a marker for each approved business in the visible area. Nearby markers SHALL be clustered when zoomed out.

#### Scenario: Pan and zoom
- **WHEN** the user drags or zooms the map
- **THEN** the markers and the results list update to reflect businesses within the new visible area

#### Scenario: Dense area zoomed out
- **WHEN** many businesses fall within a small screen area
- **THEN** they are shown as a single cluster with a count, and clicking the cluster zooms in to reveal them

### Requirement: Use current location
The system SHALL offer to center the map on the user's current location via the browser's geolocation permission. It SHALL NOT store or transmit the user's precise location beyond the requests needed to find nearby businesses.

#### Scenario: Permission granted
- **WHEN** the user clicks "Near me" and grants location permission
- **THEN** the map centers on their location, shows a "you are here" marker, and lists nearby businesses by distance

#### Scenario: Permission denied or unavailable
- **WHEN** location permission is denied or geolocation is unavailable
- **THEN** the map stays at its default view and the user is prompted to type a location instead

### Requirement: Search by entered location
Users SHALL be able to type an address, city, or postal code. The map SHALL center on the best-matching place.

#### Scenario: Valid place
- **WHEN** the user enters "Astoria, NY" and submits
- **THEN** the map centers on Astoria and lists approved businesses nearest to that point

#### Scenario: Unknown place
- **WHEN** the entered text matches no place
- **THEN** the user sees a "location not found" message and the map does not move

### Requirement: Nearby results ordered by distance
Alongside the map, the system SHALL show a list of approved businesses ordered by distance from the reference point, which is the user's location or the searched location, otherwise the map center. Each entry SHALL show the name, primary category and distance.

#### Scenario: Distance ordering
- **WHEN** the reference point is set and businesses exist at 0.5 mi, 3 mi and 12 mi
- **THEN** the list shows them in that order with their distances

#### Scenario: Nothing nearby
- **WHEN** no approved business is within the visible area
- **THEN** the list shows an empty state that suggests zooming out and links to "Submit a business"

### Requirement: Category filter
Users SHALL be able to filter by one or more top-level groups (e.g. "Food & Dining") or specific categories (e.g. "Lawyer"). Only businesses matching the filter SHALL appear on the map and in the list. The active filter and location SHALL be reflected in the page URL so the view can be shared.

#### Scenario: Filter by group
- **WHEN** the user selects "Food & Dining"
- **THEN** only businesses in any category within Food & Dining (e.g. Restaurant, Deli, Bakery, Coffee) are shown

#### Scenario: Filter by specific category
- **WHEN** the user selects "Lawyer"
- **THEN** only businesses in the Lawyer category are shown, nearest first

#### Scenario: Shared link
- **WHEN** another person opens a URL copied while "Lawyer" was filtered near Chicago
- **THEN** they see the same filter applied at the same location

### Requirement: Only approved businesses are public
The map, list, and detail views SHALL show only businesses whose status is approved and published. Pending, rejected, or unpublished businesses SHALL never be returned to public visitors.

#### Scenario: Pending submission
- **WHEN** a business has been submitted but not yet approved
- **THEN** it does not appear in any public view or public API response

### Requirement: Business detail
Selecting a marker or list entry SHALL open a detail view with the business name, categories, address, phone (tap-to-call), website, description, a "Get directions" link to an external maps app, and source attribution for imported records. The detail view SHALL have its own shareable URL.

#### Scenario: Open detail
- **WHEN** the user clicks a business marker
- **THEN** the detail view opens and the map highlights that business

### Requirement: Mobile usability
The map experience SHALL be fully usable on phone-sized screens, with the results list presented as a bottom sheet over the map.

#### Scenario: Phone viewport
- **WHEN** the site is viewed at 375px width
- **THEN** the map, search, filters and results are all reachable without horizontal scrolling
