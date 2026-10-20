## Purpose

Lets any visitor propose a Greek-owned business for the map. Proposals enter a pending queue for the site owner to verify before they become visible.

## ADDED Requirements

### Requirement: Submission form
The system SHALL provide a public "Submit a business" form that does not require an account.

Required fields: business name, at least one category, full street address, and the submitter's email.

Optional fields: phone, website, description, and a note explaining the Greek ownership or connection.

#### Scenario: Valid submission
- **WHEN** a visitor completes all required fields and submits
- **THEN** the submission is stored with status "pending" and the visitor sees a confirmation that it will be reviewed

#### Scenario: Missing required field
- **WHEN** a visitor submits without an address
- **THEN** the form is not submitted and the address field shows a validation error

### Requirement: Field validation
The system SHALL validate submissions on the server as well as in the browser. Email, website URL and phone formats SHALL be validated, and text fields SHALL be length-limited.

#### Scenario: Malformed website
- **WHEN** the website field contains "not a url"
- **THEN** the server rejects the submission with a field-level error, even if browser validation was bypassed

### Requirement: Address geocoding
The system SHALL geocode the submitted address to coordinates at submission time. Submissions whose address cannot be geocoded SHALL still be accepted, flagged for the owner to fix during review.

#### Scenario: Geocodable address
- **WHEN** a valid street address is submitted
- **THEN** the pending submission stores the resolved latitude and longitude

#### Scenario: Ungeocodable address
- **WHEN** the address cannot be resolved
- **THEN** the submission is stored as pending with a "needs location" flag, and it cannot be approved until the owner supplies a location

### Requirement: Spam and abuse protection
The submission endpoint SHALL require a passing CAPTCHA challenge. It SHALL also rate-limit submissions per client to at most 5 per hour.

#### Scenario: CAPTCHA failure
- **WHEN** a submission arrives without a valid CAPTCHA token
- **THEN** it is rejected and nothing is stored

#### Scenario: Rate limit exceeded
- **WHEN** the same client submits a 6th business within one hour
- **THEN** the submission is rejected with a "try again later" message

### Requirement: Possible duplicate detection
When a submission closely matches an existing business, the system SHALL flag it as a possible duplicate for the owner, rather than rejecting it. A close match means a similar name within 100 meters.

#### Scenario: Near-duplicate
- **WHEN** "Agora Market" is submitted at an address 20 m from an existing "Agora Market"
- **THEN** the pending submission is flagged as a possible duplicate and links to the existing business

### Requirement: Submitter privacy
The submitter's email and ownership note SHALL be visible only to the owner. They SHALL never appear in public views.

#### Scenario: Approved submission
- **WHEN** a submission is approved and published
- **THEN** the public detail view shows the business fields but not the submitter's email or note
