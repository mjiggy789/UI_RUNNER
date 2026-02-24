/**
 * Recursively scrubs sensitive data from an object.
 * Redacts fields known to contain PII or secrets.
 * Strips query parameters and hashes from URLs.
 */
export function scrub(data: any): any {
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(scrub);
    }

    const sensitiveFields = [
        'email', 'password', 'token', 'secret', 'key',
        'auth', 'credit_card', 'ssn', 'address', 'phone',
        'apikey', 'access_token'
    ];
    const scrubbed: any = {};

    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveFields.includes(lowerKey)) {
            scrubbed[key] = '[REDACTED]';
        } else if ((lowerKey === 'url' || lowerKey === 'href') && typeof value === 'string') {
            try {
                const url = new URL(value);
                url.search = '';
                url.hash = '';
                scrubbed[key] = url.toString();
            } catch (e) {
                // If it's not a valid absolute URL, redact it for safety
                // if it looks like it might contain query params
                if (value.includes('?') || value.includes('#')) {
                    scrubbed[key] = '[SENSITIVE URL REDACTED]';
                } else {
                    scrubbed[key] = value;
                }
            }
        } else {
            scrubbed[key] = scrub(value);
        }
    }

    return scrubbed;
}
