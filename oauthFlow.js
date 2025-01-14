const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar']; // Adjust scopes as needed
const CREDENTIALS_PATH = path.join(__dirname, 'credentials_google_calendar.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Function to load previously saved tokens
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH, 'utf8');
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        console.log('No existing token found. Proceeding to authenticate...');
        return null;
    }
}

// Function to save credentials for future use
async function saveCredentials(client) {
    const keysContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const keys = JSON.parse(keysContent);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
    console.log('Token saved to', TOKEN_PATH);
}

// Function to handle the OAuth process
async function authorize() {
    // Check if a token already exists
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        console.log('Existing credentials found and loaded.');
        return client;
    }

    // Perform the OAuth flow
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });

    // Save the new credentials for future use
    if (client.credentials) {
        await saveCredentials(client);
    }

    console.log('Authorization complete.');
    return client;
}

// Example function to fetch calendar events
async function listCalendarEvents(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    });

    const events = response.data.items;
    if (!events || events.length === 0) {
        console.log('No upcoming events found.');
        return [];
    }
    console.log('Upcoming events:');
    events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
    });
    return events;
}

// Main execution
(async () => {
    try {
        const auth = await authorize();
        await listCalendarEvents(auth);
    } catch (error) {
        console.error('Error during OAuth or API call:', error);
    }
})();
