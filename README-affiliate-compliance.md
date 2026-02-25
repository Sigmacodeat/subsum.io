# Affiliate Compliance – Quick Start

## 1️⃣ Backend starten (mit DB)

```bash
# Migration sicherstellen
yarn workspace @affine/backend db:migrate

# Backend dev server
yarn workspace @affine/backend dev
```

## 2️⃣ Test-Seed ausführen

```bash
# Erstellt Admin + Affiliate + Test-Payout
npx ts-node scripts/seed-affiliate-test-data.ts
```

**Admin-Zugangsdaten**

- Email: `admin@subsumio.test`
- Password: `admin1234!`
- Dashboard: `$PLAYWRIGHT_BASE_URL/admin/affiliates` (Default: `http://localhost:8080`)

**Affiliate-Zugangsdaten**

- Email: `affiliate@subsumio.test`
- Password: `affiliate1234!`
- Referral Code: `TESTCODE`
- Settings: `$PLAYWRIGHT_BASE_URL/settings?tab=affiliate` (Default: `http://localhost:8080`)

## 3️⃣ Frontend starten

```bash
yarn workspace @affine/web start
```

## 4️⃣ E2E-Tests laufen lassen

```bash
npx playwright test --config=tests/affiliate-compliance.playwright.config.ts
```

---

## Was getestet wird

✅ **Positivtests (6)**

- Terms akzeptieren → UI + Event
- Tax-Daten speichern → UI + Event
- Referral gültig → Attribution
- Admin mark paid/failed → UI + Audit
- Admin Affiliate-Update → UI + Audit

⚠️ **Negativtests (4)**

- Alias Self-Referral → Block + Event
- Terms nicht akzeptiert → Payout Hold
- Tax-Info unvollständig → Payout Hold
- Stripe Payouts nicht ready → Payout Hold

---

## Admin Dashboard Links

- **Affiliate Overview**: `$PLAYWRIGHT_BASE_URL/admin/affiliates` (Default: `http://localhost:8080`)
- **Payout Settlement**: `$PLAYWRIGHT_BASE_URL/admin/affiliates` (Run payout settlement button)
- **Audit Trail**: Sichtbar in Payout Detail (rechte Seite)

---

## Fertig? ✅

Wenn alle 10 Tests grün sind, ist die Affiliate-Compliance **production-ready**.
