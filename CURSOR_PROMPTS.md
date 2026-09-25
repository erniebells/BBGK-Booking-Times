# Cursor Agent Prompts

Paste these prompts into Cursor Agent one at a time. Let each step finish and review its summary before moving to the next.

## 1. Inspect and plan

I want to build a simple, mobile-friendly tee-time booking system for a small golf club in South Africa. Members can sign in and book tee times. Guests can register, verify an email address or mobile number, and must then be approved by a club administrator before booking. Admins create and publish tee sheets for normal playing days and tournaments. Tee times are 10 minutes apart by default, and each slot holds up to four players.

First inspect this repository and its project instructions. Identify its stack, existing features, conventions, and run instructions. Do not replace the framework without a clear reason. Then propose an implementation plan that fits the codebase.

Assume one club and course, a responsive web app, South African local time, and ZAR if prices are later introduced. Admins manage the member list; public registration never grants member status. Admins set the booking window. Keep payments, handicaps, GolfRSA integration, scoring, and leaderboards out of the MVP. Minimize personal data and record important admin actions. Report the plan and any decisions that truly need input before coding.

## 2. Data model and booking rules

Implement the foundation using this repository's existing stack and conventions. Model users and roles (member, guest, administrator), member and guest approval states, contact verification, playing days/events, tee-time slots, bookings/player places, and admin audit records.

Enforce authorization and booking rules on the server. Only admins manage tee sheets. Only approved members and approved, contact-verified guests book. A slot cannot exceed capacity; simultaneous requests must not overbook the last place. Cancellation releases places. Users can manage only their own bookings; admins can manage all bookings. Profile edits must never grant member status. Generate slots from validated start/end times and interval, defaulting to 10 minutes and four places per slot. Add useful validation and summarize the schema and flow when done.

## 3. Authentication and approvals

Implement authentication using the existing framework's standard secure approach. Admin-created or approved accounts are required for members. Guests register with name and one contact method, complete one-time email or SMS verification, and then wait for explicit admin approval. Contact verification and club approval are separate states.

Provide clear account status screens. Protect admin pages and APIs with server-side role checks. Hash passwords with the framework's standard library, use secure session practices, rate-limit sign-in/registration/verification, and keep contact details private from other golfers. Use environment variables for secrets. If real email/SMS delivery is not configured, use a development-only verification path that is disabled in production; never silently mark accounts verified. Add a concise privacy notice, but do not claim legal compliance.

## 4. Golfer booking experience

Build a responsive experience for members and approved guests to browse published, open playing days and tournaments; view tee times and remaining places; book one or more places up to capacity; and see a confirmation and booking reference. Let users see and cancel their own future bookings, respecting a club-configurable cancellation deadline. For this MVP, the booking owner may enter other players' names without those players needing accounts.

Explain why a booking is unavailable when an account is unverified, pending, rejected, a day is closed, or a slot is full. Do not show other golfers' email addresses or phone numbers. Keep dates unambiguous and times in the club's local timezone. Include loading, empty, error, and success states and make the interface usable on a small phone.

## 5. Administrator tools

Build an admin area to create normal playing days and tournaments with title, date, event type, format label, notes, first/last tee time, and interval (10 minutes by default). Let admins preview generated slots before publishing, then publish, close, edit, or cancel the sheet.

Show the full tee sheet with four places per slot. Let admins add, move, or remove players/bookings; review and approve/reject guests; search accounts; and see booking status and creation time. Keep contact details visible only where needed for club administration. Record tee-sheet changes, guest decisions, and admin booking changes in an audit history. When an edit affects existing bookings, explain the impact and require the admin to resolve it before applying the change.

## 6. Final review

Review the implementation against the project requirements and repository conventions. Check server-side authorization, distinct guest verification and approval, no member privilege escalation, concurrency-safe capacity, cancellation release, slot generation and four-player capacity, local time handling, privacy of contact details, audit history, and safe secret/configuration handling.

Fix issues found. Summarize how to run the app, any manual setup still needed, what works, and what is deferred. Do not add payments, handicap calculations, GolfRSA integration, scoring, or leaderboards unless they already exist in the project.
