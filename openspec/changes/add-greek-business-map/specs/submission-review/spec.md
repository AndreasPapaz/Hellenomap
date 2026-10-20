## Purpose

Gives the site owner a private area to verify that submitted businesses qualify as Greek-owned. From there the owner approves, edits or rejects submissions and controls which listings are public.

## ADDED Requirements

### Requirement: Owner-only access
The moderation area SHALL be accessible only to authenticated users whose email is on the configured admin allowlist. All moderation actions SHALL be authorized on the server, not merely hidden in the UI.

#### Scenario: Admin signs in
- **WHEN** an allowlisted user signs in via an emailed sign-in link
- **THEN** they can access the moderation area

#### Scenario: Non-admin access
- **WHEN** an unauthenticated user, or an authenticated user not on the allowlist, requests the moderation area or calls a moderation action
- **THEN** access is denied and no data is returned or changed

### Requirement: Pending queue
The moderation area SHALL list pending submissions oldest first. Each entry SHALL show:
- every submitted field, including the submitter's email and ownership note
- the geocoded location on a small map
- any "needs location" or "possible duplicate" flags

#### Scenario: View queue
- **WHEN** the owner opens the moderation area with 3 pending submissions
- **THEN** all 3 are listed oldest first with their flags visible

### Requirement: Approve submission
The owner SHALL be able to approve a pending submission, optionally editing its fields (including category and map location) first. On approval, the business SHALL become publicly visible.

#### Scenario: Approve with edits
- **WHEN** the owner corrects the category to "Bakery" and approves
- **THEN** the business appears on the public map under Bakery and leaves the pending queue

#### Scenario: Approve without location
- **WHEN** the owner attempts to approve a submission flagged "needs location" without setting one
- **THEN** approval is blocked with a message to set the location first

### Requirement: Reject submission
The owner SHALL be able to reject a pending submission with an optional private reason. Rejected submissions SHALL never become public and SHALL be retained for reference.

#### Scenario: Reject
- **WHEN** the owner rejects a submission as "not Greek-owned"
- **THEN** it leaves the pending queue, is stored as rejected with that reason, and never appears publicly

### Requirement: Manage published listings
The owner SHALL be able to search all businesses (imported and submitted), edit their details, and unpublish or republish them.

#### Scenario: Unpublish
- **WHEN** the owner unpublishes a business that has closed
- **THEN** it disappears from the public map and list immediately but remains in the moderation area

### Requirement: Audit trail
Every approve, reject, edit, unpublish and republish action SHALL record who performed it and when.

#### Scenario: Review history
- **WHEN** the owner views a business in the moderation area
- **THEN** they see its history of moderation actions with timestamps
