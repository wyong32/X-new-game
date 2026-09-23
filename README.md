# X Game Discovery Lab

Web game and indie release intelligence crawler and candidate curation system.

## Configuration & Environment Variables

See `.env.example` for all configurable environment variables.

### Firestore Configuration

For durable multi-session cloud persistence, you can connect the application to Google Cloud Firestore:

```env
FIRESTORE_PROJECT_ID=your-gcp-project-id
FIRESTORE_DATABASE_ID=(default)
```

- **Cloud Run Deployment**: When running on Cloud Run, the application communicates with Firestore using **Application Default Credentials (ADC)** automatically through the attached Cloud Run service account.
- **Security Requirement**: **Do NOT commit credential JSON files** (e.g. service account keys) to the repository. The Google Cloud Firestore client automatically detects ambient ADC credentials on Cloud Run without needing explicit key files.

### Data Modes & Startup Safety

- `X_DATA_MODE="mock"` (default): Runs with built-in mock fixtures and offline search simulation.
- `X_DATA_MODE="live"`: Runs against live X API endpoints. In LIVE mode, `APP_PASSWORD` is required at startup.
