# Firebase Firestore setup for Star Library

This project now supports Firebase Firestore as an alternative to MongoDB.

## 1. Create a Firebase project
- Go to https://console.firebase.google.com/
- Create a project and enable Firestore Database

## 2. Create a service account
- In Firebase Console, go to Project Settings > Service accounts
- Generate a new private key
- Save the JSON file securely

## 3. Configure environment variables
Set one of the following in your environment:

- `FIREBASE_SERVICE_ACCOUNT_JSON=<raw JSON string>`
- `FIREBASE_CREDENTIALS_PATH=C:\path\to\serviceAccount.json`
- `GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccount.json`
- `FIREBASE_PROJECT_ID=star-library-p`

If you want to force Firebase mode, also set:
- `STORAGE_MODE=firebase`

> Use whichever credential method is most secure for your environment. Do not commit service account files or JSON to source control.

## 4. Start the server
Run:

npm start

When Firebase is configured, the API will use Firestore. If not, it will fall back to MongoDB.
