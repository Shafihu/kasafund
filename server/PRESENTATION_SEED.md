# Presentation database seed

The presentation seed creates coherent records in a real MongoDB database. It is intended for a dedicated database whose name contains `presentation` or `demo`.

## Safety

- It refuses to run with `NODE_ENV=production`.
- It refuses database names without `presentation` or `demo`, unless `ALLOW_PRESENTATION_SEED=true` is explicitly set.
- It removes and replaces only the deterministic presentation records it owns.
- Keep automatic payout, contribution and savings processors disabled in the presentation environment so dates and balances remain stable.

Example server environment:

```env
NODE_ENV=development
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/kasafund_presentation
JWT_SECRET=use-a-non-production-secret
AUTOMATIC_PAYOUTS_ENABLED=false
AUTOMATIC_CONTRIBUTIONS_ENABLED=false
AUTOMATIC_SAVINGS_ENABLED=false
```

Alternatively, keep the server's normal `MONGODB_URI` unchanged and set
`PRESENTATION_MONGODB_URI` only when running the seed command.

## Commands

From `server/`:

```sh
npm run seed:presentation
npm run seed:presentation:reset
```

The seed is repeatable: running `seed:presentation` again first removes the known presentation records and then recreates them with fresh relative dates.

Default presenter login:

```text
Email: abena@demo.kasafund.app
Password: KasaFundDemo2026!
```

Override the password for a seed run with `PRESENTATION_DEMO_PASSWORD`.

KYC demonstration account:

```text
Email: ama@demo.kasafund.app
Password: KasaFundDemo2026!
Identity verification: Not started
```

Web operations console:

```text
URL: http://localhost:5173/admin
Email: admin@demo.kasafund.app
Password: KasaFundDemo2026!
Role: Super administrator
```

If the presentation data already exists, add only the administrator without
resetting any other records:

```sh
npm run seed:presentation:admin
```

Override its password with `PRESENTATION_ADMIN_PASSWORD`.

All people and stories in this dataset are fictional. Money is stored in integer pesewas, matching the application models.
