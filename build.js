
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PACKAGES = [
    { name: 'loader', entry: 'packages/loader/src/index.ts', stable: true },
    { name: 'runtime', entry: 'packages/runtime/src/index.ts', stable: false }
];

const RELEASE_DIR = path.join(__dirname, 'release');

async function build() {
    if (!fs.existsSync(RELEASE_DIR)) fs.mkdirSync(RELEASE_DIR);

    const manifest = {};

    for (const pkg of PACKAGES) {
        console.log(`Building ${pkg.name}...`);

        // 1. Build to memory/temp
        const result = await esbuild.build({
            entryPoints: [pkg.entry],
            bundle: true,
            write: false, // Don't write yet
            minify: true,
            sourcemap: true,
            target: ['es2020'],
            format: 'iife',
            globalName: pkg.name === 'runtime' ? 'ParkourBot' : undefined,
            outfile: 'bundle.js',
        });

        const codeFile = result.outputFiles.find(f => f.path.endsWith('.js'));
        const mapFile = result.outputFiles.find(f => f.path.endsWith('.js.map'));

        if (!codeFile) throw new Error('No JS output found');
        const code = codeFile.text;
        const map = mapFile ? mapFile.text : '';

        let filename;
        if (pkg.stable) {
            filename = `${pkg.name}.js`;
        } else {
            const hash = crypto.createHash('md5').update(code).digest('hex').substring(0, 8);
            filename = `${pkg.name}-${hash}.js`;
        }

        const outPath = path.join(RELEASE_DIR, filename);
        const mapPath = outPath + '.map';

        fs.writeFileSync(outPath, code);
        fs.writeFileSync(mapPath, map);

        // Always provide a stable unhashed version for local dev/fallbacks
        if (!pkg.stable) {
            fs.writeFileSync(path.join(RELEASE_DIR, `${pkg.name}.js`), code);
            fs.writeFileSync(path.join(RELEASE_DIR, `${pkg.name}.js.map`), map);
        }

        manifest[pkg.name] = filename;
        console.log(`✓ ${pkg.name} built to release/${filename}`);
    }

    fs.writeFileSync(path.join(RELEASE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('✓ Release manifest updated.');

    // Copy demo.html to release/index.html as the primary "One Truth" demo
    // matches the "Parkour Training Grounds" layout
    if (fs.existsSync('demo.html')) {
        let content = fs.readFileSync('demo.html', 'utf8');

        // Critical Fix: Adjust script path for release directory context
        // Root demo.html uses "./release/loader.js", release/index.html must use "./loader.js"
        content = content.replace('./release/loader.js', './loader.js');

        fs.writeFileSync(path.join(RELEASE_DIR, 'index.html'), content);
        console.log('✓ Consolidated: demo.html -> release/index.html (One Truth)');
    }
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
