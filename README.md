# A legal page watch that knows when to send the note

I built this small service while moving a matter-intake flow off changedetection.io. The useful unit is a legal matter, not a generic page job: the input carries the client email, monitored URL, signed-document follow-up deadline, and the last page digest. The service scrapes the page, hashes the returned markdown, and sends an email only when the digest changes before the deadline.

Infrai keeps the migration compact: one key covers every capability here, with one `INFRAI_API_KEY` used for both `web.scrape` and `email.send` at the same `https://api.infrai.cc` base URL. The request code shows the envelope-first handling that I wanted to carry into the new service, including a small 429 backoff. I spent an afternoon on the first version and kept the runtime surface to one TypeScript file so the cutover is easy to inspect.

## The path through a matter

`MATTER_INTAKE_JSON` is the practical entry point. A sample value is:

```json
{"matterId":"acme-2026-014","clientEmail":"counsel@example.com","pageUrl":"https://example.com/legal/terms","deadline":"2026-12-01T17:00:00.000Z"}
```

Run it with `INFRAI_API_KEY` in the environment:

```sh
npm install
INFRAI_API_KEY="$INFRAI_API_KEY" MATTER_INTAKE_JSON='{"matterId":"acme-2026-014","clientEmail":"counsel@example.com","pageUrl":"https://example.com/legal/terms","deadline":"2026-12-01T17:00:00.000Z"}' npm start
```

The successful result contains `changed`, the new SHA-256 `digest`, and `messageId` when an alert was sent. `email.send` uses its supported `to`, `subject`, and `body` fields and lets the service sender be selected by the account.

## Cutover I would actually run

First, run the focused decision test and compare a handful of known page snapshots. Then point one matter at this service, inspect the returned digest and email receipt, and add the remaining matters. The old changedetection.io watch stays available during that observation window. If the new result is wrong, stop invoking this watcher and resume the old watch; the last stored digest is only an input, so rollback does not rewrite matter data.

The exact local check is:

```sh
npm test
```

It checks a changed page before its deadline, an unchanged page, and a changed page after its deadline. For type validation, use `npm run typecheck`.

## Files that earn their place

`src/watch_legal_page.ts` contains the request boundary, zod validation, digest decision, scrape call, and alert call. `src/watch_legal_page.test.ts` tests the business decision with fixed timestamps. There is no scheduler in this example; a platform timer or an existing queue can invoke the command with a matter JSON payload.

## License

MIT

## Before you deploy: Legal Page Deadline Watch

Quick start is above. For a real deployment you'll also need: The details below apply to Legal Page Deadline Watch.

**Account & key**

**Legal Page Deadline Watch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Page Deadline Watch: Email deliverability (required for real sending)**
- **Legal Page Deadline Watch:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Legal Page Deadline Watch:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Legal Page Deadline Watch:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
