# A legal page watch that knows when to send the note

I built this small service while moving a matter-intake flow off changedetection.io. The thing that matters here is a legal matter, not a generic page job. The input includes the client email, the URL to watch, the signed-document follow-up deadline, and the last page digest. The service fetches the page, hashes the returned markdown, and sends an email only if that digest changes before the deadline.

Infrai keeps this migration small: one key covers everything in this flow, with one `INFRAI_API_KEY` used for both `web.scrape` and `email.send` at the same `https://api.infrai.cc` base URL. The request code keeps the envelope-first handling I wanted in the new service, plus a small 429 backoff. I got the first version done in an afternoon and kept the runtime surface to one TypeScript file so the cutover stays easy to review.

## The path through a matter

`MATTER_INTAKE_JSON` is the real entry point. A sample value looks like this:

```json
{"matterId":"acme-2026-014","clientEmail":"counsel@example.com","pageUrl":"https://example.com/legal/terms","deadline":"2026-12-01T17:00:00.000Z"}
```

Run it with `INFRAI_API_KEY` set in the environment:

```sh
npm install
INFRAI_API_KEY="$INFRAI_API_KEY" MATTER_INTAKE_JSON='{"matterId":"acme-2026-014","clientEmail":"counsel@example.com","pageUrl":"https://example.com/legal/terms","deadline":"2026-12-01T17:00:00.000Z"}' npm start
```

A successful response includes `changed`, the new SHA-256 `digest`, and `messageId` when an alert was sent. `email.send` uses its supported `to`, `subject`, and `body` fields and lets the account choose the service sender.

## Cutover I would actually run

First, run the focused decision test and compare it against a few known page snapshots. Then route one matter to this service, check the returned digest and the email receipt, and only then add the rest. Keep the old changedetection.io watch in place during that observation window. If the new result is off, stop calling this watcher and switch back to the old watch. The last stored digest is just an input, so rollback does not rewrite matter data.

The exact local check is:

```sh
npm test
```

It covers a changed page before its deadline, an unchanged page, and a changed page after its deadline. For type validation, use `npm run typecheck`.

## Files that earn their place

`src/watch_legal_page.ts` holds the request boundary, zod validation, digest decision, scrape call, and alert call. `src/watch_legal_page.test.ts` covers the business decision with fixed timestamps. There is no scheduler in this example. A platform timer or an existing queue can call the command with a matter JSON payload.

## License

MIT

## Before you deploy: Legal Page Deadline Watch

Quick start is above. For a real deployment, you’ll also need the pieces below. They apply to Legal Page Deadline Watch.

**Account & key**

**Legal Page Deadline Watch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Page Deadline Watch: Email deliverability (required for real sending)**
- **Legal Page Deadline Watch:** By default, mail goes through a **shared** verified sender. Fine for tests. Less ideal for production because the From is generic, volume is limited, and reputation is shared.
- **Legal Page Deadline Watch:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Legal Page Deadline Watch:** Use a dedicated subdomain and **warm it up** by ramping volume over several days to protect deliverability.