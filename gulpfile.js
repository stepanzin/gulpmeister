const GulpMeister = require('./gulpmeister');
const argv = require('yargs').argv;

let isProduction = argv.prod || false;
let isWatchEnabled = argv.watch || false;
let isLiveReloadEnabled = argv.serve || false;
let isManifestEnabled = argv.manifest || false;

const exampleBrowserSyncConfig = {
    port: 3304,
    proxy: 'localhost:8094',
    logPrefix: 'BrowserSync',
    logConnections: true,
    open: false,
};

new GulpMeister()
    .setSourcePath('./src/assets')
    .addScriptEntry('./src/assets/scripts/works.js', 'main')
    .addScriptEntry('./src/assets/scripts/auth.js', 'auth')
    .addScssEntry('./src/assets/styles/*.scss', 'unnecessary_name_example')
    .setDestinationPath('./dist/assets')
    .optional(isManifestEnabled, ctx => ctx.writeManifest())
    .optional(isProduction, ctx => ctx.useMinify(), ctx => ctx.writeSourcemap())
    .optional(isWatchEnabled, ctx => ctx.useWatcher())
    .optional(isLiveReloadEnabled, ctx => ctx.setBrowserSyncConfig(exampleBrowserSyncConfig))
    .build();
