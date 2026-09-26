# Boggoms Bay Golf Club (web app)

See the repository [README](../README.md) for overview and deployment instructions.

## Local Development

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in your `.env` file. The seed will create this admin if no admin exists.

## Testing Member Import

Use the sample CSV at `samples/sample-members-dotgolf.csv` to test the import flow without real member data.
