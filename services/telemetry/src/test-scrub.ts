import { scrub } from './utils';

const testPayloads = [
    {
        name: 'Sensitive fields',
        payload: {
            user: {
                email: 'user@example.com',
                password: 'secretpassword123',
                profile: {
                    phone: '555-1234',
                    address: '123 Main St'
                }
            },
            token: 'abc-123-def-456',
            apiKey: 'xyz-789'
        },
        expected: {
            user: {
                email: '[REDACTED]',
                password: '[REDACTED]',
                profile: {
                    phone: '[REDACTED]',
                    address: '[REDACTED]'
                }
            },
            token: '[REDACTED]',
            apiKey: '[REDACTED]'
        }
    },
    {
        name: 'URLs with sensitive data',
        payload: {
            url: 'https://example.com/callback?token=secret&user=john',
            href: 'https://app.example.com/dashboard#access_token=12345',
            safe_url: 'https://example.com/home'
        },
        expected: {
            url: 'https://example.com/callback',
            href: 'https://app.example.com/dashboard',
            safe_url: 'https://example.com/home'
        }
    },
    {
        name: 'Arrays and nested structures',
        payload: {
            events: [
                { type: 'login', email: 'test@test.com' },
                { type: 'click', url: 'https://site.com?q=search' }
            ]
        },
        expected: {
            events: [
                { type: 'login', email: '[REDACTED]' },
                { type: 'click', url: 'https://site.com/' }
            ]
        }
    },
    {
        name: 'Invalid/relative URLs',
        payload: {
            url: '/path/to/resource?id=123',
            href: 'just-a-string#hash'
        },
        expected: {
            url: '[SENSITIVE URL REDACTED]',
            href: '[SENSITIVE URL REDACTED]'
        }
    }
];

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('--- Running Telemetry Scrubbing Tests ---');

    for (const test of testPayloads) {
        const result = scrub(test.payload);
        const resultStr = JSON.stringify(result);
        const expectedStr = JSON.stringify(test.expected);

        if (resultStr === expectedStr) {
            console.log(`✅ PASSED: ${test.name}`);
            passed++;
        } else {
            console.log(`❌ FAILED: ${test.name}`);
            console.log('  Expected:', expectedStr);
            console.log('  Actual:  ', resultStr);
            failed++;
        }
    }

    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
